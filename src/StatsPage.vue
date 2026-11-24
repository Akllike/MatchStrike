<script setup lang="ts">
import { websiteSettings } from './websiteSettings'
import { ChevronLeft, ChevronRight, Activity, UsersRound } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getDonutStatsPlayers, getDonutStatsSeasonPlayers, getStatsPlayers } from './api'
import SearchField from './components/SearchField.vue'
import PageLoader from './components/PageLoader.vue'
import type { DonutStatsLeaderboardPage, DonutStatsSeasonLeaderboard, StatsPlayersPage } from './api'

interface Player {
  id: string; nickname: string; profileNickname: string | null; avatarUrl: string | null; coverUrl: string | null
  score: number; level: number | null; rank: number | null; matches: number | null
  wins: number; losses: number; kills: number; deaths: number; kd: number; headshots: number | null
  hsPercent: number | null; avg: number | null; adr: number | null; kast: number | null; winrate: number | null
}
const route = useRoute()
const isSeason = computed(() => route.path === '/stats/season')
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
const seasonLabel = ref('текущего квартала')
let requestId = 0
let timer: number | undefined
const isWar = computed(() => source.value === 'war')
const pageSize = computed(() => isSeason.value || isWar.value ? 50 : 100)
const seasonTopFive = computed(() => players.value.slice(0, 5))
const seasonRemaining = computed(() => players.value.slice(5))
function applyWar(result: DonutStatsLeaderboardPage) {
  players.value = result.players.map(player => ({ ...player, id: String(player.id), score: player.elo, rank: null, kd: player.kdr, hsPercent: null, coverUrl: null }))
  page.value = result.pagination.currentPage; lastPage.value = result.pagination.lastPage; total.value = result.pagination.total
}
function applyServers(result: StatsPlayersPage) {
  players.value = result.players.map(player => ({ ...player, id: String(player.id), score: player.points, level: null, matches: null, wins: 0, losses: 0, kd: player.kdr, headshots: null, hsPercent: null, avg: null, adr: null, kast: null, winrate: null, coverUrl: null }))
  page.value = result.pagination.currentPage; lastPage.value = result.pagination.lastPage; total.value = result.pagination.total
}
function applySeason(result: DonutStatsSeasonLeaderboard) {
  seasonLabel.value = result.season.label
  players.value = result.players.map((player, index) => ({
    ...player, id: player.id, score: 0, level: null, rank: index + 1, wins: 0, losses: 0,
    kd: player.kdr, hsPercent: player.hs, avg: null, kast: null, winrate: null,
  }))
  page.value = 1; lastPage.value = 1; total.value = result.total
}
async function loadPage(nextPage = page.value) {
  const id = ++requestId
  loading.value = true; error.value = ''
  try {
    if (isSeason.value) {
      const result = await getDonutStatsSeasonPlayers()
      if (id === requestId) applySeason(result)
    } else if (isWar.value) {
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
  if (isSeason.value) return
  if (source.value === next) return
  window.clearTimeout(timer)
  source.value = next; players.value = []; page.value = 1; lastPage.value = 1; total.value = 0
  void loadPage(1)
}
watch(search, () => {
  window.clearTimeout(timer); ++requestId; loading.value = true; error.value = ''
  timer = window.setTimeout(() => { void loadPage(1) }, 300)
})
async function initializePage() {
  const id = ++requestId
  loading.value = true; initializing.value = true; error.value = ''
  if (isSeason.value) {
    try {
      const result = await getDonutStatsSeasonPlayers()
      if (id === requestId) applySeason(result)
    } catch {
      if (id === requestId) error.value = 'Не удалось загрузить рейтинг сезона. Попробуйте ещё раз.'
    } finally {
      if (id === requestId) { loading.value = false; initializing.value = false }
    }
    return
  }
  const [servers, war] = await Promise.allSettled([getStatsPlayers(1), getDonutStatsPlayers(1)])
  if (id !== requestId) return
  hasServers.value = servers.status === 'fulfilled' && servers.value.source === 'third_party'
  if (hasServers.value && servers.status === 'fulfilled') { source.value = 'servers'; applyServers(servers.value) }
  else if (war.status === 'fulfilled') applyWar(war.value)
  else error.value = 'Не удалось загрузить рейтинг. Попробуйте ещё раз.'
  loading.value = false; initializing.value = false
}
onMounted(() => { void initializePage() })
watch(() => route.path, () => {
  if (route.path !== '/stats/players' && route.path !== '/stats/season') return
  window.clearTimeout(timer)
  players.value = []; page.value = 1; lastPage.value = 1; total.value = 0
  void initializePage()
})
onBeforeUnmount(() => { ++requestId; window.clearTimeout(timer) })
</script>

<template>
  <div class="stats-page" :class="{ 'is-season-page': isSeason }">
  <section class="welcome-section route-intro" aria-labelledby="stats-page-title">
    <div class="welcome-copy"><div class="eyebrow"><span class="eyebrow-line"></span> ЦИФРЫ И РЕЗУЛЬТАТЫ <span class="eyebrow-slash">/</span> PLAYER STATS</div><h1 id="stats-page-title">Стати<span>стика</span></h1><p>{{ isSeason ? `Топ-50 War-игроков за ${seasonLabel}: рейтинг по KD, HS и ADR.` : 'Общие показатели игроков на всех серверах сообщества: убийства, смерти и очки.' }}</p></div>
    <div class="route-intro-mark"><Activity :size="27" :stroke-width="1.5" /></div>
  </section>
  <section class="content-section route-section" aria-labelledby="player-stats-title">
    <div class="section-heading"><div><div class="section-kicker">{{ isSeason ? `DONUTSTATS / СЕЗОН · ${seasonLabel}` : isWar ? 'DONUTSTATS / WAR' : websiteSettings.name.toUpperCase() + ' / LEADERBOARD' }}</div><h2 id="player-stats-title">{{ isSeason ? 'Топ игроков сезона' : isWar ? 'Рейтинг War' : 'Общая статистика игроков' }}</h2></div><span v-if="total" class="section-count">{{ String(isSeason ? players.length : total).padStart(2, '0') }} <span>ИГРОКОВ</span></span></div>
    <p v-if="isSeason" class="season-ranking-note">Календарный квартал · порядок: KD, затем HS% и ADR · статистика рассчитана по завершённым War-матчам.</p>
    <div v-if="hasServers && !isSeason" class="ranking-source" role="group" aria-label="Источник рейтинга"><button type="button" :aria-pressed="isWar" @click="selectSource('war')">War</button><button type="button" :aria-pressed="!isWar" @click="selectSource('servers')">Серверы</button></div>
    <div v-if="!isSeason" class="ranking-toolbar"><SearchField id="ranking-player-search" v-model="search" :disabled="initializing" :maxlength="100" label="Поиск по никнейму или Steam ID" /><span v-if="loading" class="stats-updated" role="status">{{ search.trim() ? 'Ищем игроков…' : 'Загружаем статистику…' }}</span></div>
    <Transition name="profile-content" mode="out-in">
    <PageLoader v-if="loading" key="loading" message="Загружаем статистику…" />
    <div v-else-if="error" key="error" class="admin-error" role="alert">
      <strong>Не удалось загрузить статистику</strong><span>{{ error }}</span>
      <button class="friend-action" type="button" @click="loadPage()">Повторить</button>
    </div>
    <div v-else-if="!players.length" key="empty" class="empty-state section-empty" role="status">
      <span class="empty-icon"><UsersRound :size="22" :stroke-width="1.5" /></span>
      <div>
        <strong>{{ search.trim() ? 'Игроки не найдены' : isSeason ? 'В этом сезоне пока нет статистики' : 'Игроков в статистике пока нет' }}</strong>
        <span>{{ search.trim() ? 'Попробуйте изменить никнейм или Steam ID в поиске.' : isSeason ? 'Таблица заполнится после завершения первых War-матчей текущего квартала.' : isWar ? 'Статистика появится после первых завершённых War-матчей.' : 'Статистика появится, когда серверы передадут данные об игроках.' }}</span>
      </div>
    </div>
    <div v-else-if="isSeason" key="season-results" class="season-page">
      <section class="season-leaders" aria-labelledby="season-leaders-title">
        <header class="season-leaders-heading">
          <div><span class="season-leaders-kicker">SEASON RANKING · {{ seasonLabel.toUpperCase() }}</span><h3 id="season-leaders-title">Пятёрка лидеров</h3><p>Лучшие игроки сезона по KD, HS% и ADR</p></div>
          <span class="season-top-count"><strong>{{ String(seasonTopFive.length).padStart(2, '0') }}</strong><small>из {{ Math.min(total, 50) }}</small></span>
        </header>
        <div class="season-top-grid">
          <article v-for="player in seasonTopFive" :key="player.id" class="season-poster-card" :class="[`season-rank-${player.rank}`, { 'has-cover': player.coverUrl }]">
            <span class="season-poster-index">{{ String(player.rank).padStart(2, '0') }}</span>
            <img v-if="player.coverUrl" class="season-poster-cover" :src="player.coverUrl" alt="" loading="lazy" />
            <div class="season-poster-content">
              <div class="season-poster-identity">
                <img v-if="player.avatarUrl" class="season-poster-avatar" :src="player.avatarUrl" alt="" loading="lazy" />
                <span v-else class="season-poster-avatar season-poster-fallback" aria-hidden="true">{{ player.nickname.slice(0,1).toUpperCase() }}</span>
                <div class="season-poster-copy">
                  <RouterLink v-if="player.profileNickname" class="season-poster-name" :to="{ name: 'profile', params: { nickname: player.profileNickname } }">{{ player.nickname }}</RouterLink>
                  <strong v-else class="season-poster-name">{{ player.nickname }}</strong>
                  <span class="season-poster-matches">{{ player.matches }} матчей <i>·</i> {{ player.kills }} / {{ player.deaths }} K / D</span>
                </div>
              </div>
              <div class="season-poster-metrics"><span><b>{{ player.kd.toFixed(2) }}</b><small>K/D</small></span><span><b>{{ player.hsPercent !== null ? `${player.hsPercent.toFixed(1)}%` : '—' }}</b><small>HS</small></span><span><b>{{ player.adr?.toFixed(1) ?? '—' }}</b><small>ADR</small></span></div>
            </div>
          </article>
        </div>
      </section>

      <section v-if="seasonRemaining.length" class="season-rest" aria-labelledby="season-rest-title">
        <header class="season-rest-heading"><div><span class="section-kicker">RANK 06–50</span><h3 id="season-rest-title">Таблица сезона</h3></div><span>{{ seasonRemaining.length }} игроков</span></header>
        <div class="ranking-card">
          <div class="player-stats-wrap ranking-table-wrap">
            <table class="player-stats-table stats-player-table season-table">
              <thead><tr><th scope="col">#</th><th scope="col">Игрок</th><th scope="col">Убийства</th><th scope="col">Смерти</th><th scope="col" v-tooltip="'Убийства / смерти за сезон'">KD</th><th scope="col" v-tooltip="'Доля убийств в голову за сезон'">HS%</th><th scope="col" v-tooltip="'Средний урон за раунд за сезон'">ADR</th><th scope="col">Матчи</th></tr></thead>
              <tbody><tr v-for="player in seasonRemaining" :key="player.id">
                <td class="player-rank">{{ String(player.rank).padStart(2, '0') }}</td>
                <td class="player-identity"><img v-if="player.avatarUrl" class="player-stat-avatar" :src="player.avatarUrl" alt="" loading="lazy" /><span v-else class="player-stat-avatar player-stat-initial">{{ player.nickname.slice(0,1).toUpperCase() }}</span><RouterLink v-if="player.profileNickname" class="stats-player-link" :to="{ name: 'profile', params: { nickname: player.profileNickname } }">{{ player.nickname }}</RouterLink><strong v-else>{{ player.nickname }}</strong></td>
                <td>{{ player.kills }}</td><td>{{ player.deaths }}</td><td class="player-highlight">{{ player.kd.toFixed(2) }}</td><td>{{ player.hsPercent !== null ? `${player.hsPercent.toFixed(1)}%` : '—' }}</td><td>{{ player.adr?.toFixed(1) ?? '—' }}</td><td>{{ player.matches }}</td>
              </tr></tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
    <div v-else key="results">
    <div class="ranking-card">
      <div class="player-stats-wrap ranking-table-wrap">
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
    </div>
    </Transition>
  </section>
  </div>
</template>

<style scoped>
.stats-page { position:relative; }
.stats-page.is-season-page { isolation:isolate; }
.stats-page.is-season-page::before { position:absolute; z-index:-1; inset:-28px -32px -48px; background:radial-gradient(ellipse 62% 420px at 50% 4%,color-mix(in srgb,#38bdf8 7%,transparent),transparent 72%),linear-gradient(color-mix(in srgb,var(--line-soft) 22%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--line-soft) 22%,transparent) 1px,transparent 1px); background-size:auto,65px 65px,65px 65px; mask-image:radial-gradient(ellipse 78% 48% at 50% 0%,#000 4%,transparent 100%); content:''; pointer-events:none; }
.ranking-card { overflow:hidden; border-radius:9px; background:var(--panel); box-shadow:var(--shadow-soft); }
.season-ranking-note { margin:-6px 0 16px; color:var(--muted); font-size:11px; line-height:1.6; }
.season-page { display:grid; gap:25px; }
.season-leaders { position:relative; overflow:hidden; border-radius:17px; background:var(--panel); box-shadow:var(--shadow-soft); animation:season-rise 520ms cubic-bezier(.2,.7,.2,1) both; }
.season-leaders-heading { position:relative; display:flex; min-height:132px; align-items:center; justify-content:space-between; gap:18px; overflow:hidden; padding:24px 26px; background:linear-gradient(115deg,color-mix(in srgb,var(--yellow) 12%,var(--panel)),var(--panel) 70%); }
.season-leaders-heading::after { position:absolute; top:-94px; right:9%; width:260px; height:240px; border-radius:50%; background:radial-gradient(circle,color-mix(in srgb,var(--yellow) 13%,transparent),transparent 70%); content:''; pointer-events:none; }
.season-leaders-kicker { color:var(--yellow); font-size:9px; font-weight:800; letter-spacing:.15em; }
.season-leaders-heading h3 { margin:7px 0 3px; color:var(--text); font-size:23px; font-weight:800; letter-spacing:-.04em; }
.season-leaders-heading p { margin:0; color:var(--muted); font-size:11px; }
.season-top-count { position:relative; z-index:1; display:grid; justify-items:end; }
.season-top-count strong { color:var(--text); font-size:37px; font-weight:800; font-variant-numeric:tabular-nums; line-height:1; }
.season-top-count small { margin-top:5px; color:var(--muted); font-size:9px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
.season-top-grid { position:relative; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:7px; padding:0 19px 19px; }
.season-poster-card { --poster-accent:#71cde0; position:relative; display:flex; min-width:0; min-height:390px; flex-direction:column; justify-content:flex-end; overflow:hidden; padding:17px 19px; isolation:isolate; background:linear-gradient(155deg,color-mix(in srgb,var(--poster-accent) 16%,#172435),#09121d 78%); clip-path:polygon(8% 0,100% 0,92% 100%,0 100%); animation:season-card-arrive 420ms cubic-bezier(.2,.7,.2,1) both; transition:filter 180ms ease,transform 180ms ease; }
.season-poster-card::before { position:absolute; z-index:1; inset:0; background:linear-gradient(180deg,transparent 20%,color-mix(in srgb,var(--poster-accent) 19%,transparent) 48%,#07111ce8 77%),linear-gradient(135deg,color-mix(in srgb,var(--poster-accent) 24%,transparent),transparent 66%); content:''; pointer-events:none; }
.season-poster-card.has-cover::before { background:linear-gradient(90deg,rgba(10,11,12,.76),rgba(10,11,12,.12)),linear-gradient(0deg,rgba(10,11,12,.88),transparent 65%); }
.season-poster-card::after { position:absolute; z-index:1; inset:5px; border:1px solid color-mix(in srgb,var(--poster-accent) 44%,transparent); clip-path:polygon(8% 0,100% 0,92% 100%,0 100%); content:''; pointer-events:none; }
.season-poster-card:hover { filter:brightness(1.08); transform:translateY(-3px); }
.season-rank-1 { --poster-accent:var(--yellow); }.season-rank-2 { --poster-accent:#9bd9e8; }.season-rank-3 { --poster-accent:#c5a0e8; }
.season-poster-cover { position:absolute; z-index:0; inset:0; width:100%; height:100%; object-fit:cover; object-position:center; filter:saturate(.8) brightness(.76); }
.season-poster-identity { display:flex; min-width:0; align-items:center; gap:9px; }
.season-poster-avatar { display:grid; width:38px; height:38px; flex:0 0 38px; place-items:center; overflow:hidden; border:1px solid color-mix(in srgb,var(--poster-accent) 60%,transparent); border-radius:50%; object-fit:cover; background:color-mix(in srgb,var(--poster-accent) 20%,var(--panel)); box-shadow:0 3px 14px #0005; }
.season-poster-fallback { color:var(--poster-accent); font-size:13px; font-weight:800; }
.season-poster-index { position:absolute; z-index:2; top:5px; left:14%; color:var(--poster-accent); font-size:clamp(72px,8vw,112px); font-style:italic; font-weight:900; letter-spacing:-.12em; line-height:.95; opacity:.58; text-shadow:0 4px 30px color-mix(in srgb,var(--poster-accent) 24%,transparent); }
.season-poster-content { position:relative; z-index:2; display:grid; min-width:0; gap:9px; }
.season-poster-copy { display:grid; min-width:0; gap:5px; }
.season-poster-name { display:-webkit-box; min-height:30px; overflow:hidden; color:#f4f8fc; font-size:clamp(12px,1.12vw,16px); font-style:italic; font-weight:850; letter-spacing:-.025em; line-height:1.1; text-overflow:ellipsis; text-transform:uppercase; text-shadow:0 2px 14px #000a; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
a.season-poster-name:hover { color:var(--poster-accent); }
.season-poster-matches { overflow:hidden; color:#d2dbe5; font-size:9px; font-weight:600; text-overflow:ellipsis; text-shadow:0 1px 8px #000; white-space:nowrap; }
.season-poster-matches i { padding:0 3px; color:var(--poster-accent); font-style:normal; }
.season-poster-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; padding-top:8px; border-top:1px solid color-mix(in srgb,var(--poster-accent) 30%,transparent); }
.season-poster-metrics>span { display:flex; flex-direction:column-reverse; gap:3px; }
.season-poster-metrics small { color:#c0ccd9; font-size:7px; font-weight:750; letter-spacing:.12em; }
.season-poster-metrics b { color:#f4f8fc; font-size:12px; font-weight:800; font-variant-numeric:tabular-nums; }
.season-rest { min-width:0; }
.season-rest-heading { display:flex; align-items:end; justify-content:space-between; gap:12px; margin:0 2px 12px; }
.season-rest-heading h3 { margin:4px 0 0; color:var(--text); font-size:17px; font-weight:750; letter-spacing:-.025em; }
.season-rest-heading>span { color:var(--muted); font-size:10px; }
.season-table { min-width:680px; }
.season-table th,.season-table td { height:43px; }
.ranking-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-bottom:16px; }
.ranking-table-wrap { border-radius:0; box-shadow:none; }
.ranking-level-icon { width:25px; height:25px; flex:0 0 auto; object-fit:contain; }
.ranking-source { display:flex; gap:5px; margin-bottom:12px; }
.ranking-source button { padding:8px 12px; border:0; border-radius:6px; color:var(--muted); background:var(--panel); font-size:10px; cursor:pointer; }
.ranking-source button[aria-pressed=true] { color:var(--yellow); background:var(--surface-tint); }
@keyframes season-rise { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes season-card-arrive { from { opacity:0; translate:0 9px; } to { opacity:1; translate:0 0; } }
@media(prefers-reduced-motion:reduce) { .season-leaders,.season-poster-card,.season-poster-avatar { animation:none; transition:none; }.season-poster-card,.season-poster-card:hover { transform:none; } }
@media(max-width:1000px) { .season-top-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }.season-poster-card { min-height:360px; } }
@media(max-width:680px) { .season-top-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.season-poster-card { min-height:330px; }.season-leaders-heading { min-height:115px; padding:20px; } }
@media(max-width:480px) { .season-leaders { border-radius:13px; }.season-leaders-heading { padding:18px 16px; }.season-leaders-heading h3 { font-size:20px; }.season-top-count strong { font-size:30px; }.season-top-grid { gap:4px; padding:0 8px 12px; }.season-poster-card { min-height:300px; padding:14px 15px; }.season-poster-index { font-size:74px; }.season-poster-name { font-size:12px; }.season-poster-metrics b { font-size:10px; } }
</style>
