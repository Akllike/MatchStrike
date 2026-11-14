export function positionTooltip(
  anchor: { left: number; right: number; top: number; bottom: number },
  bubble: { width: number; height: number },
  viewport: { width: number; height: number; left?: number; top?: number },
  padding?: number,
  gap?: number,
): { x: number; y: number }
