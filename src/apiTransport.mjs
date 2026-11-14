export function createApiTransport({ fetchImpl = (...args) => globalThis.fetch(...args), timeoutMs = 15_000 } = {}) {
  let unavailable = false
  const listeners = new Set()

  function reportUnavailable() {
    if (unavailable) return
    unavailable = true
    for (const listener of listeners) listener()
  }

  function subscribeUnavailable(listener) {
    listeners.add(listener)
    if (unavailable) listener()
    return () => { listeners.delete(listener) }
  }

  async function apiFetch(input, options = {}) {
    const controller = new AbortController()
    const callerSignal = options.signal
    const cancel = () => controller.abort(callerSignal.reason)
    if (callerSignal?.aborted) cancel()
    else callerSignal?.addEventListener('abort', cancel, { once: true })
    let timer

    // Race the entire response, including its body, against the deadline.
    // This also handles a server that sends headers and then stops responding.
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('API response timed out'))
      }, timeoutMs)
    })

    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl(input, { ...options, signal: controller.signal })
          if (response.status >= 500) reportUnavailable()
          if (response.ok && response.status !== 204 && response.status !== 205) {
            // A proxy may return its HTML fallback with HTTP 200 when the API is down.
            await response.clone().json()
          }
          return response
        })(),
        deadline,
      ])
    } catch (error) {
      if (!callerSignal?.aborted) reportUnavailable()
      throw error
    } finally {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', cancel)
    }
  }

  return { apiFetch, subscribeUnavailable }
}

export const { apiFetch, subscribeUnavailable } = createApiTransport()
