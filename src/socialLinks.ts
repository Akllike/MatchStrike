import type { SocialPlatform } from './api'

const hosts: Record<SocialPlatform, string> = {
  telegram: 't.me',
  instagram: 'instagram.com',
  youtube: 'youtube.com',
  twitch: 'twitch.tv',
  trovo: 'trovo.live',
  boosty: 'boosty.to',
}

function decoded(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

export function socialIdFromValue(platform: SocialPlatform, value: string | null | undefined): string {
  const raw = value?.trim()
  if (!raw) return ''

  let identifier = raw
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    const hostname = url.hostname.toLowerCase()
    const expectedHost = hosts[platform]
    if (hostname === expectedHost || hostname.endsWith(`.${expectedHost}`)) {
      const segments = url.pathname.split('/').filter(Boolean).map(decoded)
      if (platform === 'youtube') {
        const routeIndex = segments.findIndex((segment) => ['channel', 'c', 'user'].includes(segment.toLowerCase()))
        identifier = routeIndex >= 0 ? segments[routeIndex + 1] ?? '' : segments.at(-1) ?? ''
      } else if (platform === 'trovo') {
        const streamIndex = segments.findIndex((segment) => segment.toLowerCase() === 's')
        identifier = streamIndex >= 0 ? segments[streamIndex + 1] ?? '' : segments.at(-1) ?? ''
      } else {
        identifier = segments.at(-1) ?? ''
      }
    }
  } catch {
    identifier = raw
  }

  identifier = identifier.replace(/^\/+|\/+$/g, '')
  if (platform !== 'youtube') identifier = identifier.replace(/^@/, '')
  return identifier
}

export function socialProfileUrl(platform: SocialPlatform, value: string | null | undefined): string | null {
  const id = socialIdFromValue(platform, value)
  if (!id) return null

  const encoded = encodeURIComponent(id)
  switch (platform) {
    case 'telegram': return `https://t.me/${encoded}`
    case 'instagram': return `https://www.instagram.com/${encoded}/`
    case 'youtube': return `https://www.youtube.com/${id.startsWith('UC') ? `channel/${encoded}` : encoded.startsWith('%40') ? encoded : `%40${encoded}`}`
    case 'twitch': return `https://www.twitch.tv/${encoded}`
    case 'trovo': return `https://trovo.live/s/${encoded}`
    case 'boosty': return `https://boosty.to/${encoded}`
  }
}
