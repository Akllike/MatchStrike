<script setup lang="ts">
import { Activity, ChevronLeft, ChevronRight } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { getStatsPlayers } from './api'
import type { StatsPlayer } from './api'

const players = ref<StatsPlayer[]>([])
const currentPage = ref(1)
const lastPage = ref(1)
const totalPlayers = ref(0)
const updatedAt = ref<string | null>(null)
const playersLoading = ref(false)
let playerRequestId = 0

function formattedDate(value: string | null): string {
  if (!value) return 'Нет данных об обновлении'
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? `Обновлено ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp)}`
    : 'Время обновления неизвестно'
}

async function loadStats(page = currentPage.value) {
  const requestId = ++playerRequestId
  playersLoading.value = true

  try {
    const result = await getStatsPlayers(page)
    if (requestId !== playerRequestId) return

    players.value = result.players
    currentPage.value = result.pagination.currentPage
    lastPage.value = result.pagination.lastPage
    totalPlayers.value = result.pagination.total
    updatedAt.value = result.updatedAt
  } catch {
    if (requestId === playerRequestId) {
      players.value = []
      totalPlayers.value = 0
      updatedAt.value = null
    }
  } finally {
    if (requestId === playerRequestId) playersLoading.value = false
  }
}

function changePage(page: number) {
  if (page < 1 || page > lastPage.value || page === currentPage.value || playersLoading.value) return
  void loadStats(page)
}

onMounted(() => void loadStats())
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

    <div v-if="players.length" class="stats-toolbar">
      <span class="stats-updated">{{ formattedDate(updatedAt) }}</span>
    </div>

    <p v-if="!players.length" class="stats-no-data">Нет данных</p>
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