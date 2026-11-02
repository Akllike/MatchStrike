import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

// Keep app navigation available offline while leaving API requests network-only.
registerRoute(new NavigationRoute(
  createHandlerBoundToURL('/index.html'),
  { denylist: [/^\/api(?:\/|$)/] },
))

// Update only after the user confirms in the in-app update alert.
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
    icon: '/icons/matchstrike.svg',
    badge: '/icons/matchstrike.svg',
    tag: payload.tag || 'matchstrike-notification',
    data: { url: payload.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        void client.navigate(target)
        return client.focus()
      }
    }
    return self.clients.openWindow(target)
  }))
})
