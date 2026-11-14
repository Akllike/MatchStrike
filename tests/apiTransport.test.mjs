import test from 'node:test'
import assert from 'node:assert/strict'
import { createApiTransport } from '../src/apiTransport.mjs'

test('successful JSON preserves the response and request options without opening the dialog', async () => {
  let received
  const transport = createApiTransport({ fetchImpl: async (url, options) => {
    received = { url, options }
    return Response.json({ ok: true })
  } })
  let failures = 0
  transport.subscribeUnavailable(() => failures++)
  const response = await transport.apiFetch('/api/v1/example', { method: 'POST', credentials: 'include', body: 'payload' })
  assert.deepEqual(await response.json(), { ok: true })
  assert.equal(received.url, '/api/v1/example')
  assert.equal(received.options.method, 'POST')
  assert.equal(received.options.credentials, 'include')
  assert.equal(received.options.body, 'payload')
  assert.equal(failures, 0)
})

test('network failures notify once even when parallel requests fail; late subscribers see the outage', async () => {
  const error = new TypeError('Failed to fetch')
  const transport = createApiTransport({ fetchImpl: async () => { throw error } })
  let failures = 0
  const unsubscribe = transport.subscribeUnavailable(() => failures++)
  await Promise.all([
    assert.rejects(transport.apiFetch('/api/v1/one'), error),
    assert.rejects(transport.apiFetch('/api/v1/two'), error),
  ])
  assert.equal(failures, 1)
  unsubscribe()
  let lateFailures = 0
  transport.subscribeUnavailable(() => lateFailures++)
  assert.equal(lateFailures, 1)
})

test('server errors show the outage while preserving the error response', async () => {
  for (const status of [500, 502, 503, 504]) {
    const transport = createApiTransport({ fetchImpl: async () => new Response('Unavailable', { status }) })
    let failures = 0
    transport.subscribeUnavailable(() => failures++)
    const response = await transport.apiFetch('/api/v1/example')
    assert.equal(response.status, status)
    assert.equal(await response.text(), 'Unavailable')
    assert.equal(failures, 1)
  }
})

test('authorization, validation, not-found and rate-limit responses do not show an outage', async () => {
  for (const status of [401, 403, 404, 419, 422, 429]) {
    const transport = createApiTransport({ fetchImpl: async () => Response.json({ message: 'Error' }, { status }) })
    let failures = 0
    transport.subscribeUnavailable(() => failures++)
    assert.equal((await transport.apiFetch('/api/v1/example')).status, status)
    assert.equal(failures, 0)
  }
})

test('a hanging request times out, aborts and shows the outage', async () => {
  let signal
  const transport = createApiTransport({ timeoutMs: 10, fetchImpl: async (_, options) => {
    signal = options.signal
    return new Promise(() => {})
  } })
  let failures = 0
  transport.subscribeUnavailable(() => failures++)
  await assert.rejects(transport.apiFetch('/api/v1/example'), /timed out/)
  assert.equal(signal.aborted, true)
  assert.equal(failures, 1)
})

test('the deadline includes a response whose body never arrives', async () => {
  const transport = createApiTransport({ timeoutMs: 10, fetchImpl: async () => new Response(new ReadableStream({ start() {} })) })
  let failures = 0
  transport.subscribeUnavailable(() => failures++)
  await assert.rejects(transport.apiFetch('/api/v1/example'), /timed out/)
  assert.equal(failures, 1)
})

test('a successful HTML fallback is detected as an unavailable API', async () => {
  const transport = createApiTransport({ fetchImpl: async () => new Response('<html>Proxy fallback</html>') })
  let failures = 0
  transport.subscribeUnavailable(() => failures++)
  await assert.rejects(transport.apiFetch('/api/v1/example'), SyntaxError)
  assert.equal(failures, 1)
})

test('empty successful responses and explicit request cancellation do not show an outage', async () => {
  const empty = createApiTransport({ fetchImpl: async () => new Response(null, { status: 204 }) })
  let failures = 0
  empty.subscribeUnavailable(() => failures++)
  assert.equal((await empty.apiFetch('/api/v1/example')).status, 204)

  const controller = new AbortController()
  controller.abort()
  const cancelled = createApiTransport({ fetchImpl: async (_, options) => {
    options.signal.throwIfAborted()
  } })
  cancelled.subscribeUnavailable(() => failures++)
  await assert.rejects(cancelled.apiFetch('/api/v1/example', { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(failures, 0)
})
