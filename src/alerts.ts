import { shallowRef } from 'vue'
import { createAlertQueue } from './alertQueue.mjs'
import type { AlertEntry } from './alertQueue.mjs'

export const siteAlerts = shallowRef<AlertEntry[]>([])
export const alertQueue = createAlertQueue({ onChange: entries => { siteAlerts.value = entries } })
