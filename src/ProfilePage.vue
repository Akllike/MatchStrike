<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Activity, CalendarDays, Check, Flag, Target, Upload, UserPlus, UserRoundCheck, Users, X } from '@lucide/vue'
import MatchList from './components/MatchList.vue'
import PageLoader from './components/PageLoader.vue'
import { ApiRequestError, getPlayerProfile, reportPlayer, sendFriendRequest, updateProfileMedia } from './api'
import type { AuthUser, PlayerProfile } from './api'

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
const mediaBusy = ref<'avatar' | 'cover' | null>(null)
const mediaDialog = ref<'avatar' | 'cover' | null>(null)
const mediaDragOver = ref(false)
const mediaError = ref('')
const friendBusy = ref(false)
const reportOpen = ref(false)
const reportBusy = ref(false)
const reportMessage = ref('')
const mediaInput = ref<HTMLInputElement | null>(null)
const reportForm = ref({ reason: 'cheating' as 'cheating' | 'abuse' | 'other', details: '' })
let successToastTimeout: number | undefined

const mediaSpecs = {
  avatar: { title: 'Изменить аватар', maxWidth: 2048, maxHeight: 2048, recommended: '512 × 512', maxBytes: 5 * 1024 * 1024, maxSize: '5 МБ' },
  cover: { title: 'Изменить шапку', maxWidth: 4096, maxHeight: 1365, recommended: '1920 × 640', maxBytes: 8 * 1024 * 1024, maxSize: '8 МБ' },
} as const
const activeMediaSpec = computed(() => mediaDialog.value ? mediaSpecs[mediaDialog.value] : null)

function dismissSuccessToast() {
  if (successToastTimeout !== undefined) window.clearTimeout(successToastTimeout)
  successToastTimeout = undefined
  successToast.value = ''
}

function showSuccessToast(message: string) {
  if (successToastTimeout !== undefined) window.clearTimeout(successToastTimeout)
  successToast.value = message
  successToastTimeout = window.setTimeout(() => {
    successToast.value = ''
    successToastTimeout = undefined
  }, 5000)
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
    mediaError.value = 'Выберите изображение в формате JPG, PNG или WebP.'
    return
  }
  if (file.size > spec.maxBytes) {
    mediaError.value = `Размер файла не должен превышать ${spec.maxSize}.`
    return
  }

  let dimensions: { width: number; height: number }
  try {
    dimensions = await imageDimensions(file)
  } catch {
    mediaError.value = 'Не удалось прочитать изображение.'
    return
  }
  if (dimensions.width > spec.maxWidth || dimensions.height > spec.maxHeight) {
    mediaError.value = `Максимальное разрешение: ${spec.maxWidth} × ${spec.maxHeight} px.`
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
    mediaError.value = error instanceof ApiRequestError
      ? Object.values(error.errors).flat()[0] ?? error.message
      : 'Не удалось загрузить изображение.'
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
    if (result.status === 'pending') actionMessage.value = 'Заявка в друзья отправлена.'
  } catch (error) {
    actionMessage.value = error instanceof ApiRequestError && error.status === 401
      ? 'Войдите в аккаунт, чтобы добавить игрока в друзья.'
      : error instanceof ApiRequestError ? error.message : 'Не удалось отправить заявку.'
  } finally {
    friendBusy.value = false
  }
}

function openReportDialog() {
  if (!profile.value) return
  if (!profile.value.isAuthenticated) {
    emit('authRequested')
    return
  }
  reportOpen.value = true
}

async function submitReport() {
  if (!profile.value || reportBusy.value) return
  reportBusy.value = true
  reportMessage.value = ''
  try {
    await reportPlayer(profile.value.nickname, reportForm.value)
    reportOpen.value = false
    actionMessage.value = 'Жалоба отправлена модераторам.'
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
          <button v-if="profile.isAuthenticated" class="profile-friend-button" type="button" :disabled="friendBusy || profile.friendshipStatus !== null" @click="addFriend">
            <UserRoundCheck v-if="profile.friendshipStatus === 'accepted'" :size="16" />
            <UserPlus v-else :size="16" />
            {{ friendBusy ? 'Отправляем…' : friendshipLabel }}
          </button>
          <button class="profile-report-button" type="button" @click="openReportDialog"><Flag :size="15" /> Пожаловаться</button>
        </div>
        <RouterLink v-else-if="profile.isOwn && !profile.isBlocked" class="profile-settings-link" to="/settings">Настройки профиля</RouterLink>
      </div>
      <p v-if="actionMessage" class="profile-action-message" role="status">{{ actionMessage }}</p>
    </section>

    <section v-if="!profile.isBlocked" class="profile-section" aria-labelledby="profile-stats-title">
      <div class="section-heading">
        <div><div class="section-kicker">PLAYER PERFORMANCE</div><h2 id="profile-stats-title">Статистика игрока</h2></div>
        <span class="section-count">CS <span>STATS</span></span>
      </div>
      <div class="profile-stat-grid">
        <article v-for="(stat, index) in stats" :key="stat.label" class="profile-stat-item">
          <div class="profile-stat-label"><component :is="stat.icon" :size="15" /><span>{{ stat.label }}</span><span class="profile-stat-index">0{{ index + 1 }}</span></div>
          <strong>{{ stat.value }}</strong>
          <small>{{ stat.note }}</small>
        </article>
      </div>
      <p v-if="!profile.stats" class="profile-data-note">Статистика появится после привязки Steam ID и обновления данных сервера.</p>
      <div v-else class="profile-server-stats">
        <article v-for="server in profile.stats.servers" :key="server.serverId" class="profile-server-stat-row">
          <div class="profile-server-stat-name"><strong>{{ server.serverName }}</strong><span>{{ server.rank === null ? 'Ранг не указан' : `Ранг ${server.rank}` }}</span></div>
          <div class="profile-server-stat-values"><span>{{ server.kills }} убийств</span><span>{{ server.deaths }} смертей</span><span>{{ server.points }} очков</span></div>
          <RouterLink class="profile-server-stat-link" :to="{ name: 'stats', query: { server: server.serverId } }">Открыть сервер</RouterLink>
        </article>
      </div>
    </section>

    <section v-if="!profile.isBlocked" class="profile-section" aria-labelledby="profile-matches-title">
      <div class="section-heading">
        <div><div class="section-kicker">RECENT ACTIVITY</div><h2 id="profile-matches-title">Последние матчи</h2></div>
        <span class="section-count">{{ profile.recentMatches.length.toString().padStart(2, '0') }} <span>МАТЧЕЙ</span></span>
      </div>
      <MatchList
        :matches="profile.recentMatches"
        :limit="5"
        empty-title="История матчей пока пуста"
        empty-description="Последние игры игрока появятся после подключения матчевой статистики."
      />
    </section>

    <section v-if="!profile.isBlocked" class="profile-section" aria-labelledby="map-winrate-title">
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

    <Teleport to="body">
      <Transition name="profile-toast">
        <div v-if="successToast" class="profile-toast" role="status" aria-live="polite" aria-atomic="true">
          <span class="profile-toast-icon"><Check :size="15" :stroke-width="2.5" /></span>
          <span class="profile-toast-message">{{ successToast }}</span>
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
          <p v-if="mediaError" class="auth-message" role="alert">{{ mediaError }}</p>
          <div class="dialog-actions">
            <button class="dialog-secondary" type="button" :disabled="mediaBusy !== null" @click="closeMediaDialog">Отмена</button>
          </div>
          </section>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="reportOpen" class="modal-backdrop" @click.self="reportOpen = false">
          <form class="info-dialog report-dialog" @submit.prevent="submitReport">
          <button class="dialog-close" type="button" aria-label="Закрыть" @click="reportOpen = false"><X :size="18" /></button>
          <span class="dialog-mark"><Flag :size="20" /></span>
          <div class="section-kicker">COMMUNITY / MODERATION</div>
          <h2>Пожаловаться на {{ profile.nickname }}</h2>
          <label class="auth-field">
            <span>Причина</span>
            <select v-model="reportForm.reason" class="auth-input">
              <option value="cheating">Читы или нечестная игра</option>
              <option value="abuse">Оскорбления или травля</option>
              <option value="other">Другое нарушение</option>
            </select>
          </label>
          <label class="auth-field report-details-field">
            <span>Комментарий <small>необязательно</small></span>
            <textarea v-model.trim="reportForm.details" class="auth-input report-textarea" maxlength="1000" rows="4" placeholder="Опишите ситуацию"></textarea>
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
</template>