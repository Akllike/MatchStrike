export const ALERT_DURATION_MS = 7000

export function createAlertQueue({ schedule = setTimeout, cancel = clearTimeout, onChange = () => {} } = {}) {
  const entries = new Map()
  const timers = new Map()
  const publish = () => onChange([...entries.values()])
  function dismiss(key, notify = true) {
    const entry = entries.get(key)
    if (!entry) return
    cancel(timers.get(key))
    timers.delete(key)
    entries.delete(key)
    publish()
    if (notify) entry.onDismiss?.()
  }
  function show(entry) {
    if (!entry.message?.trim()) { dismiss(entry.key, false); return }
    if (timers.has(entry.key)) cancel(timers.get(entry.key))
    entries.set(entry.key, { ...entry })
    timers.set(entry.key, schedule(() => dismiss(entry.key), ALERT_DURATION_MS))
    while (entries.size > 4) dismiss(entries.keys().next().value)
    publish()
  }
  return { show, dismiss }
}
