<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Gamepad2 } from '@lucide/vue'
import { getGameMatch } from './api'
import type { GameMatch } from './api'
import PageLoader from './components/PageLoader.vue'

const route = useRoute()
const match = ref<GameMatch | null>(null)
const loading = ref(true)
const error = ref('')
let timer: ReturnType<typeof setInterval> | undefined
let requestId = 0
let pending = false

async function load(quiet = false) {
  if (quiet && pending) return
  const id = ++requestId
  pending = true
  if (!quiet) loading.value = true
  try {
    const result = await getGameMatch(String(route.params.id))
    if (id !== requestId) return
    match.value = result
    error.value = ''
  } catch (requestError) {
    if (id === requestId) error.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить матч.'
  } finally {
    if (id === requestId) {
      pending = false
      loading.value = false
    }
  }
}
watch(() => route.params.id, () => { match.value = null; void load() })
onMounted(() => {
  void load()
  timer = setInterval(() => { if (!document.hidden) void load(true) }, 15000)
})
onUnmounted(() => { if (timer) clearInterval(timer); requestId++ })
</script>

<template>
  <section class="welcome-section route-intro">
    <div class="welcome-copy">
      <RouterLink class="donut-back" :to="{ name: 'matches' }"><ArrowLeft :size="14" /> Все матчи</RouterLink>
      <div class="eyebrow"><span class="eyebrow-line"></span> MATCHSTRIKE <span class="eyebrow-slash">/</span> MATCH</div>
      <h1>Матч #{{ route.params.id }}</h1>
      <p>Информация об игре и результате.</p>
    </div>
    <div class="route-intro-mark"><Gamepad2 :size="27" :stroke-width="1.5" /></div>
  </section>
  <section class="content-section route-section">
    <PageLoader v-if="loading" message="Загружаем матч…" />
    <div v-else-if="error" class="admin-error" role="alert"><strong>Не удалось загрузить матч</strong><span>{{ error }}</span><button class="friend-action" type="button" @click="load()">Повторить</button></div>
    <article v-else-if="match" class="donut-match-card donut-detail">
      <div class="donut-match-meta"><span>{{ match.mode }} · {{ match.format || 'Формат не указан' }}</span><span class="donut-status" :class="`is-${match.status}`">{{ { live: 'Live', finished: 'Завершён', preparing: 'Подготовка', cancelled: 'Отменён' }[match.status] }}</span></div>
      <div class="donut-match-teams"><strong>{{ match.teamA.name || 'Команда CT' }}</strong><b>{{ match.teamA.score ?? '—' }} : {{ match.teamB.score ?? '—' }}</b><strong>{{ match.teamB.name || 'Команда T' }}</strong></div>
      <div class="donut-score-label">Счёт {{ match.scoreType === 'maps' ? 'по картам' : 'по раундам' }}</div>
      <div class="donut-match-footer"><span>Сервер #{{ match.serverNumber }}{{ match.serverName ? ` · ${match.serverName}` : '' }}</span><span>Карта: {{ match.map }}</span><span>Обновлено: {{ new Date(match.updatedAt).toLocaleString('ru-RU') }}</span></div>
      <p v-if="match.scoreType === 'maps'" class="donut-round-score">Раунды на текущей карте: {{ match.roundTeams[0].name || 'CT' }} {{ match.roundTeams[0].score }} : {{ match.roundTeams[1].score }} {{ match.roundTeams[1].name || 'T' }}</p>
      <p class="donut-detail-note">Дополнительная статистика матча появится здесь после её подключения.</p>
    </article>
  </section>
</template>
