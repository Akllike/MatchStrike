<script setup lang="ts">
import { computed, ref } from 'vue'
import { Crosshair, Repeat2, HeartPulse, Sparkles } from '@lucide/vue'
import type { DonutPlayerStatsSummary } from '../api'

const props = defineProps<{ stats: DonutPlayerStatsSummary }>()
const active = ref('opening')
const value = (key: string) => Math.max(0, props.stats.totals[key] ?? 0)
const percent = (n: number, d: number) => d > 0 ? Math.min(100, n / d * 100) : 0
const lenses = computed(() => [
  { id: 'opening', title: 'Первые дуэли', icon: Crosshair, color: '#38bdf8', rate: percent(value('openingKills'), value('openingKills') + value('openingDeaths')), denominator: value('openingKills') + value('openingDeaths'), caption: 'выигранных дуэлей', description: 'Как игрок начинает раунд и создаёт численное преимущество.', items: [
    { label: 'Первые убийства', value: value('openingKills'), max: value('openingKills') + value('openingDeaths') },
    { label: 'Первые смерти', value: value('openingDeaths'), max: value('openingKills') + value('openingDeaths') },
    { label: 'Первые смерти разменяны', value: value('openingDeathsTraded'), max: value('openingDeaths') },
  ] },
  { id: 'trading', title: 'Размены', icon: Repeat2, color: '#a78bfa', rate: percent(value('deathsTraded'), value('tradeableDeaths')), denominator: value('tradeableDeaths'), caption: 'смертей разменяны', description: 'Взаимодействие с командой: ответные убийства и размены смертей.', items: [
    { label: 'Trade-убийства', value: value('tradeKills'), max: value('kills') },
    { label: 'Разменянные смерти', value: value('deathsTraded'), max: value('tradeableDeaths') },
    { label: 'Убийства с поддержкой', value: value('killsAssisted'), max: value('kills') },
  ] },
  { id: 'survival', title: 'Влияние на раунд', icon: HeartPulse, color: '#34d399', rate: percent(value('kastRounds'), value('rounds')), denominator: value('rounds'), caption: 'KAST', description: 'Раунды с убийством, ассистом, выживанием или разменянной смертью.', items: [
    { label: 'Раунды с убийством', value: value('roundsWithKill'), max: value('rounds') },
    { label: 'Раунды KAST', value: value('kastRounds'), max: value('rounds') },
    { label: 'Выживание в постпленте', value: value('alivePostPlantRounds'), max: value('postPlantRounds') },
  ] },
  { id: 'utility', title: 'Гранаты', icon: Sparkles, color: '#fbbf24', rate: percent(value('flashesThrown'), value('smokesThrown') + value('flashesThrown') + value('heGrenadesThrown')), denominator: value('smokesThrown') + value('flashesThrown') + value('heGrenadesThrown'), caption: 'доля флешек', description: 'Какие гранаты игрок использует чаще всего. Каждая полоса показывает долю бросков.', items: [
    { label: 'Дымовые', value: value('smokesThrown'), max: value('smokesThrown') + value('flashesThrown') + value('heGrenadesThrown') },
    { label: 'Световые', value: value('flashesThrown'), max: value('smokesThrown') + value('flashesThrown') + value('heGrenadesThrown') },
    { label: 'HE', value: value('heGrenadesThrown'), max: value('smokesThrown') + value('flashesThrown') + value('heGrenadesThrown') },
  ] },
])
const selected = computed(() => lenses.value.find(item => item.id === active.value) ?? lenses.value[0])
const multikills = computed(() => [
  { label: 'Трипл', subtitle: '3 убийства', value: value('tripleKills') },
  { label: 'Квадро', subtitle: '4 убийства', value: value('quadKills') },
  { label: 'Эйс', subtitle: '5 убийств', value: value('aceKills') },
])
</script>

<template>
  <div class="advanced-dashboard">
    <div class="advanced-lenses">
      <button v-for="lens in lenses" :key="lens.id" type="button" :aria-pressed="active === lens.id" :style="{ '--lens-color': lens.color }" @click="active = lens.id">
        <component :is="lens.icon" :size="17" /><span>{{ lens.title }}</span><strong>{{ lens.denominator ? `${lens.rate.toFixed(1)}%` : '—' }}</strong>
      </button>
    </div>
    <section class="advanced-focus" :style="{ '--lens-color': selected.color }" aria-live="polite">
      <div class="advanced-focus-copy"><span class="section-kicker">PLAYER INSIGHT</span><h3>{{ selected.title }}</h3><p>{{ selected.description }}</p><div class="advanced-ring" :style="{ background: `conic-gradient(${selected.color} ${selected.rate}%, var(--line-soft) 0)` }"><div><strong>{{ selected.denominator ? `${selected.rate.toFixed(1)}%` : '—' }}</strong><small>{{ selected.caption }}</small></div></div></div>
      <div class="advanced-bars"><div v-for="item in selected.items" :key="item.label"><div><span>{{ item.label }}</span><strong>{{ item.value }} <small>/ {{ item.max }}</small></strong></div><i><b :style="{ width: `${percent(item.value, item.max)}%` }"></b></i><small>{{ item.max ? `${percent(item.value, item.max).toFixed(1)}%` : 'Нет данных для расчёта' }}</small></div></div>
    </section>
    <section class="advanced-multikills"><header><span class="section-kicker">MULTI-KILLS</span><h3>Раунды, которые запоминаются</h3><p>Количество раундов с тремя и более убийствами</p></header><article v-for="(item, index) in multikills" :key="item.label"><span>{{ '✦'.repeat(index + 1) }}</span><strong>{{ item.value }}</strong><b>{{ item.label }}</b><small>{{ item.subtitle }}</small></article></section>
  </div>
</template>

<style scoped>
.advanced-dashboard { display:grid; gap:16px; margin-bottom:22px; }
.advanced-lenses { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
.advanced-lenses button { display:flex; align-items:center; flex-wrap:wrap; gap:9px; padding:17px; border:0; border-radius:13px; background:var(--panel); color:var(--muted); text-align:left; box-shadow:var(--shadow-soft); cursor:pointer; transition:background .2s,transform .2s; }
.advanced-lenses button svg { color:var(--lens-color); }
.advanced-lenses button span { font-size:10px; flex:1; }
.advanced-lenses button strong { width:100%; color:var(--text); font-size:25px; letter-spacing:-.8px; }
.advanced-lenses button[aria-pressed=true] { background:var(--surface-tint); transform:translateY(-3px); box-shadow:inset 0 -2px var(--lens-color),var(--shadow-soft); }
.advanced-focus { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.1fr); gap:32px; padding:26px; border-radius:17px; background:var(--panel); box-shadow:var(--shadow-soft); }
.advanced-focus h3,.advanced-multikills h3 { margin:7px 0; color:var(--text); font-size:18px; letter-spacing:-.5px; }
.advanced-focus p,.advanced-multikills p { color:var(--muted); font-size:11px; line-height:1.7; max-width:330px; }
.advanced-ring { display:grid; place-items:center; width:156px; height:156px; padding:7px; border-radius:50%; margin:23px auto 0; }
.advanced-ring>div { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:50%; background:var(--panel); }
.advanced-ring strong { color:var(--text); font-size:29px; letter-spacing:-1px; }.advanced-ring small { max-width:100px; margin-top:5px; color:var(--muted); text-align:center; font-size:9px; }
.advanced-bars { display:flex; flex-direction:column; justify-content:center; gap:27px; }.advanced-bars>div>div { display:flex; justify-content:space-between; gap:12px; margin-bottom:10px; color:var(--text); font-size:11px; }.advanced-bars strong { font-size:15px; }.advanced-bars small { color:var(--subtle); font-size:9px; font-weight:400; }.advanced-bars i { display:block; height:7px; overflow:hidden; border-radius:8px; background:var(--line-soft); margin-bottom:7px; }.advanced-bars b { display:block; height:100%; background:var(--lens-color); border-radius:inherit; transition:width .3s; }
.advanced-multikills { display:grid; grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(0,1fr)); align-items:center; gap:12px; padding:23px; border-radius:17px; background:var(--panel); box-shadow:var(--shadow-soft); }.advanced-multikills article { display:flex; flex-direction:column; align-items:center; gap:5px; padding:12px; border-radius:12px; background:var(--surface-tint); }.advanced-multikills article>span { color:#fbbf24; font-size:9px; letter-spacing:3px; }.advanced-multikills article strong { color:var(--text); font-size:29px; }.advanced-multikills article b { color:var(--text); font-size:11px; }.advanced-multikills article small { color:var(--muted); font-size:9px; }
@media(max-width:640px) { .advanced-lenses { grid-template-columns:repeat(2,minmax(0,1fr)); }.advanced-lenses button { padding:13px; }.advanced-focus { grid-template-columns:1fr; padding:19px; gap:25px; }.advanced-focus-copy { text-align:center; }.advanced-focus p { margin:auto; }.advanced-multikills { grid-template-columns:repeat(3,minmax(0,1fr)); padding:16px; gap:7px; }.advanced-multikills header { grid-column:1/-1; margin-bottom:7px; }.advanced-multikills article { padding:11px 4px; } }
</style>
