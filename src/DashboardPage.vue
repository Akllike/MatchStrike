<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Activity, ArrowUpRight, Ban, ChevronDown, Gamepad2, Users } from '@lucide/vue'
import { getApiHealth, getPublicServers } from './api'
import type { PublicGameServer } from './api'
import MatchList from './components/MatchList.vue'

type ApiState = 'checking' | 'online' | 'offline'

interface MatchRecord {
  id: string
  map: string
  mode: string
  playedAt: string
  winner: string
  score: string
}

const apiState = ref<ApiState>('checking')
const openFaqId = ref<string | null>('servers')
const servers = ref<PublicGameServer[]>([])
const serversLoading = ref(true)
const serversError = ref('')
const recentMatches: MatchRecord[] = []

const summaryStats = [
  { label: 'Матчей сыграно', value: '—', note: 'последние матчи', icon: Gamepad2 },
  { label: 'Победы', value: '—', note: 'процент побед', icon: Activity },
  { label: 'Игроки онлайн', value: '—', note: 'на всех серверах', icon: Users },
]

const faqItems = [
  {
    id: 'servers',
    question: 'Как подключиться к серверу?',
    answer: 'Выберите сервер в списке ниже и нажмите кнопку подключения. Список появится после настройки игровых серверов.',
  },
  {
    id: 'matches',
    question: 'Где посмотреть результаты матчей?',
    answer: 'Последние пять матчей сообщества будут отображаться в разделе «Последние матчи».',
  },
  {
    id: 'account',
    question: 'Как создать аккаунт?',
    answer: 'Нажмите «Регистрация» вверху страницы. Форма станет доступна после подключения авторизации.',
  },
  {
    id: 'bans',
    question: 'Где проверить список банов?',
    answer: 'Откройте раздел «Баны» в боковом меню. Список появится после подключения API модерации.',
  },
]

const apiMessage = computed(() => {
  if (apiState.value === 'checking') return 'Проверяем подключение к API.'
  if (apiState.value === 'offline') return 'Не удалось загрузить данные. Попробуйте обновить страницу.'
  return servers.value.length
    ? 'Серверы сообщества доступны для подключения.'
    : 'Игровые данные появятся после подключения серверов к MatchStrike.'
})

function toggleFaq(id: string) {
  openFaqId.value = openFaqId.value === id ? null : id
}

async function loadServers(showError = true) {
  try {
    servers.value = await getPublicServers()
    serversError.value = ''
  } catch (requestError) {
    if (showError || servers.value.length === 0) {
      serversError.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить список серверов.'
    }
  } finally {
    serversLoading.value = false
  }
}

onMounted(async () => {
  const healthRequest = getApiHealth()
    .then(() => { apiState.value = 'online' })
    .catch(() => { apiState.value = 'offline' })
  const serversRequest = loadServers()

  await Promise.all([healthRequest, serversRequest])
})
</script>

<template>
  <div class="dashboard-view">
    <section class="welcome-section" aria-labelledby="page-title">
      <div class="welcome-copy">
        <div class="eyebrow"><span class="eyebrow-line"></span> COUNTER-STRIKE <span class="eyebrow-slash">/</span> COMMUNITY</div>
        <h1 id="page-title">Match<span>Strike</span></h1>
        <p>Матчи сообщества, игровые серверы и статистика игроков — в одном месте.</p>
      </div>
      <div class="welcome-stamp" aria-hidden="true">
        <span class="stamp-top">PLAY TOGETHER</span>
        <Gamepad2 :size="30" :stroke-width="1.4" />
        <span class="stamp-bottom">EST. MMXXIV</span>
      </div>
    </section>

    <div class="overview-grid">
      <section id="match-stats" class="section-panel stats-panel" aria-labelledby="stats-title">
        <div class="panel-heading">
          <div><div class="section-kicker">ВАША ФОРМА</div><h2 id="stats-title">Статистика последних матчей</h2></div>
          <span class="panel-index">01</span>
        </div>
        <div class="stats-list">
          <article v-for="(stat, index) in summaryStats" :key="stat.label" class="stat-row">
            <span class="stat-icon"><component :is="stat.icon" :size="17" :stroke-width="1.8" /></span>
            <span class="stat-copy"><strong>{{ stat.label }}</strong><small>{{ stat.note }}</small></span>
            <strong class="stat-value">{{ stat.value }}</strong>
            <span class="stat-number">0{{ index + 1 }}</span>
          </article>
        </div>
        <p class="panel-note"><span class="note-mark"></span>{{ apiMessage }}</p>
      </section>

      <section id="faq" class="section-panel faq-panel" aria-labelledby="faq-title">
        <div class="panel-heading">
          <div><div class="section-kicker">ОТВЕТЫ НА ВОПРОСЫ</div><h2 id="faq-title">FAQ</h2></div>
          <span class="panel-index">04</span>
        </div>
        <div class="faq-list">
          <article v-for="item in faqItems" :key="item.id" class="faq-item" :class="{ 'is-open': openFaqId === item.id }">
            <button class="faq-question" type="button" :aria-expanded="openFaqId === item.id" @click="toggleFaq(item.id)">
              <span>{{ item.question }}</span>
              <ChevronDown :size="15" :stroke-width="1.8" />
            </button>
            <p v-if="openFaqId === item.id" class="faq-answer">{{ item.answer }}</p>
          </article>
        </div>
      </section>
    </div>

    <section id="servers" class="content-section" aria-labelledby="servers-title">
      <div class="section-heading">
        <div><div class="section-kicker">ПОДКЛЮЧАЙСЯ К ИГРЕ</div><h2 id="servers-title">Игровые серверы</h2></div>
        <span class="section-count">{{ servers.length.toString().padStart(2, '0') }} <span>СЕРВЕРОВ</span></span>
      </div>
      <div v-if="serversLoading" class="empty-state section-empty">
        <span class="empty-icon"><Gamepad2 :size="23" :stroke-width="1.5" /></span>
        <div><strong>Загружаем серверы</strong><span>Получаем актуальный список серверов сообщества.</span></div>
      </div>
      <div v-else-if="serversError" class="empty-state section-empty" role="alert">
        <span class="empty-icon"><Gamepad2 :size="23" :stroke-width="1.5" /></span>
        <div><strong>Список серверов недоступен</strong><span>{{ serversError }}</span></div>
      </div>
      <div v-else-if="servers.length" class="server-list">
          <article v-for="(server, index) in servers" :key="server.id" class="server-row" :class="{ 'has-query-data': server.playersOnline !== null }">
          <span class="server-number">0{{ index + 1 }}</span>
          <span class="server-game-icon"><Gamepad2 :size="19" /></span>
          <div class="server-main"><h3>{{ server.name }}</h3><span>{{ server.mode }} <i></i> {{ server.map || 'Карта не получена' }}</span></div>
          <div class="server-players" :class="{ 'has-query-data': server.playersOnline !== null }"><Users :size="15" /><strong>{{ server.playersOnline ?? '—' }}</strong><span>/ {{ server.playerLimit ?? '—' }}</span></div>
          <a class="server-join" :href="`steam://connect/${server.address}`" :aria-label="`Подключиться к ${server.name}`"><ArrowUpRight :size="17" /></a>
        </article>
      </div>
      <div v-else class="empty-state section-empty">
        <span class="empty-icon"><Gamepad2 :size="23" :stroke-width="1.5" /></span>
        <div><strong>Серверы ещё не подключены</strong><span>Когда игровые серверы появятся в MatchStrike, здесь будут режимы, карты и онлайн.</span></div>
      </div>
    </section>

    <section id="last-matches" class="content-section matches-section" aria-labelledby="matches-title">
      <div class="section-heading">
        <div><div class="section-kicker">ИСТОРИЯ ИГР</div><h2 id="matches-title">Последние матчи</h2></div>
        <span class="section-count">{{ recentMatches.length }} <span>ИЗ 5</span></span>
      </div>
      <MatchList
        :matches="recentMatches"
        :limit="5"
        empty-title="История матчей пока пуста"
        empty-description="Здесь появятся пять последних матчей сообщества."
      />
    </section>

    <section id="bans" class="bans-strip" aria-label="Раздел банов">
      <span class="bans-icon"><Ban :size="17" /></span>
      <div><strong>Баны сообщества</strong><span>Список блокировок станет доступен после подключения API модерации.</span></div>
      <span class="bans-status">СКОРО</span>
    </section>
  </div>
</template>