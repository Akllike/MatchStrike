import test from 'node:test'
import assert from 'node:assert/strict'
import { positionTooltip } from '../src/tooltipPosition.mjs'

test('tooltip is centered above its target when there is room', () => {
  assert.deepEqual(positionTooltip({ left: 200, right: 240, top: 200, bottom: 240 }, { width: 120, height: 40 }, { width: 500, height: 400 }), { x: 160, y: 152 })
})

test('tooltip flips below a target near the top edge', () => {
  assert.deepEqual(positionTooltip({ left: 200, right: 240, top: 10, bottom: 40 }, { width: 120, height: 40 }, { width: 500, height: 400 }), { x: 160, y: 48 })
})

test('tooltip stays inside the viewport at both horizontal edges', () => {
  const bubble = { width: 200, height: 40 }
  const viewport = { width: 320, height: 400 }
  assert.equal(positionTooltip({ left: 0, right: 20, top: 200, bottom: 220 }, bubble, viewport).x, 12)
  assert.equal(positionTooltip({ left: 300, right: 320, top: 200, bottom: 220 }, bubble, viewport).x, 108)
})

test('tooltip respects zoomed visual viewport offsets and short screens', () => {
  const position = positionTooltip({ left: 110, right: 140, top: 230, bottom: 240 }, { width: 170, height: 150 }, { left: 100, top: 200, width: 200, height: 180 })
  assert.deepEqual(position, { x: 112, y: 218 })
})
