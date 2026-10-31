<script setup lang="ts">
import { Activity, ChevronLeft, ChevronRight, Search, X } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getStatsPlayers } from './api'
import type { StatsPlayer } from './api'

const players = ref<StatsPlayer[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const lastPage = ref(1)
const totalPlayers = ref(0)
const playersLoading = ref(false)
let playerRequestId = 0
let searchTimer: number | null = null

async function loadStats(page = currentPage.value, search = searchQuery.value) {
  const requestId = ++playerRequestId
  playersLoading.value = true

  try {
    const result = await getStatsPlayers(page, search)
    if (requestId !== playerRequestId) return

    players.value = result.players
    currentPage.value = result.pagination.currentPage
    lastPage.value = result.pagination.lastPage
    totalPlayers.value = result.pagination.total
  } catch {
    if (requestId === playerRequestId) {
      players.value = []
      totalPlayers.value = 0
    }
  } finally {
    if (requestId === playerRequestId) playersLoading.value = false
  }
}

function changePage(page: number) {
  if (page < 1 || page > lastPage.value || page === currentPage.value || playersLoading.value) return
  void loadStats(page)
}

watch(searchQuery, (search) => {
  if (searchTimer !== null) window.clearTimeout(searchTimer)
  const requestId = ++playerRequestId
  playersLoading.value = true
  searchTimer = window.setTimeout(() => {
    searchTimer = null
    if (requestId === playerRequestId) void loadStats(1, search.trim())
  }, 250)
})

onMounted(() => void loadStats())
onBeforeUnmount(() => {
  if (searchTimer !== null) window.clearTimeout(searchTimer)
})
</script>

<template>
  <section class="welcome-section route-intro" aria-labelledby="stats-page-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> ЦИФРЫ И РЕЗУЛЬТАТЫ <span class="eyebrow-slash">/</span> PLAYER STATS</div>
      <h1 id="stats-page-title">Стати<span>стика</span></h1>
      <p>Общие показатели игроков на всех серверах сообщества: убийства, смерти и очки.</p>
    </div>
    <div class="route-intro-mark"><Activity :size="27" :stroke-width="1.5" /></div>
  </section>

  <section class="content-section route-section" aria-labelledby="player-stats-title">
    <div class="section-heading">
      <div><div class="section-kicker">MATCHSTRIKE / LEADERBOARD</div><h2 id="player-stats-title">Общая статистика игроков</h2></div>
      <span v-if="players.length" class="section-count">{{ totalPlayers.toString().padStart(2, '0') }} <span>ИГРОКОВ</span></span>
    </div>

    <div class="stats-toolbar">
      <label class="stats-search">
        <Search class="stats-search-icon" :size="16" aria-hidden="true" />
        <input v-model="searchQuery" class="auth-input stats-search-input" type="search" maxlength="100" autocomplete="off" aria-label="Поиск игроков по никнейму или Steam ID" placeholder="Поиск по никнейму или Steam ID" />
        <button v-if="searchQuery" class="stats-search-clear" type="button" aria-label="Очистить поиск" title="Очистить поиск" @click="searchQuery = ''"><X :size="16" /></button>
      </label>
      <span v-if="playersLoading" class="stats-updated" role="status" aria-live="polite">{{ searchQuery.trim() ? 'Ищем игроков…' : 'Загружаем статистику…' }}</span>
    </div>

    <p v-if="!players.length" class="stats-no-data" role="status">{{ playersLoading ? 'Загрузка результатов…' : (searchQuery.trim() ? 'Игроки не найдены' : 'Нет данных') }}</p>
    <div v-else class="player-stats-wrap">
      <table class="player-stats-table stats-player-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Игрок</th>
            <th scope="col">Лучший ранг</th>
            <th scope="col">Убийства</th>
            <th scope="col">Смерти</th>
            <th scope="col">KDR</th>
            <th scope="col">Очки</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(player, index) in players" :key="player.id">
            <td class="player-rank">{{ String((currentPage - 1) * 100 + index + 1).padStart(2, '0') }}</td>
            <td class="player-identity">
              <img v-if="player.avatarUrl" class="player-stat-avatar" :src="player.avatarUrl" alt="" />
              <span v-else class="player-stat-avatar player-stat-initial">{{ player.nickname.slice(0, 1).toUpperCase() }}</span>
              <RouterLink v-if="player.profileNickname" class="stats-player-link" :to="{ name: 'profile', params: { nickname: player.profileNickname } }">{{ player.nickname }}</RouterLink>
              <strong v-else>{{ player.nickname }}</strong>
            </td>
            <td>{{ player.rank ?? '—' }}</td>
            <td>{{ player.kills }}</td>
            <td>{{ player.deaths }}</td>
            <td class="player-highlight">{{ player.kdr.toFixed(2) }}</td>
            <td>{{ player.points }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="lastPage > 1" class="stats-pagination" aria-label="Страницы статистики игроков">
      <button class="stats-page-button" type="button" aria-label="Предыдущая страница" title="Предыдущая страница" :disabled="currentPage <= 1 || playersLoading" @click="changePage(currentPage - 1)"><ChevronLeft :size="16" /></button>
      <span>Страница {{ currentPage }} из {{ lastPage }} · {{ totalPlayers }} игроков</span>
      <button class="stats-page-button" type="button" aria-label="Следующая страница" title="Следующая страница" :disabled="currentPage >= lastPage || playersLoading" @click="changePage(currentPage + 1)"><ChevronRight :size="16" /></button>
    </div>
  </section>
</template>