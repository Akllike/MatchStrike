export function positionTooltip(anchor, bubble, viewport, padding = 12, gap = 8) {
  const left = (viewport.left ?? 0) + padding
  const top = (viewport.top ?? 0) + padding
  const right = (viewport.left ?? 0) + viewport.width - padding
  const bottom = (viewport.top ?? 0) + viewport.height - padding
  const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)))
  const above = anchor.top - gap - bubble.height
  const below = anchor.bottom + gap
  const placeAbove = above >= top || (below + bubble.height > bottom && anchor.top - top >= bottom - anchor.bottom)
  return {
    x: clamp((anchor.left + anchor.right - bubble.width) / 2, left, right - bubble.width),
    y: clamp(placeAbove ? above : below, top, bottom - bubble.height),
  }
}
