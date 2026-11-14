import type { ObjectDirective } from 'vue'
import { positionTooltip } from './tooltipPosition.mjs'

const tooltipId = 'matchstrike-tooltip'
const texts = new WeakMap<HTMLElement, string>()
const cleanups = new WeakMap<HTMLElement, () => void>()
let active: HTMLElement | null = null
let panel: HTMLDivElement | null = null
let timer: ReturnType<typeof setTimeout> | undefined

function hide() {
  clearTimeout(timer)
  if (active) {
    const ids = (active.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== tooltipId)
    if (ids.length) active.setAttribute('aria-describedby', ids.join(' '))
    else active.removeAttribute('aria-describedby')
  }
  active = null
  if (panel) {
    if (typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover()
    panel.hidden = true
  }
  window.removeEventListener('scroll', hide, true)
  window.removeEventListener('resize', hide)
  window.removeEventListener('keydown', onKeydown, true)
  window.visualViewport?.removeEventListener('resize', hide)
  window.visualViewport?.removeEventListener('scroll', hide)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    hide()
  }
}

function show(element: HTMLElement, delay: number) {
  if (active === element) return
  hide()
  const text = texts.get(element)
  if (!text) return
  active = element
  window.addEventListener('scroll', hide, true)
  window.addEventListener('resize', hide)
  window.addEventListener('keydown', onKeydown, true)
  window.visualViewport?.addEventListener('resize', hide)
  window.visualViewport?.addEventListener('scroll', hide)
  timer = setTimeout(() => {
    if (active !== element || !element.isConnected) { hide(); return }
    if (!panel) {
      panel = document.createElement('div')
      panel.id = tooltipId
      panel.className = 'site-tooltip'
      panel.setAttribute('role', 'tooltip')
      panel.setAttribute('popover', 'manual')
    }
    // Popovers render above native dialogs; older browsers use the dialog itself.
    const host = typeof panel.showPopover === 'function' ? document.body : element.closest('dialog[open]') ?? document.body
    host.appendChild(panel)
    panel.textContent = texts.get(element) ?? ''
    const viewport = {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
      left: window.visualViewport?.offsetLeft ?? 0,
      top: window.visualViewport?.offsetTop ?? 0,
    }
    panel.style.maxWidth = `${Math.max(0, Math.min(300, viewport.width - 24))}px`
    panel.style.maxHeight = `${Math.max(0, viewport.height - 24)}px`
    panel.hidden = false
    if (typeof panel.showPopover === 'function') panel.showPopover()
    const point = positionTooltip(element.getBoundingClientRect(), panel.getBoundingClientRect(), viewport)
    panel.style.left = `${point.x}px`
    panel.style.top = `${point.y}px`
    const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    element.setAttribute('aria-describedby', [...new Set([...ids, tooltipId])].join(' '))
  }, delay)
}

export const tooltip: ObjectDirective<HTMLElement, string | null | undefined> = {
  mounted(element, { value }) {
    texts.set(element, value ?? '')
    const enter = (event: PointerEvent) => { if (event.pointerType !== 'touch') show(element, 220) }
    const leave = () => { if (active === element && !element.matches(':focus-visible')) hide() }
    const focus = () => { if (element.matches(':focus-visible')) show(element, 0) }
    const dismiss = () => { if (active === element) hide() }
    element.addEventListener('pointerenter', enter)
    element.addEventListener('pointerleave', leave)
    element.addEventListener('focusin', focus)
    element.addEventListener('focusout', dismiss)
    element.addEventListener('pointerdown', dismiss)
    element.addEventListener('input', dismiss)
    cleanups.set(element, () => {
      dismiss()
      element.removeEventListener('pointerenter', enter)
      element.removeEventListener('pointerleave', leave)
      element.removeEventListener('focusin', focus)
      element.removeEventListener('focusout', dismiss)
      element.removeEventListener('pointerdown', dismiss)
      element.removeEventListener('input', dismiss)
      texts.delete(element)
    })
  },
  updated(element, { value, oldValue }) {
    texts.set(element, value ?? '')
    if (active === element && value !== oldValue) {
      hide()
      if (value) show(element, 0)
    }
  },
  beforeUnmount(element) {
    cleanups.get(element)?.()
    cleanups.delete(element)
  },
}
