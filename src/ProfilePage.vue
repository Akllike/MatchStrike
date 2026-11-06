<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Activity, CalendarDays, Check, Film, Flag, Share2, Target, Trophy, Upload, UserPlus, UserRound, UserRoundMinus, Users, X, ChevronLeft, ChevronRight } from '@lucide/vue'
import PageLoader from './components/PageLoader.vue'
import ProfileMatchList from './components/ProfileMatchList.vue'
import { socialIdFromValue, socialProfileUrl } from './socialLinks'
import { ApiRequestError, getPlayerMatches, getPlayerProfile, removeFriendFromList, reportPlayer, sendFriendRequest, updateProfileMedia } from './api'
import type { AuthUser, GameMatch, PlayerProfile } from './api'

const emit = defineEmits<{
  accountUpdated: [user: AuthUser]
  authRequested: []
}>()

const route = useRoute()
const profile = ref<PlayerProfile | null>(null)
const loading = ref(true)
const loadError = ref('')
const actionMessage = ref('')
const successToast = ref('')
const toastTone = ref<'success' | 'error'>('success')
const toastTicketId = ref<number | null>(null)
const mediaBusy = ref<'avatar' | 'cover' | null>(null)
const mediaDialog = ref<'avatar' | 'cover' | null>(null)
const mediaDragOver = ref(false)
const mediaError = ref('')
const friendBusy = ref(false)
const removeFriendOpen = ref(false)
const reportOpen = ref(false)
const reportBusy = ref(false)
const reportMessage = ref('')
const mediaInput = ref<HTMLInputElement | null>(null)
const reportForm = ref({ reason: 'cheating' as 'cheating' | 'abuse' | 'other', details: '' })
const reportReasons = [
  { value: 'cheating', label: 'Читы или нечестная игра' },
  { value: 'abuse', label: 'Оскорбления или травля' },
  { value: 'other', label: 'Другое нарушение' },
] as const
let successToastTimeout: number | undefined

const mediaSpecs = {
  avatar: { title: 'Изменить аватар', maxWidth: 2048, maxHeight: 2048, recommended: '512 × 512', maxBytes: 5 * 1024 * 1024, maxSize: '5 МБ' },
  cover: { title: 'Изменить шапку', maxWidth: 4096, maxHeight: 1365, recommended: '1920 × 640', maxBytes: 8 * 1024 * 1024, maxSize: '8 МБ' },
} as const
const activeMediaSpec = computed(() => mediaDialog.value ? mediaSpecs[mediaDialog.value] : null)
const profileTabs = [
  { id: 'overview', label: 'Основное', icon: UserRound },
  { id: 'statistics', label: 'Статистика', icon: Activity },
  { id: 'matches', label: 'Матчи', icon: Trophy },
  { id: 'moments', label: 'Моменты', icon: Film },
  { id: 'friends', label: 'Друзья', icon: Users },
] as const
type ProfileTabId = typeof profileTabs[number]['id']
const activeProfileTab = ref<ProfileTabId>('overview')
const profileMatches = ref<GameMatch[]>([])
const profileMatchesPage = ref(1)
const profileMatchesLastPage = ref(1)
const profileMatchesTotal = ref(0)
const profileMatchesLoading = ref(false)
const profileMatchesError = ref('')
let profileMatchesRequest = 0
const profileTabElements = ref<HTMLButtonElement[]>([])

function focusProfileTab(index: number) {
  const nextIndex = (index + profileTabs.length) % profileTabs.length
  selectProfileTab(profileTabs[nextIndex].id)
  nextTick(() => profileTabElements.value[nextIndex]?.focus())
}

function dismissSuccessToast() {
  if (successToastTimeout !== undefined) window.clearTimeout(successToastTimeout)
  successToastTimeout = undefined
  successToast.value = ''
  toastTicketId.value = null
}

function showTopToast(message: string, tone: 'success' | 'error' = 'success', ticketId: number | null = null) {
  if (successToastTimeout !== undefined) window.clearTimeout(successToastTimeout)
  successToastTimeout = undefined
  toastTone.value = tone
  toastTicketId.value = ticketId
  successToast.value = message
  if (ticketId === null) successToastTimeout = window.setTimeout(dismissSuccessToast, 5000)
}

function showSuccessToast(message: string) {
  showTopToast(message)
}

function showMediaError(message: string) {
  mediaError.value = message
  showTopToast(message, 'error')
}

onBeforeUnmount(dismissSuccessToast)

const nickname = computed(() => String(route.params.nickname ?? ''))
const stats = computed(() => {
  const values = profile.value?.stats
  const bestRank = values?.servers.reduce<number | null>((best, server) =>
    server.rank !== null && (best === null || server.rank < best) ? server.rank : best, null) ?? null
  return [
    { label: 'Убийства', value: values?.kills ?? '—', note: 'всего на серверах', icon: Activity },
    { label: 'Смерти', value: values?.deaths ?? '—', note: 'всего на серверах', icon: Users },
    { label: 'KDR', value: values?.kdr.toFixed(2) ?? '—', note: 'kills / deaths', icon: Target },
    { label: 'Очки', value: values?.points ?? '—', note: 'суммарно', icon: Target },
    { label: 'Серверы', value: values?.servers.length ?? '—', note: 'с результатами', icon: Activity },
    { label: 'Лучший ранг', value: bestRank ?? '—', note: 'среди серверов', icon: Target },
  ]
})
const mapTotals = computed(() => (profile.value?.mapWinRates ?? []).reduce((totals, map) => {
  totals.matches += map.matches
  totals.wins += map.wins
  return totals
}, { matches: 0, wins: 0 }))
const detailedStats = computed(() => {
  const values = profile.value?.stats
  const { matches, wins } = mapTotals.value
  return [
    { label: 'KDR', value: values?.kdr.toFixed(2) ?? '—', note: 'По статистике серверов' },
    { label: 'Winrate', value: matches ? `${Math.round(wins / matches * 100)}%` : '—', note: matches ? `${wins} побед из ${matches} матчей` : 'Нет данных по матчам' },
    { label: 'ADR', value: '—', note: 'Нет матчевой статистики' },
    { label: 'HS%', value: '—', note: 'Нет матчевой статистики' },
    { label: 'Матчи', value: matches || '—', note: matches ? 'По доступным картам' : 'Нет данных по матчам' },
    { label: 'Убийства', value: values?.kills ?? '—', note: 'На подключённых серверах' },
    { label: 'Смерти', value: values?.deaths ?? '—', note: 'На подключённых серверах' },
    { label: 'Очки', value: values?.points ?? '—', note: 'На подключённых серверах' },
    { label: 'Частое оружие', value: '—', note: 'Нет данных по оружию' },
  ]
})

const friendshipLabel = computed(() => {
  if (profile.value?.friendshipStatus === 'accepted') return 'Уже в друзьях'
  if (profile.value?.friendshipStatus === 'pending') return 'Заявка отправлена'
  if (profile.value?.friendshipStatus === 'incoming') return 'Есть входящая заявка'
  return 'Добавить в друзья'
})

const joinedLabel = computed(() => {
  if (!profile.value?.joinedAt) return 'Участник MatchStrike'
  return `В MatchStrike с ${new Date(`${profile.value.joinedAt}T00:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`
})

async function loadProfile() {
  if (!nickname.value) return
  loading.value = true
  loadError.value = ''
  actionMessage.value = ''
  profileMatches.value = []
  profileMatchesPage.value = 1
  profileMatchesLastPage.value = 1
  profileMatchesTotal.value = 0
  profileMatchesError.value = ''
  profileMatchesLoading.value = false
  profileMatchesRequest++
  activeProfileTab.value = 'overview'
  dismissSuccessToast()

  try {
    profile.value = await getPlayerProfile(nickname.value)
  } catch (error) {
    profile.value = null
    loadError.value = error instanceof ApiRequestError && error.status === 404
      ? 'Игрок с таким никнеймом не найден.'
      : 'Не удалось загрузить профиль. Попробуйте ещё раз.'
  } finally {
    loading.value = false
  }
}

async function loadProfileMatches(page = 1) {
  if (!nickname.value || profileMatchesLoading.value) return
  const requestId = ++profileMatchesRequest
  profileMatchesLoading.value = true
  profileMatchesError.value = ''
  try {
    const data = await getPlayerMatches(nickname.value, page)
    if (requestId !== profileMatchesRequest) return
    profileMatches.value = data.matches
    profileMatchesPage.value = data.pagination.currentPage
    profileMatchesLastPage.value = data.pagination.lastPage
    profileMatchesTotal.value = data.pagination.total
  } catch (error) {
    if (requestId === profileMatchesRequest) {
      profileMatchesError.value = error instanceof Error ? error.message : 'Не удалось загрузить матчи.'
    }
  } finally {
    if (requestId === profileMatchesRequest) profileMatchesLoading.value = false
  }
}

function selectProfileTab(tab: ProfileTabId) {
  activeProfileTab.value = tab
  if (tab === 'matches' && !profileMatches.value.length && profileMatchesTotal.value === 0 && !profileMatchesLoading.value) {
    void loadProfileMatches(1)
  }
}

function changeProfileMatchesPage(page: number) {
  if (page < 1 || page > profileMatchesLastPage.value || profileMatchesLoading.value) return
  void loadProfileMatches(page)
}


function openMediaDialog(field: 'avatar' | 'cover') {
  mediaDialog.value = field
  mediaDragOver.value = false
  mediaError.value = ''
}

function closeMediaDialog() {
  if (mediaBusy.value !== null) return
  mediaDialog.value = null
  mediaDragOver.value = false
  mediaError.value = ''
}

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Не удалось прочитать изображение.'))
    }
    image.src = objectUrl
  })
}

async function uploadMedia(file: File, field: 'avatar' | 'cover') {
  const spec = mediaSpecs[field]
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showMediaError('Выберите изображение в формате JPG, PNG или WebP.')
    return
  }
  if (file.size > spec.maxBytes) {
    showMediaError(`Размер файла не должен превышать ${spec.maxSize}.`)
    return
  }

  let dimensions: { width: number; height: number }
  try {
    dimensions = await imageDimensions(file)
  } catch {
    showMediaError('Не удалось прочитать изображение.')
    return
  }
  if (dimensions.width > spec.maxWidth || dimensions.height > spec.maxHeight) {
    showMediaError(`Максимальное разрешение: ${spec.maxWidth} × ${spec.maxHeight} px.`)
    return
  }

  mediaBusy.value = field
  mediaError.value = ''
  actionMessage.value = ''
  try {
    const user = await updateProfileMedia({ [field]: file })
    emit('accountUpdated', user)
    profile.value = await getPlayerProfile(user.nickname)
    showSuccessToast(field === 'avatar' ? 'Аватар профиля обновлён' : 'Шапка профиля обновлена')
    mediaDialog.value = null
    mediaDragOver.value = false
  } catch (error) {
    showMediaError(error instanceof ApiRequestError
      ? Object.values(error.errors).flat()[0] ?? error.message
      : 'Не удалось загрузить изображение.')
  } finally {
    mediaBusy.value = null
  }
}

function handleMediaInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const field = mediaDialog.value
  input.value = ''
  if (file && field) void uploadMedia(file, field)
}

function handleMediaDrop(event: DragEvent) {
  mediaDragOver.value = false
  if (mediaBusy.value !== null) return
  const file = event.dataTransfer?.files[0]
  const field = mediaDialog.value
  if (file && field) void uploadMedia(file, field)
}

async function addFriend() {
  if (!profile.value || friendBusy.value) return
  friendBusy.value = true
  actionMessage.value = ''
  try {
    const result = await sendFriendRequest(profile.value.nickname)
    profile.value.friendshipStatus = result.status
    if (result.status === 'pending') showSuccessToast('Заявка в друзья отправлена')
  } catch (error) {
    actionMessage.value = error instanceof ApiRequestError && error.status === 401
      ? 'Войдите в аккаунт, чтобы добавить игрока в друзья.'
      : error instanceof ApiRequestError ? error.message : 'Не удалось отправить заявку.'
  } finally {
    friendBusy.value = false
  }
}

async function confirmRemoveFriend() {
  if (!profile.value || friendBusy.value) return
  friendBusy.value = true
  try {
    await removeFriendFromList(profile.value.nickname)
    profile.value = await getPlayerProfile(profile.value.nickname)
    removeFriendOpen.value = false
    showSuccessToast('Пользователь удалён из друзей')
  } catch (error) {
    actionMessage.value = error instanceof ApiRequestError ? error.message : 'Не удалось удалить пользователя из друзей.'
    removeFriendOpen.value = false
  } finally { friendBusy.value = false }
}

const socialPlatforms = [
  { id: 'telegram', label: 'Telegram', icon: 'telegram-svgrepo-com.svg' },
  { id: 'instagram', label: 'Instagram', icon: 'instagram-1-svgrepo-com.svg' },
  { id: 'youtube', label: 'YouTube', icon: 'youtube-svgrepo-com.svg' },
  { id: 'twitch', label: 'Twitch', icon: 'twitch-v2-svgrepo-com.svg' },
  { id: 'trovo', label: 'Trovo', icon: 'trovo.svg' },
  { id: 'boosty', label: 'Boosty', icon: 'boosty.svg' },
] as const
const visibleSocialPlatforms = computed(() => socialPlatforms.filter(({ id }) => profile.value?.socialLinks?.[id]))

function socialUsername(platform: typeof socialPlatforms[number]['id']): string {
  return socialIdFromValue(platform, profile.value?.socialLinks?.[platform])
}

function openReportDialog() {
  if (!profile.value) return
  if (!profile.value.isAuthenticated) {
    emit('authRequested')
    return
  }
  reportMessage.value = ''
  actionMessage.value = ''
  reportOpen.value = true
}

async function submitReport() {
  if (!profile.value || reportBusy.value) return
  reportBusy.value = true
  reportMessage.value = ''
  try {
    const result = await reportPlayer(profile.value.nickname, reportForm.value)
    reportOpen.value = false
    showTopToast('Жалоба отправлена модераторам. Создано обращение.', 'success', result.ticketId)
    reportForm.value.details = ''
  } catch (error) {
    reportMessage.value = error instanceof ApiRequestError && error.status === 401
      ? 'Войдите в аккаунт, чтобы отправить жалобу.'
      : error instanceof ApiRequestError ? error.message : 'Не удалось отправить жалобу.'
  } finally {
    reportBusy.value = false
  }
}

watch(nickname, loadProfile, { immediate: true })
</script>

<template>
  <Transition name="profile-content" mode="out-in">
    <PageLoader v-if="loading" message="Загружаем профиль…" />
    <div v-else-if="loadError" class="empty-state section-empty profile-state-error">
      <span class="empty-icon"><Users :size="21" /></span>
      <div><strong>{{ loadError }}</strong><span>Проверьте ссылку и попробуйте ещё раз.</span></div>
    </div>
    <div v-else-if="profile" class="profile-page">
    <section class="profile-hero" :class="{ 'is-blocked': profile.isBlocked }" aria-label="Профиль игрока">
      <div class="profile-cover" :class="{ 'has-cover': profile.coverUrl, 'is-blocked': profile.isBlocked }" :style="profile.coverUrl ? { backgroundImage: `linear-gradient(90deg, rgba(10,11,12,.76), rgba(10,11,12,.12)), url('${profile.coverUrl}')` } : undefined">
        <div class="profile-cover-code">MATCHSTRIKE <span>/ PLAYER CARD</span></div>
        <template v-if="profile.isOwn">
          <button class="profile-edit-cover" type="button" :disabled="mediaBusy !== null" @click="openMediaDialog('cover')">
            Изменить шапку
          </button>
        </template>
      </div>
      <div class="profile-identity-row">
        <div class="profile-avatar-large-wrap" :class="{ 'is-blocked': profile.isBlocked, 'has-avatar': profile.avatarUrl }">
          <img v-if="profile.avatarUrl" class="profile-avatar-large" :src="profile.avatarUrl" alt="" />
          <span v-else class="profile-avatar-large profile-avatar-fallback">{{ profile.nickname.slice(0, 1).toUpperCase() }}</span>
          <template v-if="profile.isOwn">
            <button class="avatar-edit-button" type="button" aria-label="Изменить аватар" :disabled="mediaBusy !== null" @click="openMediaDialog('avatar')">+</button>
          </template>
        </div>
        <div class="profile-title-group">
          <h1>{{ profile.nickname }}</h1>
          <span v-if="!profile.isBlocked"><CalendarDays :size="13" /> {{ joinedLabel }}</span>
          <strong v-if="profile.isBlocked" class="profile-blocked-notice">Профиль пользователя заблокирован.</strong>
        </div>
        <div v-if="!profile.isOwn && !profile.isBlocked" class="profile-actions">
          <button v-if="profile.isAuthenticated && profile.friendshipStatus === 'accepted'" class="profile-friend-button profile-remove-friend-button" type="button" :disabled="friendBusy" @click="removeFriendOpen = true">
            <UserRoundMinus :size="16" /> Удалить из друзей
          </button>
          <button v-else-if="profile.isAuthenticated" class="profile-friend-button" type="button" :disabled="friendBusy || profile.friendshipStatus !== null" @click="addFriend">
            <UserPlus :size="16" /> {{ friendBusy ? 'Отправляем…' : friendshipLabel }}
          </button>
          <button class="profile-report-button" type="button" @click="openReportDialog"><Flag :size="15" /> Пожаловаться</button>
        </div>
        <RouterLink v-else-if="profile.isOwn && !profile.isBlocked" class="profile-settings-link" to="/settings">Настройки профиля</RouterLink>
      </div>
      <p v-if="actionMessage" class="profile-action-message" role="status">{{ actionMessage }}</p>
    </section>

    <div v-if="!profile.isBlocked" class="profile-tabs" role="tablist" aria-label="Разделы профиля">
      <button
        v-for="(tab, index) in profileTabs"
        :id="`profile-tab-${tab.id}`"
        :key="tab.id"
        ref="profileTabElements"
        class="profile-tab"
        type="button"
        role="tab"
        :aria-selected="activeProfileTab === tab.id"
        :aria-controls="`profile-panel-${tab.id}`"
        :tabindex="activeProfileTab === tab.id ? 0 : -1"
        @click="selectProfileTab(tab.id)"
        @keydown.right.prevent="focusProfileTab(index + 1)"
        @keydown.left.prevent="focusProfileTab(index - 1)"
        @keydown.home.prevent="focusProfileTab(0)"
        @keydown.end.prevent="focusProfileTab(profileTabs.length - 1)"
      >
        <component :is="tab.icon" :size="15" :stroke-width="1.8" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <Transition name="profile-tab-swap" mode="out-in">
    <div
      v-if="!profile.isBlocked && activeProfileTab === 'overview'"
      id="profile-panel-overview"
      class="profile-tab-panel"
      role="tabpanel"
      aria-labelledby="profile-tab-overview"
      tabindex="0"
    >
    <section class="profile-section" aria-labelledby="profile-stats-title">
      <div class="section-heading">
        <div><div class="section-kicker">PLAYER PERFORMANCE</div><h2 id="profile-stats-title">Основная информация</h2></div>
        <span class="section-count">CS <span>STATS</span></span>
      </div>
      <div class="profile-overview-grid">
        <div class="profile-overview-main">
          <div class="profile-stat-grid">
            <article v-for="(stat, index) in stats" :key="stat.label" class="profile-stat-item">
              <div class="profile-stat-label"><component :is="stat.icon" :size="15" /><span>{{ stat.label }}</span><span class="profile-stat-index">0{{ index + 1 }}</span></div>
              <strong>{{ stat.value }}</strong>
              <small>{{ stat.note }}</small>
            </article>
          </div>
          <div v-if="profile.stats" class="profile-server-stats">
            <article v-for="server in profile.stats.servers" :key="server.serverId" class="profile-server-stat-row">
              <div class="profile-server-stat-name"><strong>{{ server.serverName }}</strong><span>{{ server.rank === null ? 'Ранг не указан' : `Ранг ${server.rank}` }}</span></div>
              <div class="profile-server-stat-values"><span>{{ server.kills }} убийств</span><span>{{ server.deaths }} смертей</span><span>{{ server.points }} очков</span></div>
              <RouterLink class="profile-server-stat-link" :to="{ name: 'stats', query: { server: server.serverId } }">Открыть сервер</RouterLink>
            </article>
          </div>
        </div>
        <div class="profile-overview-aside">
          <section class="profile-aside-card" aria-labelledby="profile-social-title">
            <div class="profile-aside-title"><Share2 :size="15" /><h3 id="profile-social-title">Социальные сети</h3></div>
            <div v-if="visibleSocialPlatforms.length" class="profile-friends-stack profile-social-stack">
              <a
                v-for="platform in visibleSocialPlatforms"
                :key="platform.id"
                class="profile-friends-stack-item profile-social-stack-item"
                :href="socialProfileUrl(platform.id, profile?.socialLinks?.[platform.id]) ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
                :title="`${platform.label} · ${socialUsername(platform.id)}`"
                :aria-label="`Открыть ${platform.label}: ${socialUsername(platform.id)}`"
              >
                <img :src="`/uploads/icons/${platform.icon}`" alt="" aria-hidden="true" width="38" height="38" loading="lazy" />
              </a>
            </div>
            <p v-else class="profile-aside-note">Пользователь пока не добавил ссылки на социальные сети.</p>
          </section>
          <section class="profile-aside-card" aria-labelledby="profile-friends-mini-title">
            <div class="profile-aside-title"><Users :size="15" /><h3 id="profile-friends-mini-title">Друзья</h3><button v-if="profile.friends.length" class="profile-friends-open" type="button" @click="selectProfileTab('friends')">Все друзья · {{ profile.friends.length }}</button></div>
            <template v-if="profile.friends.length">
              <div class="profile-friends-stack">
                <RouterLink
                  v-for="friend in profile.friends.slice(0, 5)"
                  :key="friend.id"
                  class="profile-friends-stack-item"
                  :to="{ name: 'profile', params: { nickname: friend.nickname } }"
                  :title="friend.nickname"
                  :aria-label="`Открыть профиль ${friend.nickname}`"
                >
                  <img v-if="friend.avatarUrl" :src="friend.avatarUrl" alt="" />
                  <template v-else>{{ friend.nickname.slice(0, 1).toUpperCase() }}</template>
                </RouterLink>
                <button
                  v-if="profile.friends.length > 5"
                  class="profile-friends-stack-item profile-friends-stack-more"
                  type="button"
                  :title="`Все друзья: ${profile.friends.length}`"
                  @click="selectProfileTab('friends')"
                >+{{ profile.friends.length - 5 }}</button>
              </div>
            </template>
            <p v-else class="profile-aside-note">Список друзей пока пуст. Принятые друзья игрока появятся здесь.</p>
          </section>
        </div>
      </div>
    </section>

    <section class="profile-section" aria-labelledby="profile-matches-title">
      <div class="section-heading">
        <div><div class="section-kicker">RECENT ACTIVITY</div><h2 id="profile-matches-title">Последние матчи</h2></div>
        <div class="profile-matches-heading-actions">
          <button
            v-if="profile.recentMatches.length"
            class="profile-matches-more inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
            type="button"
            @click="selectProfileTab('matches')"
          >Все матчи <ChevronRight :size="14" /></button>
        </div>
      </div>
      <ProfileMatchList :matches="profile.recentMatches.slice(0, 5)" />
    </section>

    <section class="profile-section" aria-labelledby="map-winrate-title">
      <div class="section-heading">
        <div><div class="section-kicker">MAP PERFORMANCE</div><h2 id="map-winrate-title">Винрейт по картам</h2></div>
        <span class="section-count">{{ profile.mapWinRates.length.toString().padStart(2, '0') }} <span>КАРТ</span></span>
      </div>
      <div v-if="profile.mapWinRates.length" class="map-winrate-list">
        <article v-for="map in profile.mapWinRates" :key="map.map" class="map-winrate-row">
          <strong>{{ map.map }}</strong>
          <div class="map-winrate-track"><span :style="{ width: `${map.winRate}%` }"></span></div>
          <span class="map-winrate-value">{{ map.winRate }}%</span>
          <small>{{ map.wins }} / {{ map.matches }} побед</small>
        </article>
      </div>
      <div v-else class="empty-state section-empty map-winrate-empty">
        <span class="empty-icon"><Target :size="21" /></span>
        <div><strong>Нет данных по картам</strong><span>Винрейт появится после завершённых матчей.</span></div>
      </div>
    </section>
    </div>

    <section
      v-else-if="!profile.isBlocked && activeProfileTab === 'statistics'"
      id="profile-panel-statistics"
      class="profile-tab-panel profile-section"
      role="tabpanel"
      aria-labelledby="profile-tab-statistics"
      tabindex="0"
    >
      <div class="section-heading">
        <div><div class="section-kicker">PLAYER PERFORMANCE</div><h2>Подробная статистика</h2></div>
        <span class="section-count">CS <span>STATS</span></span>
      </div>
      <div class="profile-detail-grid">
        <article v-for="stat in detailedStats" :key="stat.label" class="profile-detail-card">
          <span class="profile-detail-label">{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
          <small>{{ stat.note }}</small>
        </article>
      </div>
      <p class="profile-data-note">ADR, HS% и популярное оружие появятся после подключения матчевой статистики.</p>

      <section class="profile-section" aria-labelledby="profile-detail-maps-title">
        <div class="section-heading">
          <div><div class="section-kicker">MAP PERFORMANCE</div><h2 id="profile-detail-maps-title">Winrate по картам</h2></div>
          <span class="section-count">{{ profile.mapWinRates.length.toString().padStart(2, '0') }} <span>КАРТ</span></span>
        </div>
        <div v-if="profile.mapWinRates.length" class="map-winrate-list">
          <article v-for="map in profile.mapWinRates" :key="map.map" class="map-winrate-row">
            <strong>{{ map.map }}</strong>
            <div class="map-winrate-track"><span :style="{ width: `${map.winRate}%` }"></span></div>
            <span class="map-winrate-value">{{ map.winRate }}%</span>
            <small>{{ map.wins }} / {{ map.matches }} побед</small>
          </article>
        </div>
        <div v-else class="empty-state section-empty map-winrate-empty">
          <span class="empty-icon"><Target :size="21" /></span>
          <div><strong>Нет данных по картам</strong><span>Винрейт появится после завершённых матчей.</span></div>
        </div>
      </section>
    </section>

    <section
      v-else-if="!profile.isBlocked && activeProfileTab === 'matches'"
      id="profile-panel-matches"
      class="profile-tab-panel profile-section"
      role="tabpanel"
      aria-labelledby="profile-tab-matches"
      tabindex="0"
    >
      <div class="section-heading">
        <div><div class="section-kicker">MATCH HISTORY</div><h2>Все матчи игрока</h2></div>
        <span class="section-count">{{ profileMatchesTotal.toString().padStart(2, '0') }} <span>МАТЧЕЙ</span></span>
      </div>
      <p v-if="profileMatchesError" class="auth-message" role="alert">{{ profileMatchesError }} <button class="auth-inline-link" type="button" @click="loadProfileMatches(profileMatchesPage)">Повторить</button></p>
      <PageLoader v-else-if="profileMatchesLoading && !profileMatches.length" message="Загружаем историю матчей…" />
      <ProfileMatchList v-else :matches="profileMatches" />
      <div v-if="profileMatchesLastPage > 1" class="donut-pagination profile-matches-pagination">
        <button class="friend-action" type="button" :disabled="profileMatchesPage <= 1 || profileMatchesLoading" aria-label="Предыдущая страница" @click="changeProfileMatchesPage(profileMatchesPage - 1)"><ChevronLeft :size="16" /></button>
        <span>{{ profileMatchesPage }} / {{ profileMatchesLastPage }}</span>
        <button class="friend-action" type="button" :disabled="profileMatchesPage >= profileMatchesLastPage || profileMatchesLoading" aria-label="Следующая страница" @click="changeProfileMatchesPage(profileMatchesPage + 1)"><ChevronRight :size="16" /></button>
      </div>
    </section>

    <section
      v-else-if="!profile.isBlocked && activeProfileTab === 'moments'"
      id="profile-panel-moments"
      class="profile-tab-panel profile-section"
      role="tabpanel"
      aria-labelledby="profile-tab-moments"
      tabindex="0"
    >
      <div class="section-heading">
        <div><div class="section-kicker">MATCH HIGHLIGHTS</div><h2>Моменты игрока</h2></div>
        <span class="section-count">MVP</span>
      </div>
      <div class="empty-state section-empty profile-tab-empty">
        <span class="empty-icon"><Film :size="21" /></span>
        <div><strong>MVP-матчи пока недоступны</strong><span>Здесь появятся матчи, где игрок стал MVP, когда подключится источник матчевой статистики.</span></div>
      </div>
    </section>

    <section
      v-else-if="!profile.isBlocked && activeProfileTab === 'friends'"
      id="profile-panel-friends"
      class="profile-tab-panel profile-section"
      role="tabpanel"
      aria-labelledby="profile-tab-friends"
      tabindex="0"
    >
      <div class="section-heading">
        <div><div class="section-kicker">MATCHSTRIKE / SOCIAL</div><h2>Друзья игрока</h2></div>
        <span class="section-count">{{ profile.friends.length.toString().padStart(2, '0') }} <span>ДРУЗЕЙ</span></span>
      </div>
      <div v-if="profile.friends.length" class="friends-list profile-friends-list">
        <article v-for="friend in profile.friends" :key="friend.id" class="friend-row">
          <RouterLink class="friend-request-avatar-link" :to="{ name: 'profile', params: { nickname: friend.nickname } }" :aria-label="`Открыть профиль ${friend.nickname}`">
            <span v-if="friend.avatarUrl" class="friend-avatar-wrap"><img class="friend-avatar" :src="friend.avatarUrl" alt="" /></span>
            <span v-else class="friend-avatar friend-avatar-fallback">{{ friend.nickname.slice(0, 1).toUpperCase() }}</span>
          </RouterLink>
          <div class="friend-details">
            <RouterLink class="friend-request-nickname" :to="{ name: 'profile', params: { nickname: friend.nickname } }">{{ friend.nickname }}</RouterLink>
            <span class="friend-last-seen">Профиль MatchStrike</span>
          </div>
          <div class="friend-actions profile-friend-actions">
            <RouterLink class="friend-action friend-profile-action" :to="{ name: 'profile', params: { nickname: friend.nickname } }">
              <UserRound :size="15" /> Профиль
            </RouterLink>
          </div>
        </article>
      </div>
      <div v-else class="empty-state section-empty friends-empty">
        <span class="empty-icon"><Users :size="21" /></span>
        <div><strong>Список друзей пока пуст</strong><span>Принятые друзья игрока появятся здесь.</span></div>
      </div>
    </section>
    </Transition>

    <Teleport to="body">
      <Transition name="profile-toast">
        <div v-if="successToast" class="profile-toast" :class="{ 'is-error': toastTone === 'error' }" :role="toastTone === 'error' ? 'alert' : 'status'" :aria-live="toastTone === 'error' ? 'assertive' : 'polite'" aria-atomic="true">
          <span class="profile-toast-icon motion-safe:animate-pulse"><X v-if="toastTone === 'error'" :size="15" :stroke-width="2.5" /><Check v-else :size="15" :stroke-width="2.5" /></span>
          <span class="profile-toast-message">{{ successToast }}</span>
          <RouterLink v-if="toastTicketId !== null" class="profile-toast-action dialog-primary" :to="{ name: 'tickets', query: { ticket: String(toastTicketId) } }" @click="dismissSuccessToast">Перейти</RouterLink>
          <button class="profile-toast-close" type="button" aria-label="Закрыть уведомление" @click="dismissSuccessToast"><X :size="15" /></button>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="mediaDialog && activeMediaSpec" class="modal-backdrop" @click.self="closeMediaDialog">
          <section class="info-dialog media-dialog" role="dialog" aria-modal="true" aria-labelledby="media-dialog-title">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="mediaBusy !== null" @click="closeMediaDialog"><X :size="18" /></button>
          <span class="dialog-mark"><Upload :size="20" /></span>
          <div class="section-kicker">PROFILE / IMAGE</div>
          <h2 id="media-dialog-title">{{ activeMediaSpec.title }}</h2>
          <input ref="mediaInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="handleMediaInputChange" />
          <div
            class="media-dropzone"
            :class="{ 'is-dragover': mediaDragOver }"
            :aria-busy="mediaBusy !== null"
            @dragover.prevent="mediaDragOver = true"
            @dragleave.prevent="mediaDragOver = false"
            @drop.prevent="handleMediaDrop"
          >
            <Upload :size="22" />
            <strong>{{ mediaBusy ? 'Загружаем изображение…' : 'Перетащите файл в эту область' }}</strong>
            <span>или</span>
            <button class="dialog-secondary media-select-button" type="button" :disabled="mediaBusy !== null" @click="mediaInput?.click()">Выбрать файл</button>
            <small>JPG, PNG или WebP · до {{ activeMediaSpec.maxSize }}</small>
          </div>
          <div class="media-resolution-grid">
            <div><span>Рекомендуемое</span><strong>{{ activeMediaSpec.recommended }} px</strong></div>
            <div><span>Максимальное</span><strong>{{ activeMediaSpec.maxWidth }} × {{ activeMediaSpec.maxHeight }} px</strong></div>
          </div>
          <div class="dialog-actions">
            <button class="dialog-secondary" type="button" :disabled="mediaBusy !== null" @click="closeMediaDialog">Отмена</button>
          </div>
          </section>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="reportOpen" class="modal-backdrop" @click.self="reportOpen = false">
          <form class="info-dialog report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" @keydown.esc="reportOpen = false" @submit.prevent="submitReport">
          <button class="dialog-close" type="button" aria-label="Закрыть" @click="reportOpen = false"><X :size="18" /></button>
          <div class="report-dialog-heading">
            <span class="dialog-mark"><Flag :size="20" /></span>
            <div><div class="section-kicker">COMMUNITY / MODERATION</div><h2 id="report-dialog-title">Пожаловаться на игрока</h2></div>
          </div>
          <p class="report-dialog-subtitle">Жалоба на <strong>{{ profile.nickname }}</strong></p>
          <fieldset class="report-reasons">
            <legend>Причина жалобы</legend>
            <div class="report-reason-options">
              <label v-for="reason in reportReasons" :key="reason.value" class="report-reason" :class="{ 'is-selected': reportForm.reason === reason.value }">
                <input v-model="reportForm.reason" type="radio" name="report-reason" :value="reason.value" />
                <span>{{ reason.label }}</span>
              </label>
            </div>
          </fieldset>
          <label class="auth-field report-details-field">
            <span class="report-details-heading"><span>Комментарий <small>необязательно</small></span><span class="report-character-count">{{ reportForm.details.length }} / 1000</span></span>
            <textarea v-model="reportForm.details" class="auth-input report-textarea" maxlength="1000" rows="4" placeholder="Расскажите подробнее о ситуации"></textarea>
          </label>
          <p v-if="reportMessage" class="auth-message" role="alert">{{ reportMessage }}</p>
          <div class="dialog-actions">
            <button class="dialog-secondary" type="button" @click="reportOpen = false">Отмена</button>
            <button class="dialog-primary" type="submit" :disabled="reportBusy">{{ reportBusy ? 'Отправляем…' : 'Отправить жалобу' }}</button>
          </div>
          </form>
        </div>
      </Transition>
    </Teleport>
    </div>
  </Transition>
  <Transition name="modal">
    <div v-if="removeFriendOpen" class="modal-backdrop" @click.self="removeFriendOpen = false" @keydown.esc="removeFriendOpen = false">
      <section class="info-dialog profile-remove-friend-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-friend-title">
        <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="friendBusy" @click="removeFriendOpen = false"><X :size="17" /></button>
        <span class="dialog-mark"><Users :size="20" /></span>
        <h2 id="remove-friend-title">Удалить из друзей?</h2>
        <p>Вы уверены, что хотите удалить {{ profile?.nickname }} из списка друзей?</p>
        <div class="dialog-actions"><button class="dialog-secondary" type="button" :disabled="friendBusy" @click="removeFriendOpen = false">Отмена</button><button class="profile-confirm-remove" type="button" :disabled="friendBusy" @click="confirmRemoveFriend">{{ friendBusy ? 'Удаляем…' : 'Удалить из друзей' }}</button></div>
      </section>
    </div>
  </Transition>
</template>
