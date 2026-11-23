import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()
self.skipWaiting()

// Keep app navigation available offline while leaving API requests network-only.
registerRoute(new NavigationRoute(
  createHandlerBoundToURL('/index.html'),
  { denylist: [/^\/api(?:\/|$)/] },
))

// Support update requests from older clients as well as automatic activation.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('matchstrike-shell-v1'))
})

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { body: event.data?.text() ?? '' } }
  const title = payload.title || 'MatchStrike'
  const options = {
    body: payload.body || 'У вас новое уведомление.',
    icon: '/icons/symbols/original/app-icon-192.png',
    badge: '/icons/symbols/white/symbol-96.png',
    tag: payload.tag || 'matchstrike-notification',
    data: { url: payload.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let target = new URL('/', self.location.origin)
  try {
    const requestedTarget = new URL(event.notification.data?.url || '/', self.location.origin)
    if (requestedTarget.origin === self.location.origin) target = requestedTarget
  } catch {
    // Invalid notification links fall back to the app home page.
  }
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if (new URL(client.url).origin !== self.location.origin || !('focus' in client)) continue
      try {
        await client.navigate(target.href)
        return await client.focus()
      } catch {
        // Open a new app window if the existing one cannot navigate.
      }
    }
    return self.clients.openWindow(target.href)
  })())
})
