<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, Ban, ChevronDown, Gamepad2, Server, Swords, Users } from '@lucide/vue'
import { getApiHealth, getGameMatches, getPublicServers } from './api'
import type { GameMatch, PublicGameServer } from './api'

type ApiState = 'checking' | 'online' | 'offline'

const apiState = ref<ApiState>('checking')
const openFaqId = ref<string | null>('servers')
const servers = ref<PublicGameServer[]>([])
const serversLoading = ref(true)
const serversError = ref('')
const warMatches = ref<GameMatch[]>([])
const mixMatches = ref<GameMatch[]>([])
const matchesLoading = ref(true)
const matchesError = ref('')

const finishedMatchesCount = ref<number | null>(null)

const onlinePlayersCount = computed(() => {
  const availableServers = servers.value.filter(server => server.playersOnline !== null)
  if (!availableServers.length) return null
  return availableServers.reduce((total, server) => total + (server.playersOnline ?? 0), 0)
})

const summaryStats = computed(() => [
  {
    label: 'Матчей сыграно',
    value: finishedMatchesCount.value?.toLocaleString('ru-RU') ?? '—',
    note: 'всего завершённых матчей',
    icon: Gamepad2,
  },
  { label: 'Игровые серверы', value: servers.value.length.toLocaleString('ru-RU'), note: 'в сообществе', icon: Server },
  {
    label: 'Игроки онлайн',
    value: onlinePlayersCount.value?.toLocaleString('ru-RU') ?? '—',
    note: 'на доступных игровых серверах',
    icon: Users,
  },
])

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
    answer: 'Откройте раздел «Баны», чтобы посмотреть блокировки на игровых серверах, найти игрока по нику или Steam ID и проверить срок бана.',
  },
]

const recentMatchSections = computed(() => [
  { mode: 'Mix' as const, matches: mixMatches.value },
  { mode: 'War' as const, matches: warMatches.value },
])

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

async function loadRecentMatches() {
  matchesLoading.value = true
  matchesError.value = ''

  try {
    const [war, mix] = await Promise.all([
      getGameMatches('War'),
      getGameMatches('Mix'),
    ])

    warMatches.value = war.matches.slice(0, 5)
    mixMatches.value = mix.matches.slice(0, 5)
    finishedMatchesCount.value = war.finishedMatches
  } catch (requestError) {
    matchesError.value = requestError instanceof Error
      ? requestError.message
      : 'Не удалось загрузить последние матчи.'
  } finally {
    matchesLoading.value = false
  }
}

function matchStatusLabel(status: GameMatch['status']) {
  return {
    live: 'Live',
    finished: 'Завершён',
    preparing: 'Подготовка',
    cancelled: 'Отменён',
  }[status]
}

function matchUpdatedLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Время неизвестно'
    : date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
}

onMounted(async () => {
  const healthRequest = getApiHealth()
    .then(() => { apiState.value = 'online' })
    .catch(() => { apiState.value = 'offline' })
  const serversRequest = loadServers()
  const matchesRequest = loadRecentMatches()

  await Promise.all([healthRequest, serversRequest, matchesRequest])
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
          <div><div class="section-kicker">ВАША ФОРМА</div><h2 id="stats-title">Статистика матчей</h2></div>
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
          <a class="server-join" :href="`steam://connect/${server.address}`" :aria-label="`Подключиться к ${server.name}`"><ArrowRight :size="17" /></a>
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
        <span class="section-count">2 <span>РЕЖИМА</span></span>
      </div>

      <div v-if="matchesLoading" class="empty-state section-empty">
        <span class="empty-icon"><Gamepad2 :size="21" /></span>
        <div><strong>Загружаем последние матчи</strong><span>Получаем результаты War и Mix.</span></div>
      </div>
      <div v-else-if="matchesError" class="empty-state section-empty" role="alert">
        <span class="empty-icon"><Gamepad2 :size="21" /></span>
        <div><strong>Не удалось загрузить матчи</strong><span>{{ matchesError }}</span></div>
        <button class="friend-action" type="button" @click="loadRecentMatches">Повторить</button>
      </div>
      <div v-else class="home-recent-matches">
        <section v-for="group in recentMatchSections" :key="group.mode" class="home-match-column" :aria-label="group.mode + ' матчи'">
          <div class="donut-group-heading">
            <Swords v-if="group.mode === 'War'" :size="17" />
            <Users v-else :size="17" />
            <h3>{{ group.mode }} — последние матчи</h3>
            <span class="donut-group-line" aria-hidden="true"></span>
            <RouterLink class="home-match-all" :to="group.mode === 'War' ? '/matches/war' : '/matches/mix'">Все матчи <ArrowRight :size="14" /></RouterLink>
          </div>

          <div v-if="group.matches.length" class="home-match-list">
            <RouterLink
              v-for="(match, index) in group.matches"
              :key="match.id"
              class="server-row home-match-row"
              :to="{ name: 'match-detail', params: { id: match.id } }"
            >
              <span class="server-number">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="server-game-icon">
                <Swords v-if="group.mode === 'War'" :size="17" />
                <Users v-else :size="17" />
              </span>
              <div class="server-main home-match-main">
                <h3>{{ match.teamA.name || 'Команда CT' }} <span>vs</span> {{ match.teamB.name || 'Команда T' }}</h3>
                <span>{{ match.serverName ? match.serverName + ' · ' : '' }}{{ match.map }} · {{ matchUpdatedLabel(match.updatedAt) }}</span>
              </div>
              <div class="home-match-score">
                <strong>{{ match.teamA.score ?? '—' }} : {{ match.teamB.score ?? '—' }}</strong>
                <span class="donut-status" :class="`is-${match.status}`">{{ matchStatusLabel(match.status) }}</span>
              </div>
              <span class="server-join" aria-hidden="true"><ArrowRight :size="16" /></span>
            </RouterLink>
          </div>
          <div v-else class="home-match-empty">Пока что матчей нет</div>
        </section>
      </div>
    </section>

    <RouterLink id="bans" to="/bans" class="bans-strip" aria-label="Открыть реестр банов">
      <span class="bans-icon"><Ban :size="17" /></span>
      <div><strong>Баны сообщества</strong><span>Реестр блокировок на игровых серверах. Поиск по нику, Steam ID и причине.</span></div>
      <span class="bans-status">ОТКРЫТЬ</span>
    </RouterLink>
  </div>
</template>
