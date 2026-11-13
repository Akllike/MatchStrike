<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Gamepad2, LoaderCircle, Swords, Users } from '@lucide/vue'
import { getGameMatches } from './api'
import type { GameMatch } from './api'
import PageLoader from './components/PageLoader.vue'
import { handleMapImageError, matchMapImage } from './matchArtwork'
import { formatMatchDuration } from './matchDuration'

const route = useRoute()
const router = useRouter()
const mode = computed<'War' | 'Mix'>(() => route.params.mode === 'war' ? 'War' : 'Mix')
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
const loadingMore = ref(false)
let loadMoreArmed = true

const matchGroups = computed(() => {
  const live = matches.value.filter(match => match.status === 'live')
  const preparing = matches.value.filter(match => match.status === 'preparing')
  const archive = matches.value.filter(match => match.status === 'finished' || match.status === 'cancelled')
  const archiveTitle = archive.every(match => match.status === 'cancelled') ? 'Отменённые матчи'
    : archive.some(match => match.status === 'cancelled') ? 'Завершённые и отменённые' : 'Завершённые матчи'
  return [
    { key: 'live', title: 'Live матчи', matches: live },
    { key: 'preparing', title: 'Подготовка к матчу', matches: preparing },
    { key: 'archive', title: archiveTitle, matches: archive },
  ].filter(group => group.matches.length)
})

async function load(quiet = false, append = false) {
  if (pending) return
  const requestedMode = mode.value
  const requestedPage = append ? page.value + 1 : quiet ? 1 : page.value
  if (append && requestedPage > lastPage.value) return
  const id = ++requestId
  pending = true
  if (!quiet && !append) loading.value = true
  if (append) loadingMore.value = true
  const minimumLoading = quiet ? Promise.resolve() : new Promise<void>(resolve => setTimeout(resolve, 350))
  try {
    const data = await getGameMatches(requestedMode, requestedPage)
    if (id !== requestId || requestedMode !== mode.value) return
    connected.value = data.connected
    hasArchive.value = data.hasMatches
    if (append) {
      const existingIds = new Set(matches.value.map(match => match.id))
      matches.value = [...matches.value, ...data.matches.filter(match => !existingIds.has(match.id))]
      page.value = requestedPage
    } else if (quiet) {
      const refreshed = new Map(data.matches.map(match => [match.id, match]))
      const existingIds = new Set(matches.value.map(match => match.id))
      matches.value = [
        ...data.matches.filter(match => !existingIds.has(match.id)),
        ...matches.value.map(match => refreshed.get(match.id) ?? match),
      ]
    } else {
      matches.value = data.matches
      page.value = requestedPage
    }
    total.value = data.pagination.total
    lastPage.value = data.pagination.lastPage
    error.value = ''
  } catch (requestError) {
    if (id === requestId) error.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить матчи.'
  } finally {
    await minimumLoading
    if (id === requestId) {
      pending = false
      loading.value = false
      loadingMore.value = false
      if (append && document.documentElement.scrollHeight <= window.innerHeight + 500 && page.value < lastPage.value) {
        loadMoreArmed = false
        requestAnimationFrame(() => void load(true, true))
      }
    }
  }
}

function selectMode(value: 'War' | 'Mix') {
  if (mode.value === value) return
  page.value = 1
  void router.push({
    name: 'matches-mode',
    params: { mode: value.toLowerCase() },
  })
}

function onScroll() {
  const distanceToBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY
  if (distanceToBottom > 900) loadMoreArmed = true
  if (loadMoreArmed && distanceToBottom <= 500 && !pending && page.value < lastPage.value) {
    loadMoreArmed = false
    void load(true, true)
  }
}

function statusLabel(status: GameMatch['status']) {
  return { live: 'Live', finished: 'Завершён', preparing: 'Подготовка', cancelled: 'Отменён' }[status]
}

watch(() => route.params.mode, () => {
  requestId++
  pending = false
  loadingMore.value = false
  matches.value = []
  loadMoreArmed = true
  loading.value = true
  page.value = 1
  void load()
})

onMounted(() => {
  void load()
  timer = setInterval(() => { if (!document.hidden) void load(true) }, 15000)
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => { if (timer) clearInterval(timer); window.removeEventListener('scroll', onScroll); requestId++ })
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
    <div v-if="connected || hasArchive" class="donut-tabs" :class="{ 'is-war': mode === 'War' }" role="group" aria-label="Тип матчей">
      <button v-for="item in (['Mix', 'War'] as const)" :key="item" type="button" :aria-pressed="mode === item" @click="selectMode(item)">
        <Swords v-if="item === 'War'" :size="16" /><Users v-else :size="16" /><span>{{ item }} матчи</span>
      </button>
    </div>
    <Transition name="profile-content" mode="out-in">
      <PageLoader v-if="loading" key="loading" :message="`Загружаем ${mode} матчи…`" />
      <div v-else-if="error" key="error" class="admin-error" role="alert"><strong>Не удалось загрузить матчи</strong><span>{{ error }}</span><button class="friend-action" type="button" @click="load()">Повторить</button></div>
      <div v-else-if="matches.length" :key="`${mode}-${page}`" class="donut-match-groups">
        <section v-for="group in matchGroups" :key="group.key" class="donut-match-group" :aria-label="group.title">
          <div class="donut-group-heading"><span v-if="group.key === 'live'" class="donut-group-live-dot" aria-hidden="true"></span><h3>{{ group.title }}</h3><span class="donut-group-line" aria-hidden="true"></span></div>
          <div class="donut-match-grid">
            <RouterLink v-for="match in group.matches" :key="match.id" class="donut-match-card" :to="{ name: 'match-detail', params: { id: match.id } }">
              <img v-if="matchMapImage(match.map)" :key="match.map" class="donut-card-map" :src="matchMapImage(match.map) ?? undefined" alt="" aria-hidden="true" @error="handleMapImageError" />
              <div class="donut-match-meta"><span>МАТЧ #{{ match.id }}</span><span class="donut-status" :class="`is-${match.status}`">{{ statusLabel(match.status) }}</span></div>
              <div class="donut-match-teams"><strong>{{ match.teamA.name || 'Команда CT' }}</strong><b>{{ match.teamA.score ?? '—' }} : {{ match.teamB.score ?? '—' }}</b><strong>{{ match.teamB.name || 'Команда T' }}</strong></div>
              <div class="donut-score-label">Счёт {{ match.scoreType === 'maps' ? 'по картам' : 'по раундам' }}</div>
              <div class="donut-match-footer"><span>{{ match.mode }} · {{ match.format || (match.mode === 'Mix' ? 'Classic' : 'Формат не указан') }}</span><span>Сервер #{{ match.serverNumber }}{{ match.serverName ? ` · ${match.serverName}` : '' }}</span><span>{{ match.map }}</span><span>Длительность: {{ formatMatchDuration(match.durationSeconds) }}</span><span>Обновлено: {{ new Date(match.updatedAt).toLocaleString('ru-RU') }}</span></div>
            </RouterLink>
          </div>
        </section>
      </div>
      <div v-else key="empty" class="empty-state section-empty matches-empty"><span class="empty-icon"><Gamepad2 :size="21" /></span><div><strong>Матчей пока нет</strong><span>{{ connected ? 'Здесь появятся матчи после получения данных от сервера.' : 'История появится после подключения DonutMatch.' }}</span></div></div>
    </Transition>
    <div v-if="loadingMore" class="donut-pagination" role="status"><LoaderCircle class="is-spinning" :size="16" /> Загружаем ещё матчи…</div>
  </section>
</template>
