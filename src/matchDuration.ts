export function formatMatchDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—'
  const totalMinutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours} ч ${String(minutes).padStart(2, '0')} мин`
  if (totalMinutes > 0) return `${totalMinutes} мин ${String(remainingSeconds).padStart(2, '0')} сек`
  return `${remainingSeconds} сек`
}
