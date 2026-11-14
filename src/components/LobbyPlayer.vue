<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Crown, UserMinus, Users } from '@lucide/vue'
import type { LobbyMember } from '../api'
import { positionTooltip } from '../tooltipPosition.mjs'

const props = defineProps<{ member: LobbyMember; captain: boolean; me: boolean; canKick: boolean; busy: boolean; showConnection: boolean }>()
defineEmits<{ kick: [userId: number] }>()
const anchor = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const opened = ref(false)
const point = ref({ x: 0, y: 0 })
const level = computed(() => {
  const value = props.member.statistics?.level
  return value && value >= 1 && value <= 10 ? value : 0
})
const format = (value: number | null | undefined, decimals = 1, suffix = '') => value == null ? '—' : value.toFixed(decimals) + suffix
const metrics = computed(() => {
  const s = props.member.statistics
  return [
    ['Матчи', format(s?.matches, 0)], ['Winrate', format(s?.winrate, 1, '%')],
    ['K/D', format(s?.kdr, 2)], ['HS', format(s?.hs, 1, '%')],
    ['ADR', format(s?.adr)], ['AVG', format(s?.avg)], ['KAST', format(s?.kast, 1, '%')],
  ]
})
function close() { opened.value = false }
async function show() {
  opened.value = true
  await nextTick()
  if (!opened.value || !anchor.value || !panel.value) return
  point.value = positionTooltip(anchor.value.getBoundingClientRect(), panel.value.getBoundingClientRect(), {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
    left: window.visualViewport?.offsetLeft ?? 0, top: window.visualViewport?.offsetTop ?? 0,
  })
}
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') close() }
function pointerdown(event: PointerEvent) { if (!anchor.value?.contains(event.target as Node)) close() }
onMounted(() => {
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
  window.addEventListener('keydown', keydown)
  window.addEventListener('pointerdown', pointerdown)
})
onUnmounted(() => {
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('pointerdown', pointerdown)
})
</script>

<template>
  <div class="lobby-player-row">
    <img v-if="member.avatarUrl" class="player-avatar" :src="member.avatarUrl" alt="" />
    <span v-else class="player-avatar placeholder"><Users :size="19" /></span>
    <div class="player-name">
      <div class="name-line"><button ref="anchor" type="button" :aria-describedby="opened ? `lobby-player-${member.userId}` : undefined"
        @pointerenter="event => { if (event.pointerType !== 'touch') show() }" @pointerleave="close" @focus="show" @blur="close"
        @click="show">{{ member.nickname }}</button><Crown v-if="captain" :size="14" v-tooltip="'Капитан комнаты'" /></div>
      <small>{{ me ? 'Это вы' : 'Участник' }}</small>
    </div>
    <div class="player-rating" v-tooltip="level ? `Уровень ${level}` : 'Уровень Unknown: статистики пока нет'">
      <img :src="`/icons/levels/level-${level}.svg`" :alt="level ? `Уровень ${level}` : 'Unknown'" />
      <span>{{ member.statistics?.elo ?? '—' }}<small>ELO</small></span>
    </div>
    <span v-if="showConnection" class="connection" :class="{ connected: member.connected }" v-tooltip="member.connected ? 'На игровом сервере' : 'Ожидаем подключения'"></span>
    <button v-if="canKick" class="player-kick" type="button" :disabled="busy" :aria-label="`Исключить ${member.nickname}`" v-tooltip="'Исключить из комнаты · вход будет закрыт на 15 секунд'" @click="$emit('kick', member.userId)"><UserMinus :size="17" /></button>
  </div>
  <Teleport to="body">
    <div v-if="opened" :id="`lobby-player-${member.userId}`" ref="panel" class="site-tooltip lobby-player-card" role="tooltip" :style="{ left: `${point.x}px`, top: `${point.y}px` }">
      <header><img :src="`/icons/levels/level-${level}.svg`" alt="" /><div><strong>{{ member.nickname }}</strong><small>War · Статистика игрока</small></div><b>{{ member.statistics?.elo ?? '—' }} <small>ELO</small></b></header>
      <div v-if="member.statistics" class="player-metrics"><div v-for="[label, value] in metrics" :key="label"><span>{{ label }}</span><strong>{{ value }}</strong></div></div>
      <p v-else>Игрок ещё не имеет War-статистики.</p>
    </div>
  </Teleport>
</template>

<style scoped>
.lobby-player-row { display:flex; align-items:center; gap:12px; flex:1; min-width:0; }
.player-avatar { width:34px; height:34px; object-fit:cover; border-radius:50%; flex-shrink:0; }
.placeholder { display:grid; place-items:center; color:var(--muted); background:var(--line-soft); }
.player-name { flex:1; min-width:0; display:grid; gap:6px; }
.name-line { display:flex; align-items:center; gap:6px; min-width:0; }
.name-line svg { color:#d1a644; flex-shrink:0; }
.name-line button { border:0; padding:0; background:none; color:var(--text); font:inherit; font-size:12px; font-weight:700; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.player-name>small { font-size:9px; color:var(--muted); }
.player-rating { display:flex; align-items:center; gap:7px; flex-shrink:0; font-size:13px; font-variant-numeric:tabular-nums; }
.player-rating img { width:28px; height:28px; }
.player-rating span { display:grid; gap:3px; text-align:right; }
.player-rating small { font-size:8px; color:var(--muted); letter-spacing:1px; }
.player-kick { display:grid; place-items:center; padding:6px; border:0; border-radius:7px; background:var(--line-soft); color:var(--muted); cursor:pointer; }
.player-kick:hover { color:#ee7575; background:#ee757515; }
.player-kick:disabled { opacity:.5; cursor:not-allowed; }
.connection { width:7px; height:7px; border-radius:50%; background:var(--subtle); flex-shrink:0; }
.connection.connected { background:#21b68c; }
.lobby-player-card { width:310px; max-width:calc(100vw - 24px); padding:17px; white-space:normal; }
.lobby-player-card header { display:flex; align-items:center; gap:10px; padding-bottom:13px; }
.lobby-player-card header img { width:35px; height:35px; }
.lobby-player-card header div { display:grid; gap:4px; min-width:0; }
.lobby-player-card header strong { overflow-wrap:anywhere; font-size:13px; }
.lobby-player-card header small { font-size:9px; opacity:.65; }
.lobby-player-card header b { margin-left:auto; white-space:nowrap; font-size:16px; }
.player-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
.player-metrics>div { display:grid; gap:5px; padding:9px; border-radius:6px; background:rgb(120 150 180 / .12); }
.player-metrics span { font-size:9px; opacity:.65; }
.player-metrics strong { font-size:14px; font-variant-numeric:tabular-nums; }
.lobby-player-card p { margin:0; font-size:11px; opacity:.7; }
@media(max-width:400px) { .lobby-player-row { gap:8px; }.player-rating { gap:4px; }.player-rating img { width:24px; height:24px; } }
</style>
