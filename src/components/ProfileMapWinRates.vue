<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Map as MapIcon, Target } from '@lucide/vue'
import type { MapWinRate } from '../api'
import { handleMapImageError, matchMapImage } from '../matchArtwork'

const props = defineProps<{ maps: MapWinRate[] }>()
const track = ref<HTMLElement | null>(null)
const canPrevious = ref(false)
const canNext = ref(false)
const firstVisible = ref(1)
const lastVisible = ref(1)
const scrollable = computed(() => canPrevious.value || canNext.value)
let observer: ResizeObserver | undefined

function updatePosition() {
  const element = track.value
  if (!element) {
    canPrevious.value = false
    canNext.value = false
    return
  }
  const limit = element.scrollWidth - element.clientWidth
  canPrevious.value = element.scrollLeft > 2
  canNext.value = element.scrollLeft < limit - 2
  const viewport = element.getBoundingClientRect()
  const visible = [...element.querySelectorAll<HTMLElement>('.profile-map-card')]
    .map((card, index) => ({ index, bounds: card.getBoundingClientRect() }))
    .filter(({ bounds }) => bounds.left >= viewport.left - 2 && bounds.right <= viewport.right + 2)
  if (visible.length) {
    firstVisible.value = visible[0]!.index + 1
    lastVisible.value = visible[visible.length - 1]!.index + 1
  }
}

function scrollCards(direction: -1 | 1) {
  const element = track.value
  const card = element?.querySelector<HTMLElement>('.profile-map-card')
  if (!element || !card) return
  const gap = parseFloat(getComputedStyle(element).columnGap) || 0
  element.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}

function onKeydown(event: KeyboardEvent) {
  if (event.target !== track.value || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') scrollCards(event.key === 'ArrowLeft' ? -1 : 1)
  else track.value?.scrollTo({ left: event.key === 'Home' ? 0 : track.value.scrollWidth,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}

watch(track, (element, previous) => {
  if (previous) observer?.unobserve(previous)
  if (element) observer?.observe(element)
  updatePosition()
})
watch(() => props.maps, async () => {
  await nextTick()
  track.value?.scrollTo({ left: 0, behavior: 'auto' })
  updatePosition()
})
onMounted(() => {
  observer = new ResizeObserver(updatePosition)
  if (track.value) observer.observe(track.value)
  updatePosition()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section class="profile-map-performance" aria-labelledby="profile-map-performance-title">
    <header class="profile-map-heading">
      <div><div class="section-kicker">MAP PERFORMANCE</div><h3 id="profile-map-performance-title">Винрейт по картам</h3><p>Каждая сыгранная карта · только War</p></div>
      <div class="profile-map-controls">
        <span class="profile-stats-mode-badge"><MapIcon :size="13" /> Карт: {{ maps.length }}</span>
        <div v-if="scrollable" class="profile-map-arrows" role="group" aria-label="Переключение карт">
          <button type="button" :disabled="!canPrevious" aria-label="Предыдущие карты" aria-controls="profile-map-carousel" v-tooltip="'Предыдущие карты'" @click="scrollCards(-1)"><ChevronLeft :size="16" /></button>
          <button type="button" :disabled="!canNext" aria-label="Следующие карты" aria-controls="profile-map-carousel" v-tooltip="'Следующие карты'" @click="scrollCards(1)"><ChevronRight :size="16" /></button>
        </div>
      </div>
    </header>
    <div v-if="maps.length" id="profile-map-carousel" ref="track" class="profile-map-carousel" role="group" aria-roledescription="карусель" aria-label="Винрейт по War-картам" tabindex="0" @scroll.passive="updatePosition" @keydown="onKeydown">
      <article v-for="(map, index) in maps" :key="map.map" class="profile-map-card" role="group" aria-roledescription="карточка" :aria-label="`${index + 1} из ${maps.length}: ${map.map}`">
        <div class="profile-map-art">
          <img v-if="matchMapImage(map.map)" :src="matchMapImage(map.map)!" alt="" loading="lazy" @error="handleMapImageError" />
          <div class="profile-map-shade"></div>
          <strong>{{ map.map }}</strong>
          <span v-if="map.matches < 5" v-tooltip="'Сыграно меньше 5 карт: процент побед ещё может сильно меняться.'" class="profile-map-sample" tabindex="0">Мало матчей</span>
        </div>
        <div class="profile-map-body">
          <div class="profile-map-rate"><div><strong :class="{ 'is-positive': map.winRate >= 50 }">{{ map.winRate.toFixed(1) }}<small>%</small></strong><span>побед</span></div><span>{{ map.matches }} <small>сыграно</small></span></div>
          <div class="profile-map-progress" role="meter" :aria-label="`Винрейт на ${map.map}`" :aria-valuenow="map.winRate" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${map.winRate}%` }"></span></div>
          <div class="profile-map-results"><span><i class="is-win"></i>Победы: {{ map.wins }}</span><span><i class="is-loss"></i>Поражения: {{ map.losses }}</span><span v-if="map.draws"><i></i>Ничьи: {{ map.draws }}</span></div>
        </div>
      </article>
    </div>
    <div v-if="maps.length && scrollable" class="profile-map-carousel-footer"><span>Листайте, чтобы посмотреть остальные карты</span><span aria-live="polite" aria-atomic="true">{{ firstVisible === lastVisible ? firstVisible : `${firstVisible}–${lastVisible}` }} / {{ maps.length }}</span></div>
    <div v-if="!maps.length" class="profile-map-empty"><Target :size="20" /><div><strong>Пока нет результатов по картам</strong><span>Винрейт появится после завершённых War-карт с сохранённым счётом.</span></div></div>
  </section>
</template>

<style scoped>
.profile-map-performance { margin-top:24px; min-width:0; container-type:inline-size; }
.profile-map-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
.profile-map-heading h3 { margin:5px 0; color:var(--text); font-size:16px; font-weight:700; }
.profile-map-heading p { margin:0; color:var(--muted); font-size:11px; }
.profile-map-controls { display:flex; align-items:center; gap:10px; flex-shrink:0; }
.profile-map-controls>span { display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
.profile-map-arrows { display:flex; gap:5px; }
.profile-map-arrows button { display:grid; width:28px; height:28px; place-items:center; padding:0; border:0; border-radius:6px; color:var(--muted); background:var(--panel); cursor:pointer; transition:color 150ms ease,background-color 150ms ease; }
.profile-map-arrows button:hover:not(:disabled) { color:var(--yellow); background:var(--surface-tint); }
.profile-map-arrows button:disabled { opacity:.35; cursor:default; }
.profile-map-carousel { display:grid; grid-auto-flow:column; grid-auto-columns:calc((100% - 24px) / 3); align-items:stretch; gap:12px; overflow-x:auto; overscroll-behavior-x:contain; scroll-snap-type:x mandatory; scroll-padding-inline:4px; padding:5px 4px 18px; scrollbar-width:none; }
.profile-map-carousel::-webkit-scrollbar { display:none; }
.profile-map-carousel:focus-visible { outline:2px solid var(--yellow); outline-offset:3px; border-radius:12px; }
.profile-map-card { min-width:0; overflow:hidden; scroll-snap-align:start; border-radius:12px; background:var(--panel); box-shadow:var(--shadow-soft); }
.profile-map-carousel-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:6px; color:var(--subtle); font-size:10px; }
.profile-map-carousel-footer>span:last-child { flex-shrink:0; color:var(--muted); font-variant-numeric:tabular-nums; }
@container(min-width:1040px) { .profile-map-carousel { grid-auto-columns:calc((100% - 36px) / 4); } }
@container(max-width:699px) { .profile-map-carousel { grid-auto-columns:calc((100% - 12px) / 2); } }
@container(max-width:459px) { .profile-map-carousel { grid-auto-columns:86%; }.profile-map-heading { flex-wrap:wrap; }.profile-map-heading p { font-size:10px; }.profile-map-controls { margin-left:auto; }.profile-map-carousel-footer { font-size:9px; } }
.profile-map-art { position:relative; display:flex; min-height:112px; align-items:flex-end; padding:14px; overflow:hidden; background:var(--surface-tint); }
.profile-map-art>img,.profile-map-shade { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.profile-map-art>img { transition:transform 250ms ease; }
.profile-map-card:hover .profile-map-art>img { transform:scale(1.04); }
.profile-map-shade { background:linear-gradient(180deg,rgb(9 18 31 / 12%),rgb(9 18 31 / 87%)); }
.profile-map-art>strong { position:relative; color:#f1f5f9; font-size:12px; font-weight:700; overflow-wrap:anywhere; }
.profile-map-sample { position:absolute; top:10px; right:10px; padding:4px 6px; border-radius:4px; color:#dbeafe; background:rgb(9 18 31 / 75%); font-size:9px; }
.profile-map-body { padding:15px; }
.profile-map-rate,.profile-map-rate>div { display:flex; align-items:baseline; gap:7px; }
.profile-map-rate { justify-content:space-between; }
.profile-map-rate strong { color:var(--text); font-size:27px; font-weight:700; line-height:1.2; font-variant-numeric:tabular-nums; }
.profile-map-rate strong.is-positive { color:var(--yellow); }
.profile-map-rate strong small { margin-left:2px; font-size:14px; }
.profile-map-rate span { color:var(--muted); font-size:10px; }
.profile-map-rate>span { color:var(--text); font-size:13px; font-weight:600; text-align:right; }
.profile-map-rate>span small { display:block; margin-top:2px; color:var(--muted); font-size:9px; font-weight:400; }
.profile-map-progress { height:5px; margin:14px 0 12px; overflow:hidden; border-radius:99px; background:var(--surface-tint); }
.profile-map-progress>span { display:block; height:100%; border-radius:inherit; background:var(--yellow); }
.profile-map-results { display:flex; flex-wrap:wrap; gap:8px 12px; color:var(--muted); font-size:10px; }
.profile-map-results>span { display:inline-flex; align-items:center; gap:5px; }
.profile-map-results i { width:5px; height:5px; border-radius:50%; background:var(--subtle); }
.profile-map-results i.is-win { background:#10b981; }
.profile-map-results i.is-loss { background:#f43f5e; }
.profile-map-empty { display:flex; align-items:center; gap:12px; padding:20px; border-radius:12px; color:var(--yellow); background:var(--panel); box-shadow:var(--shadow-soft); }
.profile-map-empty>div { display:grid; gap:5px; }
.profile-map-empty strong { color:var(--text); font-size:12px; }
.profile-map-empty span { color:var(--muted); font-size:11px; line-height:1.6; }
@media(prefers-reduced-motion:reduce) { .profile-map-art>img { transition:none; }.profile-map-card:hover .profile-map-art>img { transform:none; } }
</style>
