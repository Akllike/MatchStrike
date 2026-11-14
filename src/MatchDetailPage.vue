<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Clock3, Crosshair, Map as MapIcon, Radio, Server, Shield, Swords, Users } from '@lucide/vue'
import Pusher from 'pusher-js'
import { getGameMatch } from './api'
import type { GameMatchDetails, MatchPlayer } from './api'
import PageLoader from './components/PageLoader.vue'
import { aggregateSeriesPlayers } from './seriesStatistics.mjs'
import { matchMapImage } from './matchArtwork'
import { formatMatchDuration } from './matchDuration'

const route = useRoute()
const match = ref<GameMatchDetails | null>(null)
const loading = ref(true)
const error = ref('')
const refreshError = ref('')
const connection = ref<'connecting' | 'connected' | 'disconnected' | 'unconfigured'>('connecting')
const mapImageLoaded = ref(false)
const selectedStatsTab = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
let requestId = 0
let pending = false
let refreshQueued = false
let socket: Pusher | null = null
let socketConfig = ''

const maps = computed(() => {
  if (!match.value || match.value.scoreType !== 'maps') return []
  const entries = new Map<number, { index: number; name: string; result: GameMatchDetails['seriesResults'][number] | null }>()
  match.value.seriesMaps.forEach((name, index) => entries.set(index + 1, { index: index + 1, name, result: null }))
  match.value.seriesResults.forEach(result => entries.set(result.mapIndex, { index: result.mapIndex, name: result.map, result }))
  return [...entries.values()].sort((a, b) => a.index - b.index)
})

const teams = computed(() => match.value ? [
  { side: 'CT', name: match.value.roundTeams[0].name || 'Спецназ', players: match.value.playersCt },
  { side: 'T', name: match.value.roundTeams[1].name || 'Террористы', players: match.value.playersT },
] : [])

const seriesIsLive = computed(() => Boolean(match.value && match.value.scoreType === 'maps' && ['live', 'preparing'].includes(match.value.status)))
const resultTeams = computed(() => {
  if (!match.value) return []
  if (selectedStatsTab.value === 0) {
    return aggregateSeriesPlayers(match.value.seriesPlayerStats, match.value.teamA.name, match.value.teamB.name)
  }
  const selected = match.value.seriesPlayerStats.find(item => item.mapIndex === selectedStatsTab.value)
  if (!selected) return []
  return [{ side: 'CT', name: selected.teamCt.name || 'Спецназ', players: selected.playersCt }, { side: 'T', name: selected.teamT.name || 'Террористы', players: selected.playersT }]
})

const mapImage = computed(() => {
  return match.value ? matchMapImage(match.value.map) : null
})

watch(mapImage, () => { mapImageLoaded.value = false })

function onMapImageError() {
  mapImageLoaded.value = false
  console.warn('Изображение карты недоступно:', mapImage.value)
}

function initials(name: string | null | undefined) {
  return Array.from(name?.trim() || '?').slice(0, 2).join('').toLocaleUpperCase()
}

function playerStat(player: MatchPlayer, field: 'kills' | 'deaths') {
  const detailedValue = player.donutStats?.[field]
  if (typeof detailedValue === 'number') return detailedValue
  return player[field] ?? '—'
}

function playerDonutStat(player: MatchPlayer, field: 'headshots' | 'assists' | 'kd' | 'hsPercent' | 'adr' | 'kast' | 'damage' | 'entry' | 'triples' | 'quadros' | 'aces') {
  const stats = player.donutStats
  const rounds = Number(stats?.rounds ?? 0)
  const kills = Number(stats?.kills ?? player.kills ?? 0)
  const deaths = Number(stats?.deaths ?? player.deaths ?? 0)
  if (field === 'kd') return deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? kills.toFixed(2) : '—'
  if (field === 'hsPercent') return kills > 0 ? `${(Number(stats?.headshots ?? 0) / kills * 100).toFixed(1)}%` : '—'
  if (field === 'adr') return rounds > 0 ? (Number(stats?.damage ?? 0) / rounds).toFixed(1) : '—'
  if (field === 'kast') return rounds > 0 ? `${(Number(stats?.kastRounds ?? 0) / rounds * 100).toFixed(1)}%` : '—'
  if (!stats) return '—'
  const metricField = ({ entry: 'openingKills', triples: 'tripleKills', quadros: 'quadKills', aces: 'aceKills' } as const)[field as 'entry' | 'triples' | 'quadros' | 'aces'] ?? field
  const value = stats[metricField]
  return typeof value === 'number' ? value : '—'
}

function disconnect() {
  socket?.disconnect()
  socket = null
  socketConfig = ''
}

function configureRealtime(settings: GameMatchDetails['realtime'], matchId: number) {
  const key = settings ? JSON.stringify([matchId, settings]) : ''
  if (key && key === socketConfig) return
  disconnect()
  if (!settings) {
    connection.value = 'unconfigured'
    return
  }
  socketConfig = key
  connection.value = 'connecting'
  const client = new Pusher(settings.key, {
    cluster: 'mt1', wsHost: settings.host, wsPort: settings.port, wssPort: settings.port,
    forceTLS: settings.secure, wsPath: settings.path, enabledTransports: ['ws'],
  })
  socket = client
  const channel = client.subscribe(`match.${matchId}`)
  channel.bind('pusher:subscription_succeeded', () => {
    if (socket !== client) return
    connection.value = 'connected'
    if (!document.hidden) void load(true)
  })
  channel.bind('pusher:subscription_error', () => {
    if (socket === client) connection.value = 'disconnected'
  })
  channel.bind('match.updated', () => {
    if (socket === client && !document.hidden) void load(true)
  })
  client.connection.bind('state_change', ({ current }: { current: string }) => {
    if (socket !== client) return
    if (current !== 'connected') connection.value = current === 'connecting' ? 'connecting' : 'disconnected'
  })
}

async function load(quiet = false) {
  if (quiet && pending) {
    refreshQueued = true
    return
  }
  const id = ++requestId
  pending = true
  if (!quiet) loading.value = true
  try {
    const result = await getGameMatch(String(route.params.id))
    if (id !== requestId) return
    match.value = result
    error.value = ''
    refreshError.value = ''
    configureRealtime(result.realtime, result.id)
  } catch (requestError) {
    if (id !== requestId) return
    const message = requestError instanceof Error ? requestError.message : 'Не удалось загрузить матч.'
    if (match.value) refreshError.value = message
    else error.value = message
  } finally {
    if (id === requestId) {
      pending = false
      loading.value = false
      if (refreshQueued && !document.hidden) {
        refreshQueued = false
        void load(true)
      }
    }
  }
}

function onVisibilityChange() {
  if (!document.hidden) {
    refreshQueued = false
    void load(true)
  }
}

watch(() => route.params.id, () => {
  disconnect()
  match.value = null
  refreshQueued = false
  void load()
})
onMounted(() => {
  void load()
  document.addEventListener('visibilitychange', onVisibilityChange)
  timer = setInterval(() => {
    if (!document.hidden && connection.value !== 'connected') void load(true)
  }, 5000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  requestId++
  disconnect()
})
</script>

<template>
  <div class="match-detail-page">
    <RouterLink class="donut-back match-detail-back" :to="{ name: 'matches-mode', params: { mode: match?.mode === 'War' ? 'war' : 'mix' } }"><ArrowLeft :size="15" /> Все матчи</RouterLink>
    <Transition name="profile-content" mode="out-in">
    <PageLoader v-if="loading" key="loading" message="Загружаем матч…" />
    <div v-else-if="error" key="error" class="admin-error" role="alert"><strong>Не удалось загрузить матч</strong><span>{{ error }}</span><button class="friend-action" type="button" @click="load()">Повторить</button></div>
    <div v-else-if="match" :key="match.id">
      <header class="match-detail-heading">
        <div><div class="section-kicker">MATCHSTRIKE / MATCH #{{ match.id }}</div><h1>Матч <span>#{{ match.id }}</span></h1><p>Обзор игры, составы и результаты</p></div>
        <span class="donut-status" :class="`is-${match.status}`">{{ { live: 'Live', finished: 'Завершён', preparing: 'Подготовка', cancelled: 'Отменён' }[match.status] }}</span>
      </header>

      <section class="match-hero" :class="{ 'has-map-image': mapImageLoaded }" aria-label="Результат матча">
        <div class="match-hero-art" aria-hidden="true">
          <img v-if="mapImage" :key="mapImage" class="match-hero-map" :src="mapImage" alt="" @load="mapImageLoaded = true" @error="onMapImageError" />
          <div class="match-hero-shade"></div>
          <img class="match-hero-character is-ct" :src="'/uploads/maps/ct.png'" alt="" />
          <img class="match-hero-character is-t" :src="'/uploads/maps/tt.png'" alt="" />
        </div>
        <div class="match-hero-top"><span><Swords :size="14" /> {{ match.mode }} · {{ match.format || (match.mode === 'Mix' ? 'Classic' : 'Формат не указан') }}</span><span>МАТЧ #{{ match.id }}</span></div>
        <div class="match-hero-scoreboard">
          <div class="match-hero-team"><span class="match-team-emblem is-a">{{ initials(seriesIsLive ? match.roundTeams[0].name : match.teamA.name) }}</span><strong>{{ (seriesIsLive ? match.roundTeams[0].name : match.teamA.name) || 'Команда CT' }}</strong><small>КОМАНДА 1</small></div>
          <div class="match-hero-result"><span>{{ seriesIsLive ? 'СЧЁТ КАРТЫ' : 'СЧЁТ МАТЧА' }}</span><strong>{{ seriesIsLive ? match.roundTeams[0].score : match.teamA.score ?? '—' }} <i>:</i> {{ seriesIsLive ? match.roundTeams[1].score : match.teamB.score ?? '—' }}</strong><small>{{ seriesIsLive ? 'ТЕКУЩАЯ КАРТА' : match.scoreType === 'maps' ? 'ПО КАРТАМ' : 'ПО РАУНДАМ' }}</small><small v-if="seriesIsLive" class="match-series-score">Серия: {{ match.teamA.score ?? 0 }} : {{ match.teamB.score ?? 0 }}</small></div>
          <div class="match-hero-team"><span class="match-team-emblem is-b">{{ initials(seriesIsLive ? match.roundTeams[1].name : match.teamB.name) }}</span><strong>{{ (seriesIsLive ? match.roundTeams[1].name : match.teamB.name) || 'Команда T' }}</strong><small>КОМАНДА 2</small></div>
        </div>
        <div class="match-hero-bottom">
          <span><MapIcon :size="15" /><span><small>КАРТА</small><strong>{{ match.map }}</strong></span></span>
          <span><Clock3 :size="15" /><span><small>ДЛИТЕЛЬНОСТЬ</small><strong>{{ formatMatchDuration(match.durationSeconds) }}</strong></span></span>
          <span><Server :size="15" /><span><small>СЕРВЕР</small><strong>#{{ match.serverNumber }}{{ match.serverName ? ` · ${match.serverName}` : '' }}</strong></span></span>
          <span><Crosshair :size="15" /><span><small>РАУНД</small><strong>{{ match.round ?? '—' }}</strong></span></span>
        </div>
      </section>

      <div class="match-update-status" role="status">
        <Radio :size="14" />
        <span v-if="refreshError">Не удалось обновить данные: {{ refreshError }}</span>
        <span v-else-if="connection === 'connected'">Обновление в реальном времени</span>
        <span v-else-if="connection === 'unconfigured'">WebSocket не настроен · обновляем каждые 5 секунд</span>
        <span v-else>Связь с WebSocket восстанавливается · обновляем каждые 5 секунд</span>
        <time :datetime="match.updatedAt">Последние данные: {{ new Date(match.updatedAt).toLocaleString('ru-RU') }}</time>
      </div>

      <section v-if="match.veto && match.status === 'preparing'" class="match-detail-section veto-section" aria-labelledby="match-veto-title">
        <div class="match-section-heading"><div><div class="section-kicker">SERIES / VETO</div><h2 id="match-veto-title">Подготовка карт</h2><p>{{ match.veto.active ? `Шаг ${match.veto.step} из ${match.veto.stepCount}` : 'Вето завершено' }}</p></div><span class="match-section-icon"><MapIcon :size="19" /></span></div>
        <p v-if="match.veto.lastMap" class="match-section-note">Последнее действие: команда {{ match.veto.team || 'не указана' }} {{ match.veto.action === 'ban' ? 'забанила' : match.veto.action === 'pick' ? 'выбрала' : 'обработала' }} {{ match.veto.lastMap }}<template v-if="match.veto.automatic"> (автоматически)</template></p>
        <div class="veto-map-groups">
          <div v-if="match.veto.bannedMaps.length"><strong>Забанены</strong><ul><li v-for="map in match.veto.bannedMaps" :key="`ban-${map}`">{{ map }}</li></ul></div>
          <div v-if="match.veto.pickedMaps.length"><strong>Выбраны</strong><ul><li v-for="map in match.veto.pickedMaps" :key="`pick-${map}`">{{ map }}</li></ul></div>
          <div v-if="match.veto.availableMaps.length"><strong>Доступны</strong><ul><li v-for="map in match.veto.availableMaps" :key="`available-${map}`">{{ map }}</li></ul></div>
          <p v-if="!match.veto.bannedMaps.length && !match.veto.pickedMaps.length && !match.veto.availableMaps.length" class="match-detail-empty">Плагин пока не передал список карт.</p>
        </div>
        <ol v-if="match.veto.history.length" class="veto-history" aria-label="История выбора карт">
          <li v-for="event in match.veto.history" :key="event.step"><span class="veto-history-step">{{ String(event.step).padStart(2, '0') }}</span><span class="veto-history-action" :class="`is-${event.action}`">{{ event.action === 'ban' ? 'Бан' : 'Пик' }}</span><strong>{{ event.map }}</strong><span>{{ event.team || 'Команда не указана' }}<template v-if="event.captain"> · {{ event.captain }}</template><template v-if="event.automatic"> · автоматически</template></span></li>
        </ol>
      </section>
      <section v-if="match.scoreType === 'maps'" class="match-detail-section" aria-labelledby="match-maps-title">
        <div class="match-section-heading"><div><div class="section-kicker">SERIES / MAPS</div><h2 id="match-maps-title">Карты серии</h2><p>Результаты карт в порядке игры</p></div><span class="match-section-icon"><MapIcon :size="19" /></span></div>
        <div v-if="maps.length" class="match-map-list">
          <article v-for="map in maps" :key="map.index" class="match-map-item">
            <div class="match-map-number">{{ String(map.index).padStart(2, '0') }}</div>
            <div class="match-map-info"><strong>{{ map.name }}</strong><span>{{ map.result ? 'Сыграна' : map.name === match.map && match.status === 'live' ? 'Текущая карта' : match.status === 'finished' || match.status === 'cancelled' ? 'Нет результата' : 'Ожидает игры' }}</span></div>
            <div v-if="map.result" class="match-map-score"><span>{{ match.teamA.name || 'Команда 1' }}</span><strong>{{ map.result.teamAScore }} <i>:</i> {{ map.result.teamBScore }}</strong><span>{{ match.teamB.name || 'Команда 2' }}</span></div>
            <div v-else class="match-map-pending">— : —</div>
          </article>
        </div>
        <div v-else class="match-detail-empty">Информация о картах серии ещё не получена.</div>
        <p class="match-section-note">Счёт {{ match.status === 'finished' ? 'последней' : 'текущей' }} карты: {{ match.roundTeams[0].name || 'CT' }} {{ match.roundTeams[0].score }} : {{ match.roundTeams[1].score }} {{ match.roundTeams[1].name || 'T' }}</p>
      </section>

      <section v-if="match.status === 'finished'" class="match-detail-section" aria-labelledby="match-results-title">
        <div class="match-section-heading"><div><div class="section-kicker">MATCH / RESULTS</div><h2 id="match-results-title">Результаты игроков</h2><p>Последние полученные данные игроков · {{ match.map }}</p></div><span class="match-section-icon"><Users :size="19" /></span></div>
        <div v-if="match.scoreType === 'maps'" class="series-stats-tabs" role="tablist" aria-label="Статистика игроков по серии">
          <button class="series-stats-tab" type="button" role="tab" :aria-selected="selectedStatsTab === 0" @click="selectedStatsTab = 0">Σ Суммарно</button>
          <button v-for="map in match.seriesPlayerStats" :key="map.mapIndex" class="series-stats-tab" type="button" role="tab" :aria-selected="selectedStatsTab === map.mapIndex" @click="selectedStatsTab = map.mapIndex"><MapIcon :size="15" /> {{ map.map }}</button>
        </div>
        <div class="match-results">
          <div class="match-results-scroll" role="region" aria-label="Результаты игроков" tabindex="0">
            <table class="match-results-table">
              <thead><tr><th scope="col">Игрок</th><th scope="col" v-tooltip="'Убийства'">Убийства</th><th scope="col" v-tooltip="'Смерти'">Смерти</th><th scope="col" v-tooltip="'Ассисты'">A</th><th scope="col" v-tooltip="'Количество хедшотов'">HS</th><th scope="col" v-tooltip="'Kills / Deaths'">K/D</th><th scope="col" v-tooltip="'Доля убийств в голову'">HS%</th><th scope="col" v-tooltip="'Средний урон за раунд'">ADR</th><th scope="col" v-tooltip="'Общий урон'">Урон</th><th scope="col" v-tooltip="'Entry-фраги'">Entry</th><th scope="col" v-tooltip="'Трипл-киллы'">3K</th><th scope="col" v-tooltip="'Квадро-киллы'">4K</th><th scope="col" v-tooltip="'Эйсы'">Ace</th></tr></thead>
              <tbody v-for="team in (match.scoreType === 'maps' ? resultTeams : teams)" :key="team.side">
                <tr class="match-results-team"><th colspan="13" scope="rowgroup"><span class="match-results-side" :class="`is-${team.side.toLowerCase()}`">{{ team.side }}</span><strong>{{ team.name }}</strong><small>Сторона {{ team.side }} · игроков: {{ team.players.length }}</small></th></tr>
                <tr v-for="(player, index) in team.players" :key="`${index}-${player.name}`">
                  <th scope="row"><span class="match-results-player"><img v-if="player.account?.avatarUrl" class="match-player-avatar" :src="player.account.avatarUrl" :alt="player.account.nickname" /><span v-else class="match-player-avatar">{{ initials(player.name) }}</span><span class="match-player-label"><RouterLink v-if="player.account" :to="player.account.profileUrl">{{ player.account.nickname }}</RouterLink><strong v-else>{{ player.name }}</strong><small v-if="player.account && player.account.nickname !== player.name">Игровой ник: {{ player.name }}</small></span></span></th>
                  <td>{{ playerStat(player, 'kills') }}</td><td>{{ playerStat(player, 'deaths') }}</td><td>{{ playerDonutStat(player, 'assists') }}</td><td>{{ playerDonutStat(player, 'headshots') }}</td><td>{{ playerDonutStat(player, 'kd') }}</td><td>{{ playerDonutStat(player, 'hsPercent') }}</td><td>{{ playerDonutStat(player, 'adr') }}</td><td>{{ playerDonutStat(player, 'damage') }}</td><td>{{ playerDonutStat(player, 'entry') }}</td><td>{{ playerDonutStat(player, 'triples') }}</td><td>{{ playerDonutStat(player, 'quadros') }}</td><td>{{ playerDonutStat(player, 'aces') }}</td>
                </tr>
                <tr v-if="!team.players.length"><td colspan="13" class="match-results-empty">Данные об игроках этой стороны не получены.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <p class="match-section-note">{{ match.scoreType === 'maps' && selectedStatsTab === 0 ? 'Суммарные показатели по сохранённым картам серии.' : 'Статистика игроков на выбранной карте.' }} K/D — убийства к смертям; HS% — доля убийств в голову; ADR — средний урон за раунд. Для старых матчей часть полей может отсутствовать.</p>
        <p v-if="match.playersRetained" class="match-section-note">Показаны последние данные игроков, полученные перед завершением карты.</p>
      </section>
      <section v-else class="match-detail-section" aria-labelledby="match-players-title">
        <div class="match-section-heading"><div><div class="section-kicker">MATCH / PLAYERS</div><h2 id="match-players-title">Составы команд</h2><p>Игроки и статистика на последней полученной карте · {{ match.map }}</p></div><span class="match-section-icon"><Users :size="19" /></span></div>
        <p v-if="match.playersRetained" class="match-section-note">Показаны последние данные игроков, полученные перед завершением карты.</p>
        <div class="match-rosters">
          <article v-for="team in teams" :key="team.side" class="match-roster">
            <div class="match-roster-heading"><div><span class="match-roster-mark" :class="`is-${team.side.toLowerCase()}`"><Shield :size="16" /></span><div><strong>{{ team.name }}</strong><span>СТОРОНА {{ team.side }}</span></div></div><small>{{ team.players.length }} ИГРОКОВ</small></div>
            <div v-if="team.players.length" class="match-player-table">
              <div class="match-player-head"><span>ИГРОК</span><span v-tooltip="'Убийства'">K</span><span v-tooltip="'Смерти'">D</span><span v-tooltip="'Ассисты'">A</span><span v-tooltip="'Хедшоты'">HS</span><span v-tooltip="'Kills / Deaths'">K/D</span><span v-tooltip="'Доля попаданий в голову'">HS%</span><span v-tooltip="'Средний урон за раунд'">ADR</span></div>
              <div v-for="(player, index) in team.players" :key="`${index}-${player.name}`" class="match-player-row">
                <div class="match-player-identity">
                  <img v-if="player.account?.avatarUrl" class="match-player-avatar" :src="player.account.avatarUrl" :alt="player.account.nickname" />
                  <span v-else class="match-player-avatar">{{ initials(player.name) }}</span>
                  <span class="match-player-label">
                    <RouterLink v-if="player.account" :to="player.account.profileUrl">{{ player.account.nickname }}</RouterLink>
                    <strong v-else>{{ player.name }}</strong>
                    <small v-if="player.account && player.account.nickname !== player.name">Игровой ник: {{ player.name }}</small>
                  </span>
                </div>
                <span>{{ playerStat(player, 'kills') }}</span>
                <span>{{ playerStat(player, 'deaths') }}</span>
                <span>{{ playerDonutStat(player, 'assists') }}</span>
                <span>{{ playerDonutStat(player, 'headshots') }}</span>
                <span>{{ playerDonutStat(player, 'kd') }}</span>
                <span>{{ playerDonutStat(player, 'hsPercent') }}</span>
                <span>{{ playerDonutStat(player, 'adr') }}</span>
              </div>
            </div>
            <div v-else class="match-detail-empty">Данные об игроках не получены.</div>
          </article>
        </div>
        <p class="match-section-note">K — убийства, D — смерти. Составы показаны по сторонам CT и T в последнем снимке плагина.</p>
      </section>
      <p v-if="match.endReason" class="match-section-note">Причина завершения: {{ match.endReason }}</p>
    </div>
    </Transition>
  </div>
</template>
