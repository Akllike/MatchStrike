<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Ban, ChevronLeft, ChevronRight, RefreshCw, Search, UserRound } from '@lucide/vue'
import { getBans } from './api'
import type { BanStatusFilter, SourceBan } from './api'
import PageLoader from './components/PageLoader.vue'

const bans = ref<SourceBan[]>([])
const connected = ref(false)
const counts = ref<Record<BanStatusFilter, number>>({ all: 0, active: 0, expired: 0 })
const search = ref('')
const status = ref<BanStatusFilter>('all')
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const loading = ref(true)
const error = ref('')
let requestId = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const filters: { value: BanStatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'expired', label: 'Истёкшие' },
]

const headingLabel = computed(() => status.value === 'active' ? 'АКТИВНЫЕ БАНЫ' : status.value === 'expired' ? 'ИСТЁКШИЕ БАНЫ' : 'ВСЕ БАНЫ')

async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const data = await getBans(page.value, search.value, status.value)
    if (id !== requestId) return
    connected.value = data.connected
    bans.value = data.bans
    counts.value = data.counts
    total.value = data.pagination.total
    lastPage.value = data.pagination.lastPage
  } catch (requestError) {
    if (id === requestId) error.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить список банов.'
  } finally {
    if (id === requestId) loading.value = false
  }
}

function selectStatus(value: BanStatusFilter) {
  if (status.value === value) return
  status.value = value
  page.value = 1
  void load()
}

function changePage(value: number) {
  page.value = value
  void load()
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})

onMounted(() => { void load() })
onUnmounted(() => {
  requestId++
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <section class="welcome-section route-intro" aria-labelledby="bans-page-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> БЕЗОПАСНОСТЬ СООБЩЕСТВА <span class="eyebrow-slash">/</span> MODERATION</div>
      <h1 id="bans-page-title">Баны <span>сообщества</span></h1>
      <p>Список блокировок на игровых серверах MatchStrike.</p>
    </div>
    <div class="route-intro-mark"><Ban :size="27" :stroke-width="1.5" /></div>
  </section>

  <section class="content-section route-section" aria-labelledby="ban-registry-title">
    <div class="section-heading">
      <div><div class="section-kicker">{{ headingLabel }}</div><h2 id="ban-registry-title">Реестр блокировок</h2></div>
      <span class="section-count">{{ total.toLocaleString('ru-RU') }} <span>ЗАПИСЕЙ</span></span>
    </div>

    <div class="bans-toolbar">
      <label class="bans-search">
        <Search :size="16" aria-hidden="true" />
        <input v-model="search" type="search" maxlength="100" placeholder="Никнейм, Steam ID или причина" aria-label="Поиск по банам" />
      </label>
      <button class="admin-server-icon-button bans-refresh" type="button" :disabled="loading" aria-label="Обновить список банов" title="Обновить список" @click="load"><RefreshCw :size="15" :class="{ 'is-spinning': loading }" /></button>
    </div>

    <div class="bans-filter-tabs" role="group" aria-label="Фильтр банов">
      <button v-for="item in filters" :key="item.value" type="button" :aria-pressed="status === item.value" @click="selectStatus(item.value)">
        {{ item.label }} <span>{{ counts[item.value].toLocaleString('ru-RU') }}</span>
      </button>
    </div>

    <Transition name="profile-content" mode="out-in">
      <PageLoader v-if="loading" key="loading" message="Загружаем реестр банов…" />
      <div v-else-if="error" key="error" class="admin-error" role="alert">
        <strong>Не удалось загрузить баны</strong><span>{{ error }}</span>
        <button class="friend-action" type="button" @click="load">Повторить</button>
      </div>
      <div v-else-if="!connected" key="not-connected" class="empty-state section-empty bans-empty">
        <span class="empty-icon"><Ban :size="22" :stroke-width="1.5" /></span>
        <div><strong>SourceBans не подключён</strong><span>Подключите базу SourceBans в панели управления серверами, чтобы опубликовать список блокировок.</span></div>
      </div>
      <div v-else-if="bans.length" key="list" class="bans-table-wrap">
        <table class="bans-table">
          <thead><tr><th>Игрок</th><th>Причина</th><th>Дата бана</th><th>Окончание</th><th>Статус</th></tr></thead>
          <tbody>
            <tr v-for="ban in bans" :key="`${ban.serverId}-${ban.id}`">
              <td class="bans-player-cell">
                <div class="bans-player-main">
                  <img v-if="ban.account?.avatarUrl" class="bans-player-avatar" :src="ban.account.avatarUrl" alt="" loading="lazy" />
                  <span v-else class="bans-player-avatar is-placeholder"><UserRound :size="15" /></span>
                  <div class="bans-player-details">
                    <RouterLink v-if="ban.account" class="bans-player-link" :to="ban.account.profileUrl">{{ ban.player }}</RouterLink>
                    <strong v-else>{{ ban.player }}</strong>
                    <code>{{ ban.authId || 'Steam ID не указан' }}</code>
                  </div>
                </div>
              </td>
              <td class="bans-reason-cell">{{ ban.reason }}</td>
              <td>{{ formatDate(ban.createdAt) }}</td>
              <td>{{ ban.permanent ? 'Навсегда' : formatDate(ban.endsAt) }}</td>
              <td><span class="bans-state" :class="`is-${ban.status}`">{{ ban.status === 'active' ? (ban.permanent ? 'Навсегда' : 'Активен') : 'Истёк' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else key="empty" class="empty-state section-empty bans-empty">
        <span class="empty-icon"><Ban :size="22" :stroke-width="1.5" /></span>
        <div><strong>{{ search ? 'Ничего не найдено' : 'Записей пока нет' }}</strong><span>{{ search ? 'Попробуйте изменить поисковый запрос.' : 'В выбранной категории пока нет блокировок.' }}</span></div>
      </div>
    </Transition>

    <div v-if="lastPage > 1 && !loading && !error" class="donut-pagination">
      <button class="friend-action" type="button" :disabled="page <= 1" aria-label="Предыдущая страница" @click="changePage(page - 1)"><ChevronLeft :size="16" /></button>
      <span>{{ page }} / {{ lastPage }}</span>
      <button class="friend-action" type="button" :disabled="page >= lastPage" aria-label="Следующая страница" @click="changePage(page + 1)"><ChevronRight :size="16" /></button>
    </div>
  </section>
</template>
