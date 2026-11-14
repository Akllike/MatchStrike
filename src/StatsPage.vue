<script setup lang="ts">
import { Search, X, ChevronLeft, ChevronRight, Activity } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getDonutStatsPlayers, getStatsPlayers } from './api'
import type { DonutStatsLeaderboardPage, StatsPlayersPage } from './api'

interface Player {
  id: string; nickname: string; profileNickname: string | null; avatarUrl: string | null
  score: number; level: number | null; rank: number | null; matches: number | null
  wins: number; losses: number; kills: number; deaths: number; kd: number; headshots: number | null
  avg: number | null; adr: number | null; kast: number | null; winrate: number | null
}
const source = ref<'war' | 'servers'>('war')
const hasServers = ref(false)
const players = ref<Player[]>([])
const search = ref('')
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const loading = ref(true)
const initializing = ref(true)
const error = ref('')
let requestId = 0
let timer: number | undefined
const isWar = computed(() => source.value === 'war')
const pageSize = computed(() => isWar.value ? 50 : 100)
function applyWar(result: DonutStatsLeaderboardPage) {
  players.value = result.players.map(player => ({ ...player, id: String(player.id), score: player.elo, rank: null, kd: player.kdr }))
  page.value = result.pagination.currentPage; lastPage.value = result.pagination.lastPage; total.value = result.pagination.total
}
function applyServers(result: StatsPlayersPage) {
  players.value = result.players.map(player => ({ ...player, id: String(player.id), score: player.points, level: null, matches: null, wins: 0, losses: 0, kd: player.kdr, headshots: null, avg: null, adr: null, kast: null, winrate: null }))
  page.value = result.pagination.currentPage; lastPage.value = result.pagination.lastPage; total.value = result.pagination.total
}
async function loadPage(nextPage = page.value) {
  const id = ++requestId
  loading.value = true; error.value = ''
  try {
    if (isWar.value) {
      const result = await getDonutStatsPlayers(nextPage, search.value.trim())
      if (id === requestId) applyWar(result)
    } else {
      const result = await getStatsPlayers(nextPage, search.value.trim())
      if (id === requestId) applyServers(result)
    }
  } catch {
    if (id === requestId) error.value = 'Не удалось загрузить рейтинг. Попробуйте ещё раз.'
  } finally { if (id === requestId) loading.value = false }
}
function changePage(nextPage: number) {
  if (!loading.value && nextPage >= 1 && nextPage <= lastPage.value) void loadPage(nextPage)
}
function selectSource(next: 'war' | 'servers') {
  if (source.value === next) return
  window.clearTimeout(timer)
  source.value = next; players.value = []; page.value = 1; lastPage.value = 1; total.value = 0
  void loadPage(1)
}
watch(search, () => {
  window.clearTimeout(timer); ++requestId; loading.value = true; error.value = ''
  timer = window.setTimeout(() => { void loadPage(1) }, 300)
})
onMounted(async () => {
  const id = ++requestId
  const [servers, war] = await Promise.allSettled([getStatsPlayers(1), getDonutStatsPlayers(1)])
  if (id !== requestId) return
  hasServers.value = servers.status === 'fulfilled' && servers.value.source === 'third_party'
  if (hasServers.value && servers.status === 'fulfilled') { source.value = 'servers'; applyServers(servers.value) }
  else if (war.status === 'fulfilled') applyWar(war.value)
  else error.value = 'Не удалось загрузить рейтинг. Попробуйте ещё раз.'
  loading.value = false; initializing.value = false
})
onBeforeUnmount(() => { ++requestId; window.clearTimeout(timer) })
</script>

<template>
  <section class="welcome-section route-intro" aria-labelledby="stats-page-title">
    <div class="welcome-copy"><div class="eyebrow"><span class="eyebrow-line"></span> ЦИФРЫ И РЕЗУЛЬТАТЫ <span class="eyebrow-slash">/</span> PLAYER STATS</div><h1 id="stats-page-title">Стати<span>стика</span></h1><p>Общие показатели игроков на всех серверах сообщества: убийства, смерти и очки.</p></div>
    <div class="route-intro-mark"><Activity :size="27" :stroke-width="1.5" /></div>
  </section>
  <section class="content-section route-section" aria-labelledby="player-stats-title">
    <div class="section-heading"><div><div class="section-kicker">{{ isWar ? 'DONUTSTATS / WAR' : 'MATCHSTRIKE / LEADERBOARD' }}</div><h2 id="player-stats-title">{{ isWar ? 'Рейтинг War' : 'Общая статистика игроков' }}</h2></div><span v-if="total" class="section-count">{{ String(total).padStart(2, '0') }} <span>ИГРОКОВ</span></span></div>
    <div v-if="hasServers" class="ranking-source" role="group" aria-label="Источник рейтинга"><button type="button" :aria-pressed="isWar" @click="selectSource('war')">War</button><button type="button" :aria-pressed="!isWar" @click="selectSource('servers')">Серверы</button></div>
    <div class="ranking-card">
      <div class="ranking-toolbar"><label class="ranking-search"><Search :size="16" aria-hidden="true" /><input id="ranking-player-search" v-model="search" :disabled="initializing" type="search" maxlength="100" autocomplete="off" aria-label="Поиск по никнейму или Steam ID" placeholder="Поиск по никнейму или Steam ID" /><button v-if="search" type="button" aria-label="Очистить поиск" @click="search = ''"><X :size="16" /></button></label><span v-if="loading" class="stats-updated" role="status">{{ search.trim() ? 'Ищем игроков…' : 'Загружаем статистику…' }}</span></div>
      <p v-if="!players.length || error" class="stats-no-data" role="status">{{ loading ? 'Загрузка результатов…' : error ? 'Нет данных' : search.trim() ? 'Игроки не найдены' : 'Нет данных' }}</p>
      <div v-else class="player-stats-wrap ranking-table-wrap">
        <table class="player-stats-table stats-player-table">
          <thead><tr><th scope="col">#</th><th scope="col">Игрок</th><template v-if="isWar"><th scope="col">Убийства</th><th scope="col">Смерти</th><th scope="col">ELO</th><th scope="col" v-tooltip="'Количество убийств в голову'">HS</th><th scope="col" v-tooltip="'Убийства / смерти'">KDR</th><th scope="col" v-tooltip="'Среднее число убийств за матч'">AVG</th><th scope="col" v-tooltip="'Средний урон за раунд'">ADR</th><th scope="col" v-tooltip="'Доля раундов с убийством, ассистом, выживанием или разменом'">KAST</th><th scope="col">Матчи</th><th scope="col" v-tooltip="'Доля выигранных матчей'">Winrate</th></template><template v-else><th scope="col">Лучший ранг</th><th scope="col">Убийства</th><th scope="col">Смерти</th><th scope="col">KDR</th><th scope="col">Очки</th></template></tr></thead>
          <tbody><tr v-for="(player,index) in players" :key="player.id">
            <td class="player-rank">{{ String((page - 1) * pageSize + index + 1).padStart(2,'0') }}</td>
            <td class="player-identity"><img v-if="isWar && player.level && player.level >= 1 && player.level <= 10" class="ranking-level-icon" :src="`/icons/levels/level-${player.level}.svg`" :alt="`Уровень ${player.level}`" v-tooltip="`Уровень ${player.level} · ${player.score} ELO`" /><img v-if="player.avatarUrl" class="player-stat-avatar" :src="player.avatarUrl" alt="" /><span v-else class="player-stat-avatar player-stat-initial">{{ player.nickname.slice(0,1).toUpperCase() }}</span><RouterLink v-if="player.profileNickname" class="stats-player-link" :to="{ name: 'profile', params: { nickname: player.profileNickname } }">{{ player.nickname }}</RouterLink><strong v-else>{{ player.nickname }}</strong></td>
            <template v-if="isWar"><td>{{ player.kills }}</td><td>{{ player.deaths }}</td><td>{{ player.score }}</td><td>{{ player.headshots }}</td><td>{{ player.kd.toFixed(2) }}</td><td>{{ player.avg?.toFixed(1) ?? '—' }}</td><td>{{ player.adr?.toFixed(1) ?? '—' }}</td><td>{{ player.kast !== null ? `${player.kast.toFixed(1)}%` : '—' }}</td><td>{{ player.matches }}</td><td>{{ player.winrate !== null ? `${player.winrate.toFixed(1)}%` : '—' }}</td></template>
            <template v-else><td>{{ player.rank ?? '—' }}</td><td>{{ player.kills }}</td><td>{{ player.deaths }}</td><td class="player-highlight">{{ player.kd.toFixed(2) }}</td><td>{{ player.score }}</td></template>
          </tr></tbody>

        </table>
      </div>
    </div>
    <div v-if="lastPage > 1" class="stats-pagination" aria-label="Страницы статистики"><button class="stats-page-button" type="button" aria-label="Предыдущая страница" :disabled="loading || page <= 1" @click="changePage(page - 1)"><ChevronLeft :size="16" /></button><span>Страница {{ page }} из {{ lastPage }} · {{ total }} игроков</span><button class="stats-page-button" type="button" aria-label="Следующая страница" :disabled="loading || page >= lastPage" @click="changePage(page + 1)"><ChevronRight :size="16" /></button></div>
  </section>
</template>

<style scoped>
.ranking-card { overflow:hidden; border-radius:9px; background:var(--panel); box-shadow:var(--shadow-soft); }
.ranking-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:16px; }
.ranking-search { display:flex; align-items:center; gap:10px; flex:0 1 420px; min-width:0; padding:0 13px; min-height:42px; border-radius:10px; color:var(--subtle); background:var(--surface-tint); transition:box-shadow .15s; }
.ranking-search > svg { flex:0 0 auto; }
#ranking-player-search, #ranking-player-search:focus, #ranking-player-search:disabled { flex:1; min-width:0; width:100%; min-height:42px; height:42px; margin:0; padding:0; border:0; border-radius:0; outline:none; box-shadow:none; color:var(--text); background:transparent; font:inherit; font-size:11px; }
#ranking-player-search::placeholder { color:var(--subtle); opacity:1; }
#ranking-player-search:disabled { cursor:wait; opacity:.6; }
.ranking-search input::-webkit-search-cancel-button { display:none; }
.ranking-search:focus-within { box-shadow:0 0 0 2px var(--yellow); }
.ranking-search button { display:grid; flex:0 0 auto; place-items:center; width:25px; height:25px; border:0; border-radius:7px; padding:0; background:transparent; color:var(--muted); cursor:pointer; }
.ranking-search button:hover { color:var(--text); background:var(--panel); }
@media(max-width:520px) { .ranking-toolbar { padding:12px; }.ranking-search { flex-basis:100%; } }
.ranking-table-wrap { border-radius:0; box-shadow:none; }
.ranking-level-icon { width:25px; height:25px; flex:0 0 auto; object-fit:contain; }
.ranking-source { display:flex; gap:5px; margin-bottom:12px; }
.ranking-source button { padding:8px 12px; border:0; border-radius:6px; color:var(--muted); background:var(--panel); font-size:10px; cursor:pointer; }
.ranking-source button[aria-pressed=true] { color:var(--yellow); background:var(--surface-tint); }
</style>
