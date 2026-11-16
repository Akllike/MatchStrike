export const ALERT_DURATION_MS: 7000
export type AlertTone = 'success' | 'warning' | 'error'
export interface AlertEntry {
  key: string; message: string; tone?: AlertTone; title?: string
  to?: string; actionLabel?: string; onAction?: () => void; onDismiss?: () => void
}
export function createAlertQueue(options?: {
  schedule?: (callback: () => void, delay: number) => unknown
  cancel?: (timer: unknown) => void
  onChange?: (entries: AlertEntry[]) => void
}): { show(entry: AlertEntry): void; dismiss(key: string, notify?: boolean): void }
