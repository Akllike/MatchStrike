export function matchMapImage(map: string): string | null {
  const match = /^(?:(de|cs)_)?([a-z0-9]+)(?:_[a-z0-9]+)*$/i.exec(map.trim())
  if (!match) return null
  const prefix = (match[1] || 'de').toLowerCase()
  return `/uploads/maps/${prefix}_${match[2].toLowerCase()}.webp`
}

export function handleMapImageError(event: Event): void {
  const image = event.currentTarget
  if (!(image instanceof HTMLImageElement)) return
  image.style.visibility = 'hidden'
  console.warn('Изображение карты недоступно:', image.src)
}
