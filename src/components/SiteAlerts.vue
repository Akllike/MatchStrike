<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { Check, CircleAlert, X } from '@lucide/vue'
import { alertQueue, siteAlerts } from '../alerts'

// Native modal dialogs occupy the browser's top layer. Mount alerts inside the
// open dialog so their close buttons and links remain visible and interactive.
const target = shallowRef<HTMLElement>(document.body)
let observer: MutationObserver | undefined
let leavingCount = 0
let leavingContainer: HTMLElement | null = null
function beforeLeave(element: Element) {
  const container = element.parentElement
  if (!container) return
  // Leaving cards are absolute so other alerts can slide into place. Keep the
  // stack open until fading finishes, including when its last card disappears.
  container.style.minHeight = `${container.getBoundingClientRect().height}px`
  leavingContainer = container
  leavingCount++
}
function afterLeave() {
  leavingCount = Math.max(0, leavingCount - 1)
  if (!leavingCount && leavingContainer) {
    leavingContainer.style.minHeight = ''
    leavingContainer = null
  }
}
function locateTarget() {
  target.value = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) ?? document.body
}
onMounted(() => {
  locateTarget()
  observer = new MutationObserver(locateTarget)
  observer.observe(document.body,{ childList:true,subtree:true,attributes:true,attributeFilter:['open'] })
})
onBeforeUnmount(() => observer?.disconnect())
function action(key: string) {
  const alert = siteAlerts.value.find(item => item.key === key)
  alert?.onAction?.()
  alertQueue.dismiss(key)
}
</script>

<template>
  <Teleport :to="target">
    <TransitionGroup name="site-alert" tag="div" class="site-alert-stack" aria-label="Уведомления сайта" @before-leave="beforeLeave" @after-leave="afterLeave" @leave-cancelled="afterLeave">
      <div v-for="alert in siteAlerts" :key="alert.key" class="profile-toast site-alert-card" :class="`is-${alert.tone || 'error'}`" :role="alert.tone==='error' || !alert.tone ? 'alert' : 'status'" aria-atomic="true">
        <span class="profile-toast-icon"><Check v-if="alert.tone==='success'" :size="18" /><CircleAlert v-else :size="18" /></span>
        <div class="site-alert-copy"><strong>{{ alert.title || (alert.tone==='success'?'Готово':alert.tone==='warning'?'Обратите внимание':'Не удалось выполнить действие') }}</strong><span class="profile-toast-message">{{ alert.message }}</span><RouterLink v-if="alert.to" :to="alert.to" @click="action(alert.key)">{{ alert.actionLabel || 'Перейти' }}</RouterLink><button v-else-if="alert.actionLabel" type="button" @click="action(alert.key)">{{ alert.actionLabel }}</button></div>
        <button class="profile-toast-close" type="button" aria-label="Закрыть уведомление" @click="alertQueue.dismiss(alert.key)"><X :size="16" /></button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>
