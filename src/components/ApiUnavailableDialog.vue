<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RefreshCw, X } from '@lucide/vue'
import { subscribeUnavailable } from '../apiTransport.mjs'

const dialog = ref<HTMLDialogElement | null>(null)
let unsubscribe: (() => void) | undefined

onMounted(() => {
  unsubscribe = subscribeUnavailable(() => {
    if (!dialog.value?.open) dialog.value?.showModal()
  })
})

onBeforeUnmount(() => {
  unsubscribe?.()
  dialog.value?.close()
})

function reloadPage() {
  window.location.reload()
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="api-unavailable-dialog" aria-labelledby="api-unavailable-title" aria-describedby="api-unavailable-description">
      <button class="api-unavailable-close" type="button" aria-label="Закрыть окно" @click="dialog?.close()"><X :size="20" /></button>
      <img class="api-unavailable-image" src="/other/cat-cat-dance.gif" alt="Танцующий кот" width="240" height="240" />
      <div class="api-unavailable-copy">
        <span class="api-unavailable-label">Небольшой перерыв</span>
        <h2 id="api-unavailable-title">Сайт не отвечает</h2>
        <p id="api-unavailable-description">Попробуйте обновить страницу. Если проблема не исчезнет, обратитесь к администрации.</p>
        <button type="button" autofocus @click="reloadPage"><RefreshCw :size="16" /> Обновить страницу</button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.api-unavailable-dialog { position: fixed; inset: 0; width: min(420px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); margin: auto; padding: 24px; overflow-y: auto; border: 0; border-radius: 20px; color: var(--text); background: var(--panel); box-shadow: 0 24px 90px rgb(0 0 0 / .4); text-align: center; }
.api-unavailable-dialog::backdrop { background: rgb(3 10 20 / .78); backdrop-filter: blur(6px); }
.api-unavailable-image { display: block; width: min(220px, 100%); height: auto; max-height: 30dvh; margin: 0 auto 20px; object-fit: contain; }
.api-unavailable-copy { display: grid; justify-items: center; gap: 12px; }
.api-unavailable-label { color: var(--muted); font-size: 11px; font-weight: 600; }
.api-unavailable-dialog h2 { margin: 0; font-size: 24px; font-weight: 750; line-height: 1.2; }
.api-unavailable-dialog p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.7; }
.api-unavailable-dialog button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; padding: 12px 20px; border: 0; border-radius: 10px; color: #082334; background: #67d2ed; font-size: 13px; font-weight: 700; cursor: pointer; }
.api-unavailable-dialog button:hover { background: #8adef1; }
.api-unavailable-dialog button:focus-visible { outline: 2px solid var(--text); outline-offset: 4px; }
.api-unavailable-dialog .api-unavailable-close { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; margin: 0; padding: 0; color: var(--muted); background: transparent; }
.api-unavailable-dialog .api-unavailable-close:hover { color: var(--text); background: var(--surface-tint); }
</style>
