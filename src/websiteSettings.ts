import { readonly, ref } from 'vue'
import { getWebsiteSettings } from './api'
import type { WebsiteSettings } from './api'

const state = ref<WebsiteSettings>({
  name: 'MatchStrike', tagline: 'CS COMMUNITY', description: 'Матчи сообщества, игровые серверы и статистика игроков — в одном месте.',
  serversLimit: 12, mixMatchesLimit: 5, warMatchesLimit: 5, lobbyEnabled: true, logoLight: null, logoDark: null, faq: [],
})
export const websiteSettings = readonly(state)
let loaded = false
let pending: Promise<void> | null = null
export function applyWebsiteSettings(settings: WebsiteSettings) {
  state.value = settings
  document.title = `${settings.name} — ${settings.tagline}`
  document.querySelector('meta[name="description"]')?.setAttribute('content', settings.description)
}
export function loadWebsiteSettings(): Promise<void> {
  if (loaded) return Promise.resolve()
  if (pending) return pending
  pending = getWebsiteSettings().then(settings => { applyWebsiteSettings(settings); loaded = true })
    .catch(() => { /* The API outage dialog handles failures; navigation remains available. */ })
    .finally(() => { pending = null })
  return pending
}
