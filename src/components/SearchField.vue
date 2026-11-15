<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Search, X } from '@lucide/vue'

defineProps<{ label: string; placeholder?: string; disabled?: boolean; maxlength?: number; id?: string }>()
const [model, modifiers] = defineModel<string, 'trim'>({
  default: '',
  set: value => modifiers.trim ? value.trim() : value,
})
const input = ref<HTMLInputElement | null>(null)
async function clear() {
  model.value = ''
  await nextTick()
  input.value?.focus()
}
</script>

<template>
  <div class="site-search" :class="{ 'is-disabled': disabled }">
    <Search :size="16" aria-hidden="true" />
    <input :id="id" ref="input" v-model="model" class="site-search-input" type="search" :aria-label="label" :placeholder="placeholder ?? label"
      :disabled="disabled" :maxlength="maxlength" autocomplete="off" />
    <button v-if="model" type="button" :disabled="disabled" aria-label="Очистить поиск" @click="clear"><X :size="16" /></button>
  </div>
</template>

<style scoped>
.site-search { display:flex; align-items:center; gap:10px; flex:0 1 420px; width:100%; max-width:420px; min-width:0; min-height:42px; box-sizing:border-box; padding:0 13px; border:0; border-radius:10px; color:var(--subtle); background:var(--surface-tint); transition:box-shadow .15s; }
.site-search>svg { flex:0 0 auto; }
.site-search input,.site-search input:focus,.site-search input:disabled { flex:1; min-width:0; width:100%; min-height:42px; height:42px; margin:0; padding:0; border:0; border-radius:0; outline:none; box-shadow:none; color:var(--text); background:transparent; font:inherit; font-size:11px; }
.site-search input::placeholder { color:var(--subtle); opacity:1; }
.site-search input:disabled { cursor:wait; opacity:.6; }
.site-search input::-webkit-search-cancel-button { display:none; }
.site-search:focus-within { box-shadow:0 0 0 2px var(--yellow); }
.site-search button { display:grid; flex:0 0 auto; place-items:center; width:25px; height:25px; border:0; border-radius:7px; padding:0; background:transparent; color:var(--muted); cursor:pointer; }
.site-search button:hover:not(:disabled) { color:var(--text); background:var(--panel); }
.site-search button:focus-visible { outline:2px solid var(--yellow); outline-offset:1px; }
.site-search button:disabled { cursor:wait; opacity:.6; }
</style>
