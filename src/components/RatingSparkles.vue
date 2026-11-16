<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ source: HTMLElement | null; level: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
type Sparkle = { start: number; x: number; y: number; vx: number; vy: number; fall: number; size: number; life: number; angle: number; spin: number; tint: string }
const sparkles: Sparkle[] = []
// Accent colours match the rings in /icons/levels/level-*.svg.
const colors = computed(() => {
  if (props.level === 10) return ['#FE1F00', '#ff9a7b', '#cd1c0d']
  if (props.level === 8 || props.level === 9) return ['#FF6309', '#ffb77d', '#e24c00']
  if (props.level >= 4 && props.level <= 7) return ['#FFC800', '#fff2a1', '#eaa600']
  if (props.level === 2 || props.level === 3) return ['#1CE400', '#bbffa2', '#16b500']
  return ['#EEEEEE', '#ffffff', '#cbd5e1']
})
let context: CanvasRenderingContext2D | null = null
let glint: Path2D | undefined
let motion: MediaQueryList | undefined
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
let frame = 0
let burstStarted = false
let pausedAt: number | null = null
let visible = false
let width = 0
let height = 0
let originX = 0
let originY = 0

function pause() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  pausedAt ??= performance.now()
  context?.clearRect(0, 0, width, height)
}

function burst(now: number) {
  for (let i = 0; i < 56; i++) {
    const direction = Math.random() * Math.PI * 2
    const speed = 180 + Math.random() * Math.min(width * 1.2, 330)
    sparkles.push({ start: now + 160, x: originX, y: originY,
      vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed * .5,
      fall: 7 + Math.random() * 9, size: 2 + Math.random() * 3.8,
      life: 7 + Math.random() * 3, angle: Math.random() * Math.PI, spin: (Math.random() - .5) * .65,
      tint: colors.value[i % colors.value.length]! })
  }
}

function animate(now: number) {
  if (!context || !glint) return
  frame = 0
  context.clearRect(0, 0, width, height)
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const sparkle = sparkles[i]!
    if (now < sparkle.start) continue
    const time = Math.max(0, (now - sparkle.start) / 1000)
    // A quick radial burst loses momentum, then turns into a slow fall.
    const expansion = (1 - Math.exp(-2.8 * time)) / 2.8
    const x = sparkle.x + sparkle.vx * expansion - 2 * time
    const y = sparkle.y + sparkle.vy * expansion + sparkle.fall * time + 1.4 * time ** 2
    if (time >= sparkle.life || y > height + 12) {
      sparkles.splice(i, 1)
      continue
    }
    context.save()
    context.translate(x, y)
    context.rotate(sparkle.angle + sparkle.spin * time)
    context.scale(sparkle.size, sparkle.size)
    context.globalAlpha = Math.min(1, time * 10, (sparkle.life - time) / 1.8) * .8
    context.fillStyle = sparkle.tint
    context.shadowColor = sparkle.tint
    context.shadowBlur = 4
    context.fill(glint)
    context.restore()
  }
  if (sparkles.length) frame = requestAnimationFrame(animate)
}

function syncAnimation() {
  if (!visible || document.hidden || motion?.matches || !props.source || !width || !height) {
    pause()
    return
  }
  if (!frame && context && glint) {
    const now = performance.now()
    if (pausedAt !== null) {
      for (const sparkle of sparkles) sparkle.start += now - pausedAt
      pausedAt = null
    }
    if (!burstStarted) {
      burstStarted = true
      burst(now)
    }
    if (sparkles.length) frame = requestAnimationFrame(animate)
  }
}

function resize() {
  if (!canvas.value || !context) return
  const bounds = canvas.value.getBoundingClientRect()
  const source = props.source?.getBoundingClientRect()
  const previousX = originX
  const previousY = originY
  width = bounds.width
  height = bounds.height
  originX = source ? source.left + source.width / 2 - bounds.left : width - 36
  originY = source ? source.top + source.height / 2 - bounds.top : 40
  for (const sparkle of sparkles) {
    sparkle.x += originX - previousX
    sparkle.y += originY - previousY
  }
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const pixelWidth = Math.round(width * ratio)
  const pixelHeight = Math.round(height * ratio)
  if (canvas.value.width === pixelWidth && canvas.value.height === pixelHeight) {
    syncAnimation()
    return
  }
  canvas.value.width = pixelWidth
  canvas.value.height = pixelHeight
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  syncAnimation()
}

watch(() => props.source, resize, { flush: 'post' })
watch(colors, palette => {
  sparkles.forEach((sparkle, index) => { sparkle.tint = palette[index % palette.length]! })
})
onMounted(() => {
  context = canvas.value?.getContext('2d') ?? null
  if (!context || !canvas.value) return
  glint = new Path2D('M0,-1 Q.12,-.15 .22,-.16 L1,0 L.22,.16 Q.12,.15 0,1 Q-.12,.15 -.22,.16 L-1,0 L-.22,-.16 Q-.12,-.15 0,-1Z')
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', syncAnimation)
  document.addEventListener('visibilitychange', syncAnimation)
  window.addEventListener('resize', resize)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  intersectionObserver = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    syncAnimation()
  })
  intersectionObserver.observe(canvas.value)
  resize()
})
onBeforeUnmount(() => {
  pause()
  sparkles.length = 0
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  motion?.removeEventListener('change', syncAnimation)
  document.removeEventListener('visibilitychange', syncAnimation)
  window.removeEventListener('resize', resize)
})
</script>

<template><canvas ref="canvas" class="rating-sparkles" aria-hidden="true"></canvas></template>

<style scoped>
.rating-sparkles { position:absolute; z-index:1; inset:0; display:block; width:100%; height:100%; pointer-events:none; }
</style>
