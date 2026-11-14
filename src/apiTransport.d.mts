export function createApiTransport(options?: {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): {
  apiFetch: typeof fetch
  subscribeUnavailable: (listener: () => void) => () => void
}
export const apiFetch: typeof fetch
export const subscribeUnavailable: (listener: () => void) => () => void
