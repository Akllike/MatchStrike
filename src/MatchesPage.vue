<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Gamepad2, ChevronLeft, ChevronRight } from '@lucide/vue'
import { getGameMatches } from './api'
import type { GameMatch } from './api'
import PageLoader from './components/PageLoader.vue'

const mode = ref<'War' | 'Mix'>('War')
const connected = ref(false)
const hasArchive = ref(false)
const matches = ref<GameMatch[]>([])
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const loading = ref(true)
const error = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let requestId = 0
let pending = false

async function load(initial = false, quiet = false) {
  if (quiet && pending) return
  const id = ++requestId
  pending = true
  if (!quiet) loading.value = true
  try {
    const data = await getGameMatches(initial ? null : mode.value, page.value)
    if (id !== requestId) return
    connected.value = data.connected
    hasArchive.value = data.hasMatches
    if (initial) {
      if (data.connected || hasArchive.value) {
        await load()
        return
      }
    }
    matches.value = data.matches
    total.value = data.pagination.total
    lastPage.value = data.pagination.lastPage
    error.value = ''
  } catch (requestError) {
    if (id === requestId) error.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить матчи.'
  } finally {
    if (id === requestId) {
      pending = false
      loading.value = false
    }
  }
}

function selectMode(value: 'War' | 'Mix') {
  if (mode.value === value) return
  mode.value = value
  page.value = 1
  void load()
}

function changePage(value: number) {
  page.value = value
  void load()
}

function statusLabel(status: GameMatch['status']) {
  return { live: 'Live', finished: 'Завершён', preparing: 'Подготовка', cancelled: 'Отменён' }[status]
}

onMounted(() => {
  void load(true)
  timer = setInterval(() => { if (!document.hidden) void load(false, true) }, 15000)
})
onUnmounted(() => { if (timer) clearInterval(timer); requestId++ })
</script>

<template>
  <section class="welcome-section route-intro" aria-labelledby="matches-page-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> ИСТОРИЯ ИГР <span class="eyebrow-slash">/</span> MATCHES</div>
      <h1 id="matches-page-title">Матчи</h1>
      <p>Результаты игр и история матчей сообщества MatchStrike.</p>
    </div>
    <div class="route-intro-mark"><Gamepad2 :size="27" :stroke-width="1.5" /></div>
  </section>

  <section class="content-section route-section" aria-labelledby="matches-list-title">
    <div class="section-heading">
      <div><div class="section-kicker">АРХИВ ИГР</div><h2 id="matches-list-title">Матчи</h2></div>
      <span class="section-count">{{ total.toLocaleString('ru-RU') }} <span>МАТЧЕЙ</span></span>
    </div>
    <div v-if="connected || hasArchive" class="donut-tabs" role="group" aria-label="Тип матчей">
      <button v-for="item in (['War', 'Mix'] as const)" :key="item" type="button" :aria-pressed="mode === item" @click="selectMode(item)">{{ item }} матчи</button>
    </div>
    <PageLoader v-if="loading" message="Загружаем матчи…" />
    <div v-else-if="error" class="admin-error" role="alert"><strong>Не удалось загрузить матчи</strong><span>{{ error }}</span><button class="friend-action" type="button" @click="load()">Повторить</button></div>
    <div v-else-if="matches.length" class="donut-match-grid">
      <RouterLink v-for="match in matches" :key="match.id" class="donut-match-card" :to="{ name: 'match-detail', params: { id: match.id } }">
        <div class="donut-match-meta"><span>МАТЧ #{{ match.id }}</span><span class="donut-status" :class="`is-${match.status}`">{{ statusLabel(match.status) }}</span></div>
        <div class="donut-match-teams"><strong>{{ match.teamA.name || 'Команда CT' }}</strong><b>{{ match.teamA.score ?? '—' }} : {{ match.teamB.score ?? '—' }}</b><strong>{{ match.teamB.name || 'Команда T' }}</strong></div>
        <div class="donut-score-label">Счёт {{ match.scoreType === 'maps' ? 'по картам' : 'по раундам' }}</div>
        <div class="donut-match-footer"><span>{{ match.mode }} · {{ match.format || 'Формат не указан' }}</span><span>Сервер #{{ match.serverNumber }}</span><span>{{ match.map }}</span><span>Обновлено: {{ new Date(match.updatedAt).toLocaleString('ru-RU') }}</span></div>
      </RouterLink>
    </div>
    <div v-else class="empty-state section-empty matches-empty"><span class="empty-icon"><Gamepad2 :size="21" /></span><div><strong>Матчей пока нет</strong><span>{{ connected ? 'Здесь появятся матчи после получения данных от сервера.' : 'История появится после подключения DonutMatch.' }}</span></div></div>
    <div v-if="lastPage > 1 && !loading && !error" class="donut-pagination">
      <button class="friend-action" type="button" :disabled="page <= 1" aria-label="Предыдущая страница" @click="changePage(page - 1)"><ChevronLeft :size="16" /></button>
      <span>{{ page }} / {{ lastPage }}</span>
      <button class="friend-action" type="button" :disabled="page >= lastPage" aria-label="Следующая страница" @click="changePage(page + 1)"><ChevronRight :size="16" /></button>
    </div>
  </section>
</template>
