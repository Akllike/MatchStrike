<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Clock3, Trash2, UserPlus, UserRound, Users, X } from '@lucide/vue'
import {
  acceptFriendRequest,
  ApiRequestError,
  getFriends,
  getIncomingFriendRequests,
  rejectFriendRequest,
  removeFriendFromList,
  sendFriendRequest,
} from './api'
import type { FriendSummary, IncomingFriendRequest } from './api'
import PageLoader from './components/PageLoader.vue'

type ToastTone = 'success' | 'warning' | 'error'

const friends = ref<FriendSummary[]>([])
const requests = ref<IncomingFriendRequest[]>([])
const pageLoading = ref(true)
const loading = ref(true)
const requestsLoading = ref(true)
const error = ref('')
const requestsError = ref('')
const removingNickname = ref<string | null>(null)
const requestBusyId = ref<number | null>(null)
const requestBusyAction = ref<'accept' | 'reject' | null>(null)
const friendNickname = ref('')
const sendingRequest = ref(false)
const toastMessage = ref('')
const toastTone = ref<ToastTone>('success')
let toastTimeout: number | undefined

function dismissToast() {
  if (toastTimeout !== undefined) window.clearTimeout(toastTimeout)
  toastTimeout = undefined
  toastMessage.value = ''
}

function showToast(message: string, tone: ToastTone) {
  if (toastTimeout !== undefined) window.clearTimeout(toastTimeout)
  toastMessage.value = message
  toastTone.value = tone
  toastTimeout = window.setTimeout(dismissToast, 5000)
}

onBeforeUnmount(dismissToast)

async function loadFriends() {
  const startedAt = Date.now()
  loading.value = true
  error.value = ''
  try {
    friends.value = await getFriends()
  } catch (requestError) {
    error.value = requestError instanceof ApiRequestError && requestError.status === 401
      ? 'Войдите в аккаунт, чтобы открыть список друзей.'
      : requestError instanceof Error ? requestError.message : 'Не удалось загрузить друзей.'
  } finally {
    const remaining = 300 - (Date.now() - startedAt)
    if (remaining > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, remaining)
      })
    }
    loading.value = false
  }
}

async function loadRequests() {
  requestsLoading.value = true
  requestsError.value = ''
  try {
    requests.value = await getIncomingFriendRequests()
  } catch (requestError) {
    requestsError.value = requestError instanceof ApiRequestError && requestError.status === 401
      ? 'Войдите в аккаунт, чтобы открыть входящие заявки.'
      : requestError instanceof Error ? requestError.message : 'Не удалось загрузить заявки.'
  } finally {
    requestsLoading.value = false
  }
}

function requestDateLabel(sentAt: string | null): string {
  if (!sentAt) return 'Запрос на добавление в друзья'
  const timestamp = Date.parse(sentAt)
  if (!Number.isFinite(timestamp)) return 'Запрос на добавление в друзья'
  return `Запрос отправлен ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(timestamp)}`
}

async function addFriend() {
  const nickname = friendNickname.value.trim()
  if (!nickname || sendingRequest.value) return

  sendingRequest.value = true
  try {
    const result = await sendFriendRequest(nickname)
    if (result.alreadySent) {
      showToast(`Запрос игроку ${nickname} уже отправлен.`, 'warning')
    } else if (result.status === 'pending') {
      friendNickname.value = ''
      showToast(`Запрос игроку ${nickname} отправлен.`, 'success')
    } else if (result.status === 'incoming') {
      showToast(`${nickname} уже отправил вам заявку. Проверьте входящие.`, 'warning')
      await loadRequests()
    } else {
      showToast(`${nickname} уже у вас в друзьях.`, 'warning')
    }
  } catch (requestError) {
    const message = requestError instanceof ApiRequestError && requestError.status === 404
      ? 'Пользователь с таким никнеймом не найден.'
      : requestError instanceof ApiRequestError && requestError.status === 401
        ? 'Войдите в аккаунт, чтобы отправить запрос.'
        : requestError instanceof Error ? requestError.message : 'Не удалось отправить запрос.'
    showToast(message, 'error')
  } finally {
    sendingRequest.value = false
  }
}

async function acceptRequest(friendRequest: IncomingFriendRequest) {
  if (requestBusyId.value !== null) return
  requestBusyId.value = friendRequest.id
  requestBusyAction.value = 'accept'
  try {
    await acceptFriendRequest(friendRequest.id)
    requests.value = requests.value.filter((request) => request.id !== friendRequest.id)
    await loadFriends()
    showToast(`${friendRequest.nickname} теперь в друзьях.`, 'success')
  } catch (requestError) {
    showToast(requestError instanceof Error ? requestError.message : 'Не удалось принять заявку.', 'error')
  } finally {
    requestBusyId.value = null
    requestBusyAction.value = null
  }
}

async function rejectRequest(friendRequest: IncomingFriendRequest) {
  if (requestBusyId.value !== null) return
  requestBusyId.value = friendRequest.id
  requestBusyAction.value = 'reject'
  try {
    await rejectFriendRequest(friendRequest.id)
    requests.value = requests.value.filter((request) => request.id !== friendRequest.id)
    showToast(`Заявка от ${friendRequest.nickname} отклонена.`, 'success')
  } catch (requestError) {
    showToast(requestError instanceof Error ? requestError.message : 'Не удалось отклонить заявку.', 'error')
  } finally {
    requestBusyId.value = null
    requestBusyAction.value = null
  }
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false
  const timestamp = Date.parse(lastSeenAt)
  return Number.isFinite(timestamp) && Date.now() - timestamp < 5 * 60 * 1000
}

function lastSeenLabel(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Последний визит неизвестен'

  const timestamp = Date.parse(lastSeenAt)
  if (!Number.isFinite(timestamp)) return 'Последний визит неизвестен'

  const elapsed = Math.max(0, Date.now() - timestamp)
  if (elapsed < 5 * 60 * 1000) return 'В сети'
  if (elapsed < 60 * 60 * 1000) return `Был в сети ${Math.max(1, Math.floor(elapsed / 60000))} мин. назад`
  if (elapsed < 24 * 60 * 60 * 1000) return `Был в сети ${Math.floor(elapsed / 3600000)} ч. назад`

  return `Был в сети ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)}`
}

async function removeFriend(friend: FriendSummary) {
  if (removingNickname.value) return

  removingNickname.value = friend.nickname
  actionMessage.value = ''
  error.value = ''
  try {
    await removeFriendFromList(friend.nickname)
    friends.value = friends.value.filter((item) => item.id !== friend.id)
    actionMessage.value = `${friend.nickname} удалён из друзей.`
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'Не удалось удалить друга.'
  } finally {
    removingNickname.value = null
  }
}

const actionMessage = ref('')

async function loadPage() {
  pageLoading.value = true
  try {
    await Promise.all([loadFriends(), loadRequests()])
  } finally {
    pageLoading.value = false
  }
}

onMounted(loadPage)
</script>

<template>
  <Transition name="profile-content" mode="out-in">
    <PageLoader v-if="pageLoading" key="loading" message="Загружаем друзей…" />
    <div v-else key="content" class="friends-page-content">
  <section class="welcome-section route-intro" aria-labelledby="friends-page-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> COMMUNITY <span class="eyebrow-slash">/</span> FRIENDS</div>
      <h1 id="friends-page-title">Ваши <span>друзья</span></h1>
      <p>Профили игроков, с которыми вы играете в MatchStrike.</p>
    </div>
    <div class="route-intro-mark"><Users :size="27" :stroke-width="1.5" /></div>
  </section>

  <section class="content-section route-section" aria-labelledby="friend-add-title">
    <div class="section-heading">
      <div><div class="section-kicker">MATCHSTRIKE / SOCIAL</div><h2 id="friend-add-title">Добавить друга</h2></div>
    </div>
    <form class="friend-add-form" @submit.prevent="addFriend">
      <label class="auth-field" for="friend-nickname">Никнейм игрока</label>
      <div class="friend-add-control">
        <input id="friend-nickname" v-model="friendNickname" class="auth-input" type="text" autocomplete="off" placeholder="Введите никнейм" required />
        <button class="dialog-primary friend-add-button" type="submit" :disabled="sendingRequest || !friendNickname.trim()">
          <UserPlus :size="15" /> {{ sendingRequest ? 'Отправляем…' : 'Отправить запрос' }}
        </button>
      </div>
    </form>
  </section>

  <section class="content-section route-section" aria-labelledby="friend-requests-title">
    <div class="section-heading">
      <div><div class="section-kicker">MATCHSTRIKE / SOCIAL</div><h2 id="friend-requests-title">Входящие запросы</h2></div>
      <span class="section-count">{{ requests.length.toString().padStart(2, '0') }} <span>ЗАЯВОК</span></span>
    </div>

    <div v-if="requestsLoading" class="friends-loading" role="status"><span class="friends-loading-spinner" aria-hidden="true"></span> Загружаем запросы…</div>
    <div v-else-if="requestsError" class="friends-error" role="alert">
      <span>{{ requestsError }}</span>
      <button class="friend-action" type="button" @click="loadRequests">Повторить</button>
    </div>
    <div v-else-if="requests.length" class="friends-list">
      <article v-for="friendRequest in requests" :key="friendRequest.id" class="friend-row">
        <RouterLink class="friend-request-avatar-link" :to="{ name: 'profile', params: { nickname: friendRequest.nickname } }" :aria-label="`Открыть профиль ${friendRequest.nickname}`">
          <span v-if="friendRequest.avatarUrl" class="friend-avatar-wrap"><img class="friend-avatar" :src="friendRequest.avatarUrl" alt="" /></span>
          <span v-else class="friend-avatar friend-avatar-fallback">{{ friendRequest.nickname.slice(0, 1).toUpperCase() }}</span>
        </RouterLink>
        <div class="friend-details">
          <RouterLink class="friend-request-nickname" :to="{ name: 'profile', params: { nickname: friendRequest.nickname } }">{{ friendRequest.nickname }}</RouterLink>
          <span class="friend-last-seen">{{ requestDateLabel(friendRequest.sentAt) }}</span>
        </div>
        <div class="friend-actions">
          <button class="friend-action friend-accept-action" type="button" :disabled="requestBusyId !== null" @click="acceptRequest(friendRequest)">
            <Check :size="15" /> {{ requestBusyId === friendRequest.id && requestBusyAction === 'accept' ? 'Принимаем…' : 'Принять' }}
          </button>
          <button class="friend-action friend-reject-action" type="button" :disabled="requestBusyId !== null" @click="rejectRequest(friendRequest)">
            <X :size="15" /> {{ requestBusyId === friendRequest.id && requestBusyAction === 'reject' ? 'Отклоняем…' : 'Отклонить' }}
          </button>
        </div>
      </article>
    </div>
    <div v-else class="empty-state section-empty friends-empty">
      <span class="empty-icon"><UserPlus :size="21" /></span>
      <div><strong>Входящих запросов пока нет</strong><span>Новые заявки появятся здесь.</span></div>
    </div>
  </section>

  <section class="content-section route-section" aria-labelledby="friends-list-title">
    <div class="section-heading">
      <div><div class="section-kicker">MATCHSTRIKE / SOCIAL</div><h2 id="friends-list-title">Список друзей</h2></div>
      <span class="section-count">{{ friends.length.toString().padStart(2, '0') }} <span>ДРУЗЕЙ</span></span>
    </div>

    <div v-if="loading" class="friends-loading" role="status"><span class="friends-loading-spinner" aria-hidden="true"></span> Загружаем друзей…</div>
    <div v-else-if="error" class="friends-error" role="alert">
      <span>{{ error }}</span>
      <button class="friend-action" type="button" @click="loadFriends">Повторить</button>
    </div>
    <div v-else-if="friends.length" class="friends-list">
      <article v-for="friend in friends" :key="friend.id" class="friend-row">
        <div class="friend-avatar-wrap">
          <img v-if="friend.avatarUrl" class="friend-avatar" :src="friend.avatarUrl" alt="" />
          <span v-else class="friend-avatar friend-avatar-fallback">{{ friend.nickname.slice(0, 1).toUpperCase() }}</span>
          <i class="friend-presence-dot" :class="{ 'is-online': isOnline(friend.lastSeenAt) }"></i>
        </div>
        <div class="friend-details">
          <strong>{{ friend.nickname }}</strong>
          <span class="friend-last-seen" :class="{ 'is-online': isOnline(friend.lastSeenAt) }"><Clock3 :size="13" /> {{ lastSeenLabel(friend.lastSeenAt) }}</span>
        </div>
        <div class="friend-actions">
          <RouterLink class="friend-action friend-profile-action" :to="{ name: 'profile', params: { nickname: friend.nickname } }"><UserRound :size="15" /> Профиль</RouterLink>
          <button class="friend-action friend-invite-action" type="button" disabled title="Приглашения появятся позже"><UserPlus :size="15" /> Пригласить</button>
          <button class="friend-action friend-remove-action" type="button" :disabled="removingNickname !== null" @click="removeFriend(friend)"><Trash2 :size="15" /> {{ removingNickname === friend.nickname ? 'Удаляем…' : 'Удалить' }}</button>
        </div>
      </article>
    </div>
    <div v-else class="empty-state section-empty friends-empty">
      <span class="empty-icon"><Users :size="21" /></span>
      <div><strong>Список друзей пока пуст</strong><span>Добавляйте игроков в друзья из их профиля.</span></div>
    </div>

    <p v-if="actionMessage" class="friends-action-message" role="status">{{ actionMessage }}</p>
  </section>
    </div>
  </Transition>

  <Transition name="profile-toast">
    <div v-if="toastMessage" class="profile-toast friends-toast" :class="`is-${toastTone}`" :role="toastTone === 'error' ? 'alert' : 'status'" aria-live="polite" aria-atomic="true">
      <span class="profile-toast-icon">
        <Check v-if="toastTone === 'success'" :size="15" :stroke-width="2.5" />
        <X v-else-if="toastTone === 'error'" :size="15" :stroke-width="2.5" />
        <UserPlus v-else :size="15" :stroke-width="2.5" />
      </span>
      <span class="profile-toast-message">{{ toastMessage }}</span>
      <button class="profile-toast-close" type="button" aria-label="Закрыть уведомление" @click="dismissToast"><X :size="15" /></button>
    </div>
  </Transition>
</template>