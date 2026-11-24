<script setup lang="ts">
import SiteAlert from './components/SiteAlert.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { websiteSettings } from './websiteSettings'
import { useRoute, useRouter } from 'vue-router'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import {
  ArrowLeft,
  Activity,
  ArrowUpRight,
  Ban,
  Bell,
  EllipsisVertical,
  CircleHelp,
  ChevronDown,
  Gamepad2,
  LogIn,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sun,
  UserPlus,
  UserRound,
  Users,
  X,
} from '@lucide/vue'
import { ApiRequestError, clearAppNotifications, getAppNotifications, getCurrentUser, getNotificationSettings, loginAccount, logoutAccount, markAllAppNotificationsRead, markAppNotificationRead, registerAccount, registerTelegramAccount, startTelegramLogin, savePushSubscription } from './api'
import BrandMark from './components/BrandMark.vue'
import HeaderFriends from './components/HeaderFriends.vue'
import AdminSubnav from './components/AdminSubnav.vue'
import type { AppNotification, AuthUser, LoginPayload, NotificationSettings, RegisterPayload } from './api'
import { adminLandingPath } from './adminAccess'

type AuthMode = 'login' | 'register' | 'help' | 'privacy' | 'required' | null

interface Account {
  id: number
  nickname: string
  steamId: AuthUser['steamId']
  adminRole: AuthUser['adminRole']
  avatarUrl?: string
  initials: string
  warRating: AuthUser['warRating']
}

const route = useRoute()
const router = useRouter()
const darkTheme = ref(document.documentElement.classList.contains('dark'))
let themeTransitionPending = false
let themeTransitionTimer: number | undefined
const authMode = ref<AuthMode>(null)
const currentUser = ref<Account | null>(null)
const authReady = ref(false)
const isLandingLayout = computed(() => route.name === 'home' && !currentUser.value)
const sidebarCollapsed = ref(false)
const statsSubmenuOpen = ref(route.path.startsWith('/stats'))
const mobileMenuOpen = ref(false)
const mobileMenuToggle = ref<HTMLButtonElement | null>(null)
const mobileMenuClose = ref<HTMLButtonElement | null>(null)
const sidebar = ref<HTMLElement | null>(null)
const authRedirect = ref<string | null>(null)
const profileMenuOpen = ref(false)
const profileWrap = ref<HTMLElement | null>(null)
const notificationsOpen = ref(false)
const headerFriendsOpen = ref(false)
watch(headerFriendsOpen, opened => { if (opened) { profileMenuOpen.value=false; notificationsOpen.value=false } })
watch([profileMenuOpen, notificationsOpen], values => { if (values.some(Boolean)) headerFriendsOpen.value=false })
const notificationsWrap = ref<HTMLElement | null>(null)
const notifications = ref<AppNotification[]>([])
const notificationsLoading = ref(false)
const notificationsClearBusy = ref(false)
const notificationsError = ref('')
const unreadNotificationCount = ref(0)
let notificationsPollTimer: number | undefined
let notificationsRequestPending = false
const pushPromptVisible = ref(false)
const pushPromptBusy = ref(false)
const pushFollowupMessage = ref('')
const pushPromptSettings = ref<NotificationSettings | null>(null)
const telegramPending = ref(false)
const authBusy = ref(false)
const authMessage = ref('')
const authErrors = ref<Record<string, string[]>>({})
const twoFactorRequired = ref(false)
const twoFactorDigits = ref(['', '', '', '', '', ''])
const twoFactorInputs = ref<(HTMLInputElement | null)[]>([])
const twoFactorPositions = [0, 1, 2, 3, 4, 5] as const
const authPasswordInput = ref<HTMLInputElement | null>(null)
const focusPasswordOnCredentialsEnter = ref(false)
const authForm = reactive({
  email: '',
  nickname: '',
  password: '',
  two_factor_code: '',
  password_confirmation: '',
  privacy_accepted: false,
})
const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
let lastSessionRefreshAt = 0 

useRegisterSW({
  immediate: true,

  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    let checking = false

    const checkForUpdates = async () => {
      if (checking || !navigator.onLine) return

      checking = true

      try {
        await registration.update()
      } catch (error) {
        console.warn('PWA update check failed:', error)
      } finally {
        checking = false
      }
    }

    // Проверяем каждую минуту
    window.setInterval(checkForUpdates, 60_000)

    // Проверяем при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates()
      }
    })

    // Проверяем при восстановлении интернета
    window.addEventListener('online', () => {
      void checkForUpdates()
    })

    void checkForUpdates()
  },
})

async function toggleTheme() {
  if (themeTransitionPending) return
  const nextDarkTheme = !darkTheme.value
  const applyTheme = async () => {
    darkTheme.value = nextDarkTheme
    document.documentElement.classList.toggle('dark', nextDarkTheme)
    try {
      localStorage.setItem('matchstrike.theme', nextDarkTheme ? 'dark' : 'light')
    } catch { /* The theme still switches when browser storage is unavailable. */ }
    await nextTick()
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await applyTheme()
    return
  }
  if (typeof document.startViewTransition === 'function') {
    themeTransitionPending = true
    try {
      await document.startViewTransition(applyTheme).finished
    } catch { /* A skipped visual transition still applies the selected theme. */ }
    finally { themeTransitionPending = false }
    return
  }
  // Older browsers fade individual surfaces instead of a snapshot of the page.
  const root = document.documentElement
  root.classList.add('is-theme-changing')
  void getComputedStyle(root).color
  await applyTheme()
  if (themeTransitionTimer !== undefined) window.clearTimeout(themeTransitionTimer)
  themeTransitionTimer = window.setTimeout(() => root.classList.remove('is-theme-changing'), 400)
}

function sidebarPreferenceKey(userId: number | null): string {
  return userId === null ? 'matchstrike.sidebar.guest' : `matchstrike.sidebar.user.${userId}`
}

function readSidebarPreference(userId: number | null): boolean {
  try {
    return localStorage.getItem(sidebarPreferenceKey(userId)) === 'collapsed'
  } catch {
    return false
  }
}

watch(currentUser, (user) => {
  sidebarCollapsed.value = readSidebarPreference(user?.id ?? null)
}, { immediate: true })

watch(() => route.fullPath, () => {
  closeMobileMenu(false)
  statsSubmenuOpen.value = route.path.startsWith('/stats')
})

const isStatsRoute = computed(() => route.path === '/stats' || route.path.startsWith('/stats/'))
function toggleStatsSubmenu() {
  if (sidebarCollapsed.value) {
    void router.push({ name: 'stats' })
    return
  }
  statsSubmenuOpen.value = !statsSubmenuOpen.value
}

function openMobileMenu() {
  mobileMenuOpen.value = true
  void nextTick(() => {
    if (mobileMenuOpen.value) mobileMenuClose.value?.focus()
  })
}

function closeMobileMenu(restoreFocus = true) {
  if (!mobileMenuOpen.value) return
  mobileMenuOpen.value = false
  if (restoreFocus) void nextTick(() => mobileMenuToggle.value?.focus())
}

function handleMobileMenuKeydown(event: KeyboardEvent) {
  if (!mobileMenuOpen.value) return
  if (event.key === 'Escape') {
    closeMobileMenu()
    return
  }
  if (event.key !== 'Tab' || !sidebar.value) return
  const focusable = Array.from(sidebar.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => element.getClientRects().length > 0)
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return
  if (event.shiftKey && (document.activeElement === first || !sidebar.value.contains(document.activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (document.activeElement === last || !sidebar.value.contains(document.activeElement))) {
    event.preventDefault()
    first.focus()
  }
}

function closeMobileMenuOnResize() {
  if (window.matchMedia('(min-width: 721px)').matches) closeMobileMenu(false)
}

function closeProfileMenuOnOutsideClick(event: PointerEvent) {
  if (profileMenuOpen.value && event.target instanceof Node && !profileWrap.value?.contains(event.target)) {
    profileMenuOpen.value = false
  }
  if (notificationsOpen.value && event.target instanceof Node && !notificationsWrap.value?.contains(event.target)) {
    notificationsOpen.value = false
  }
}

function closeHeaderPopoversOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  profileMenuOpen.value = false
  notificationsOpen.value = false
}

async function refreshNotifications() {
  if (!currentUser.value || notificationsRequestPending) return
  notificationsRequestPending = true
  notificationsLoading.value = true
  notificationsError.value = ''
  try {
    const result = await getAppNotifications()
    notifications.value = result.notifications
    unreadNotificationCount.value = result.unreadCount
  } catch (error) {
    notificationsError.value = error instanceof Error ? error.message : 'Не удалось загрузить уведомления.'
  } finally {
    notificationsLoading.value = false
    notificationsRequestPending = false
  }
}

function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value
  profileMenuOpen.value = false
  if (notificationsOpen.value) void refreshNotifications()
}

async function openNotification(notification: AppNotification) {
  notificationsOpen.value = false
  if (notification.isRead) return
  notification.isRead = true
  unreadNotificationCount.value = Math.max(0, unreadNotificationCount.value - 1)
  try {
    await markAppNotificationRead(notification.id)
  } catch {
    notification.isRead = false
    unreadNotificationCount.value += 1
  }
}

async function markAllNotificationsRead() {
  if (!unreadNotificationCount.value) return
  try {
    await markAllAppNotificationsRead()
    notifications.value = notifications.value.map((notification) => ({ ...notification, isRead: true }))
    unreadNotificationCount.value = 0
  } catch (error) {
    notificationsError.value = error instanceof Error ? error.message : 'Не удалось отметить уведомления как прочитанные.'
  }
}

async function clearNotifications() {
  if (!notifications.value.length || notificationsClearBusy.value) return
  notificationsClearBusy.value = true
  notificationsError.value = ''
  try {
    await clearAppNotifications()
    notifications.value = []
    unreadNotificationCount.value = 0
  } catch (error) {
    notificationsError.value = error instanceof Error ? error.message : 'Не удалось очистить уведомления.'
  } finally {
    notificationsClearBusy.value = false
  }
}

function notificationDateLabel(createdAt: string | null): string {
  if (!createdAt) return ''
  return new Date(createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function pushPromptDismissedKey(userId: number): string {
  return `matchstrike.push-prompt-dismissed.${userId}`
}

function hasDismissedPushPrompt(userId: number): boolean {
  try {
    return localStorage.getItem(pushPromptDismissedKey(userId)) === 'yes'
  } catch {
    return false
  }
}

function rememberPushPromptDismissed(userId: number) {
  try {
    localStorage.setItem(pushPromptDismissedKey(userId), 'yes')
  } catch {
    return
  }
}

function showPushFollowup(message: string) { pushFollowupMessage.value = message }

function closePushFollowup() { pushFollowupMessage.value = '' }

async function checkPushPrompt(userId: number) {
  pushPromptVisible.value = false
  pushPromptSettings.value = null
  if (hasDismissedPushPrompt(userId)) return

  try {
    const settings = await getNotificationSettings()
    if (currentUser.value?.id !== userId) return
    if (!settings.pushConfigured || !settings.preferences.enabled) return

    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription && Notification.permission === 'granted') return
    }

    pushPromptSettings.value = settings
    pushPromptVisible.value = true
  } catch {
    pushPromptVisible.value = false
  }
}

function dismissPushPrompt() {
  const userId = currentUser.value?.id
  pushPromptVisible.value = false
  if (userId) rememberPushPromptDismissed(userId)
  showPushFollowup('Push-уведомления можно включить позже в настройках профиля.')
}

function decodePushPublicKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function iosPushHelp(): string | null {
  const iosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!iosDevice) return null
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && navigator.standalone === true)
  return standalone
    ? 'Не удалось включить push в веб-приложении. Проверьте разрешение уведомлений MatchStrike в настройках iOS.'
    : 'На iPhone и iPad push доступны в установленном веб-приложении: Safari → «Поделиться» → «На экран “Домой”». Затем откройте MatchStrike с новой иконки и включите push.'
}

async function enablePushFromPrompt() {
  if (pushPromptBusy.value) return
  pushPromptBusy.value = true
  try {
    const settings = pushPromptSettings.value
    if (!settings?.pushConfigured || !settings.pushPublicKey) {
      showPushFollowup('Push-уведомления пока не настроены на сервере.')
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      pushPromptVisible.value = false
      showPushFollowup(iosPushHelp() ?? 'Этот браузер не поддерживает push-уведомления.')
      return
    }

    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') {
      pushPromptVisible.value = false
      showPushFollowup(permission === 'denied'
        ? 'Разрешите уведомления для MatchStrike в настройках браузера.'
        : 'Разрешение на уведомления не выдано. Его можно изменить в настройках браузера.')
      return
    }

    const registration = await navigator.serviceWorker.register('/sw.js')
    const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodePushPublicKey(settings.pushPublicKey) as BufferSource,
    })
    try {
      await savePushSubscription(subscription)
    } catch (error) {
      await subscription.unsubscribe()
      throw error
    }
    pushPromptVisible.value = false
    settings.subscriptionCount = Math.max(1, settings.subscriptionCount)
    showPushFollowup('Push-уведомления включены в этом браузере.')
  } catch (error) {
    pushPromptVisible.value = false
    showPushFollowup(error instanceof Error ? error.message : 'Не удалось включить push-уведомления.')
  } finally {
    pushPromptBusy.value = false
  }
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    localStorage.setItem(
      sidebarPreferenceKey(currentUser.value?.id ?? null),
      sidebarCollapsed.value ? 'collapsed' : 'expanded',
    )
  } catch {
    // Keep the control usable when browser storage is unavailable.
  }
}

const navigation = [
  { id: 'lobby', label: 'Лобби', to: '/lobby', icon: Users },
  { id: 'matches', label: 'Матчи', to: '/matches', icon: Gamepad2 },
  { id: 'stats', label: 'Статистика', to: '/stats', icon: Activity },
  { id: 'bans', label: 'Баны', to: '/bans', icon: Ban },
]
const visibleNavigation = computed(() => navigation.filter(item => item.id !== 'stats' && (item.id !== 'lobby' || (currentUser.value !== null && websiteSettings.value.lobbyEnabled))))
const isAdminWorkspace = computed(() => route.matched.some(record => record.meta.requiresAdmin))

const profileLink = computed(() => currentUser.value
  ? `/profile/${encodeURIComponent(currentUser.value.nickname)}`
  : '/')
const adminPanelLink = computed(() => currentUser.value?.adminRole
  ? adminLandingPath(currentUser.value.adminRole)
  : '/adminpanel')

const authTitle = computed(() => {
  if (authMode.value === 'register') return 'Создать аккаунт'
  if (authMode.value === 'login' && twoFactorRequired.value) return 'Подтверждение входа'
  if (authMode.value === 'help') return 'Помощь'
  if (authMode.value === 'privacy') return 'Политика конфиденциальности'
  if (authMode.value === 'required') return 'Вы не авторизованы'
  return 'Войти в ' + websiteSettings.value.name
})

const authDescription = computed(() => {
  if (authMode.value === 'help') return 'Раздел поддержки будет доступен после настройки каналов связи.'
  if (authMode.value === 'required') return 'Чтобы пожаловаться на игрока, войдите в аккаунт или зарегистрируйтесь.'
  return ''
})

const hasEmailConflict = computed(() => authErrors.value.email?.some((message) => message.includes('уже зарегистрирован')) ?? false)

function accountFromUser(user: AuthUser): Account {
  return {
    id: user.id,
    nickname: user.nickname,
    steamId: user.steamId,
    adminRole: user.adminRole,
    avatarUrl: user.avatarUrl ?? undefined,
    initials: user.nickname.slice(0, 1).toUpperCase(),
    warRating: user.warRating !== undefined ? user.warRating : currentUser.value?.id === user.id ? currentUser.value.warRating : null,
  }
}

function updateCurrentUser(user: AuthUser) {
  currentUser.value = accountFromUser(user)
}

const pageEventListeners = computed(() => {
  if (route.name === 'home') {
    return { authRequested:(mode:'login'|'register') => openAuth(mode), themeRequested:toggleTheme }
  }
  if (route.name === 'profile') {
    return {
      accountUpdated: updateCurrentUser,
      authRequested: () => openAuth('required'),
    }
  }
  if (route.name === 'settings') {
    return { accountUpdated: updateCurrentUser }
  }

  return {}
})

async function beginTelegramLogin() {
  authMessage.value = ''
  try {
    window.location.assign(await startTelegramLogin())
  } catch {
    authMessage.value = 'Не удалось начать вход через Telegram.'
  }
}

function openAuth(mode: Exclude<AuthMode, 'help' | 'privacy' | null>) {
  telegramPending.value = false
  profileMenuOpen.value = false
  authErrors.value = {}
  authMessage.value = ''
  twoFactorRequired.value = false
  Object.assign(authForm, {
    email: '',
    nickname: '',
    password: '',
    two_factor_code: '',
    password_confirmation: '',
    privacy_accepted: false,
  })
  clearTwoFactorCode()
  focusPasswordOnCredentialsEnter.value = false
  authMode.value = mode
}

watch(() => route.query.auth, (auth) => {
  if (auth !== 'login' && auth !== 'register') return

  const redirect = route.query.redirect
  authRedirect.value = typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : null
  openAuth(auth)
  telegramPending.value = auth === 'register' && route.query.telegram_pending === '1'
  if (route.query.telegram_error) authMessage.value = 'Авторизация через Telegram не удалась. Попробуйте ещё раз.'
}, { immediate: true })

function closeDialog(clearAuthQuery = true) {
  const shouldClearAuthQuery = clearAuthQuery && (route.query.auth === 'login' || route.query.auth === 'register')
  telegramPending.value = false
  authMode.value = null
  authErrors.value = {}
  authMessage.value = ''
  twoFactorRequired.value = false
  clearTwoFactorCode()
  focusPasswordOnCredentialsEnter.value = false
  authRedirect.value = null
  if (shouldClearAuthQuery) void router.replace({ name: 'home' })
}

function switchToLogin() {
  const email = authForm.email
  openAuth('login')
  authForm.email = email
}

function fieldError(field: string): string {
  return authErrors.value[field]?.[0] ?? ''
}

function clearTwoFactorCode() {
  twoFactorDigits.value = ['', '', '', '', '', '']
  twoFactorInputs.value = []
  authForm.two_factor_code = ''
}

function setTwoFactorInput(index: number, element: unknown) {
  twoFactorInputs.value[index] = element instanceof HTMLInputElement ? element : null
}

function setTwoFactorDigits(digits: string[]) {
  twoFactorDigits.value = digits
  authForm.two_factor_code = digits.join('')
}

function handleTwoFactorInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const enteredDigits = input.value.replace(/\D/g, '').slice(0, 6 - index)
  const digits = [...twoFactorDigits.value]

  if (enteredDigits.length > 1) {
    for (let offset = 0; offset < enteredDigits.length; offset += 1) {
      digits[index + offset] = enteredDigits[offset]
    }
  } else {
    digits[index] = enteredDigits
  }

  setTwoFactorDigits(digits)
  input.value = digits[index] ?? ''

  if (enteredDigits) {
    const nextIndex = Math.min(index + Math.max(enteredDigits.length, 1), twoFactorPositions.length - 1)
    twoFactorInputs.value[nextIndex]?.focus()
  }
}

function handleTwoFactorKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    twoFactorInputs.value[index - 1]?.focus()
    return
  }

  if (event.key === 'ArrowRight' && index < twoFactorPositions.length - 1) {
    event.preventDefault()
    twoFactorInputs.value[index + 1]?.focus()
    return
  }

  if (event.key === 'Backspace' && !twoFactorDigits.value[index] && index > 0) {
    const digits = [...twoFactorDigits.value]
    digits[index - 1] = ''
    setTwoFactorDigits(digits)
    event.preventDefault()
    twoFactorInputs.value[index - 1]?.focus()
  }
}

function focusFirstTwoFactorInput() {
  twoFactorInputs.value[0]?.focus()
}

function focusAuthStep() {
  if (twoFactorRequired.value) {
    focusFirstTwoFactorInput()
    return
  }

  if (focusPasswordOnCredentialsEnter.value) {
    focusPasswordOnCredentialsEnter.value = false
    authPasswordInput.value?.focus()
  }
}

function backToCredentials() {
  if (authBusy.value) return

  focusPasswordOnCredentialsEnter.value = true
  twoFactorRequired.value = false
  authErrors.value = {}
  authMessage.value = ''
  clearTwoFactorCode()
}

async function submitAuth() {
  if (authBusy.value || (authMode.value !== 'login' && authMode.value !== 'register')) return

  authErrors.value = {}
  authMessage.value = ''
  if (authMode.value === 'register') {
    if (!authForm.nickname.trim()) authErrors.value.nickname = ['Укажите никнейм.']
    if (!telegramPending.value && !authForm.email.trim()) authErrors.value.email = ['Укажите email.']
    if (!authForm.password.trim()) authErrors.value.password = ['Укажите пароль.']
    if (Object.keys(authErrors.value).length) return
  }
  authBusy.value = true

  try {
    let user: AuthUser

    if (authMode.value === 'register') {
      const payload: RegisterPayload = {
        email: authForm.email,
        nickname: authForm.nickname,
        password: authForm.password,
        password_confirmation: authForm.password_confirmation,
        privacy_accepted: authForm.privacy_accepted,
      }
      user = telegramPending.value ? await registerTelegramAccount(payload) : await registerAccount(payload)
    } else {
      const payload: LoginPayload = {
        email: authForm.email,
        password: authForm.password,
        ...(twoFactorRequired.value ? { two_factor_code: authForm.two_factor_code } : {}),
      }
      const response = await loginAccount(payload)
      if (response.requiresTwoFactor) {
        twoFactorRequired.value = true
        clearTwoFactorCode()
        return
      }
      if (!response.user) throw new Error('Вход не завершён.')
      user = response.user
    }

    currentUser.value = accountFromUser(user)
    notifications.value = []
    unreadNotificationCount.value = 0
    lastSessionRefreshAt = Date.now()
    void refreshNotifications()
    void checkPushPrompt(user.id)
    const redirect = authRedirect.value
    closeDialog(false)
    if (redirect) await router.replace(redirect)
    else if (route.query.auth === 'login' || route.query.auth === 'register') await router.replace({ name: 'home' })
  } catch (error) {
    if (error instanceof ApiRequestError) {
      authErrors.value = error.errors
      if (Object.keys(error.errors).length === 0) authMessage.value = error.message
    } else {
      authMessage.value = 'Не удалось связаться с сервером. Попробуйте ещё раз.'
    }
  } finally {
    authBusy.value = false
  }
}

async function signOut() {
  profileMenuOpen.value = false
  try {
    await logoutAccount()
    currentUser.value = null
    notifications.value = []
    unreadNotificationCount.value = 0
    pushPromptVisible.value = false
    profileMenuOpen.value = false
    await router.replace({ name: 'home' })
  } catch {
    authMode.value = 'login'
    authMessage.value = 'Не удалось завершить сеанс. Попробуйте ещё раз.'
  }
}

function refreshSessionOnActivity() {
  if (!currentUser.value || document.visibilityState !== 'visible') return
  if (Date.now() - lastSessionRefreshAt < 5 * 60 * 1000) return

  lastSessionRefreshAt = Date.now()
  void getCurrentUser().then((user) => {
    if (user) {
      currentUser.value = accountFromUser(user)
      void refreshNotifications()
      return
    }

    currentUser.value = null
    notifications.value = []
    unreadNotificationCount.value = 0
    if (route.name === 'friends') {
      void router.replace({ name: 'home', query: { auth: 'login', redirect: '/friends' } })
    }
  }).catch(() => undefined)
}

function refreshNotificationsWhenVisible() {
  if (document.visibilityState === 'visible') void refreshNotifications()
}

onMounted(async () => {
  document.addEventListener('pointerdown', closeProfileMenuOnOutsideClick)
  window.addEventListener('keydown', closeHeaderPopoversOnEscape)
  window.addEventListener('keydown', handleMobileMenuKeydown)
  window.addEventListener('resize', closeMobileMenuOnResize)
  document.addEventListener('visibilitychange', refreshNotificationsWhenVisible)
  for (const eventName of activityEvents) {
    window.addEventListener(eventName, refreshSessionOnActivity, { passive: true })
  }
  notificationsPollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshNotifications()
  }, 10_000)

  try {
    const user = await getCurrentUser()
    if (user) {
      currentUser.value = accountFromUser(user)
      lastSessionRefreshAt = Date.now()
      void refreshNotifications()
      void checkPushPrompt(user.id)
    }
  } catch {
    currentUser.value = null
  } finally {
    authReady.value = true
  }
})

onBeforeUnmount(() => {
  if (themeTransitionTimer !== undefined) window.clearTimeout(themeTransitionTimer)
  document.documentElement.classList.remove('is-theme-changing')
  document.removeEventListener('pointerdown', closeProfileMenuOnOutsideClick)
  window.removeEventListener('keydown', closeHeaderPopoversOnEscape)
  window.removeEventListener('keydown', handleMobileMenuKeydown)
  window.removeEventListener('resize', closeMobileMenuOnResize)
  document.removeEventListener('visibilitychange', refreshNotificationsWhenVisible)
  for (const eventName of activityEvents) {
    window.removeEventListener(eventName, refreshSessionOnActivity)
  }
  if (notificationsPollTimer !== undefined) window.clearInterval(notificationsPollTimer)
})
</script>

<template>
  <SiteAlert :message="pushFollowupMessage" tone="warning" title="Уведомления" @close="closePushFollowup" />
  <SiteAlert :message="notificationsError" @close="notificationsError = ''" />
  <SiteAlert :message="authMessage" tone="error" @close="authMessage = ''" />

  <div id="top" class="site-shell" :class="{ 'is-sidebar-collapsed': sidebarCollapsed, 'is-mobile-menu-open': mobileMenuOpen, 'is-landing':isLandingLayout }">
    <Transition name="push-onboarding">
      <aside v-if="pushPromptVisible" class="push-onboarding-alert" role="status" aria-live="polite">
        <span class="push-onboarding-icon"><Bell :size="17" /></span>
        <span class="push-onboarding-copy"><strong>Не пропускайте уведомления</strong><span>Включите push, чтобы получать важные события, даже когда сайт закрыт.</span></span>
        <span class="push-onboarding-actions">
          <button type="button" class="push-onboarding-enable" :disabled="pushPromptBusy" @click="enablePushFromPrompt">{{ pushPromptBusy ? 'Включаем…' : 'Включить' }}</button>
          <button type="button" class="push-onboarding-later" :disabled="pushPromptBusy" @click="dismissPushPrompt">Позже</button>
        </span>
      </aside>
    </Transition>

    <button v-if="mobileMenuOpen" class="mobile-menu-backdrop" type="button" tabindex="-1" aria-label="Закрыть меню" @click="closeMobileMenu()"></button>
    <aside v-if="!isLandingLayout" id="site-sidebar" ref="sidebar" class="sidebar" :role="mobileMenuOpen ? 'dialog' : undefined" :aria-modal="mobileMenuOpen ? 'true' : undefined" :aria-label="mobileMenuOpen ? 'Навигация' : undefined">
      <div class="sidebar-brand">
        <RouterLink class="brand" to="/" :aria-label="`${websiteSettings.name} — главная`" @click="closeMobileMenu(false)">
          <BrandMark />
          <span class="brand-name"><template v-if="websiteSettings.name==='MatchStrike'">MATCH<span>STRIKE</span></template><template v-else>{{ websiteSettings.name }}</template><small>{{ websiteSettings.tagline }}</small></span>
        </RouterLink>
        <button
          class="sidebar-collapse-toggle"
          type="button"
          :aria-label="sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'"
          v-tooltip="sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'"
          :aria-expanded="!sidebarCollapsed"
          aria-controls="primary-navigation"
          @click="toggleSidebar"
        >
          <PanelLeftOpen v-if="sidebarCollapsed" :size="17" />
          <PanelLeftClose v-else :size="17" />
        </button>
        <button ref="mobileMenuClose" class="mobile-menu-close" type="button" aria-label="Закрыть меню" v-tooltip="'Закрыть меню'" @click="closeMobileMenu()"><X :size="20" /></button>
      </div>

      <div class="sidebar-caption">{{ isAdminWorkspace ? 'УПРАВЛЕНИЕ' : 'СООБЩЕСТВО' }}</div>
      <AdminSubnav v-if="isAdminWorkspace" :role="currentUser?.adminRole ?? null" :collapsed="sidebarCollapsed" @navigate="closeMobileMenu(false)" />
      <nav v-else id="primary-navigation" class="main-nav" aria-label="Основная навигация">
        <template v-for="item in visibleNavigation" :key="item.id">
          <RouterLink
            :to="item.to"
            class="nav-link"
            :class="{ 'is-active': route.path === item.to || route.path.startsWith(`${item.to}/`) }"
            :aria-label="item.label"
            v-tooltip="sidebarCollapsed ? item.label : undefined"
            active-class="is-active"
            @click="closeMobileMenu(false)"
          >
            <span class="nav-icon"><component :is="item.icon" :size="18" :stroke-width="1.8" /></span>
            <span class="nav-label">{{ item.label }}</span>
            <ArrowUpRight v-if="route.path === item.to || route.path.startsWith(`${item.to}/`)" class="nav-arrow" :size="14" />
          </RouterLink>
          <div v-if="item.id === 'matches'" class="nav-group" :class="{ 'is-active': isStatsRoute, 'is-expanded': statsSubmenuOpen }">
            <button type="button" class="nav-link nav-group-trigger" :class="{ 'is-active': isStatsRoute }" :aria-expanded="!sidebarCollapsed && statsSubmenuOpen" aria-controls="stats-submenu" aria-label="Статистика" v-tooltip="sidebarCollapsed ? 'Статистика' : undefined" @click="toggleStatsSubmenu">
              <span class="nav-icon"><Activity :size="18" :stroke-width="1.8" /></span>
              <span class="nav-label">Статистика</span>
              <ChevronDown class="nav-group-chevron" :size="15" />
            </button>
            <div v-if="statsSubmenuOpen && !sidebarCollapsed" id="stats-submenu" class="nav-submenu">
              <RouterLink to="/stats/players" class="nav-sublink" :class="{ 'is-active': route.path === '/stats/players' || route.path === '/stats' }" @click="closeMobileMenu(false)">Игроки</RouterLink>
              <RouterLink v-if="websiteSettings.seasonEnabled" to="/stats/season" class="nav-sublink" :class="{ 'is-active': route.path === '/stats/season' }" @click="closeMobileMenu(false)">Сезон <small>ТОП 50</small></RouterLink>
            </div>
          </div>
        </template>
      </nav>

      <nav v-if="currentUser?.adminRole && !isAdminWorkspace" class="admin-nav" aria-label="Администрирование">
        <RouterLink
          :to="adminPanelLink"
          class="nav-link"
          :class="{ 'is-active': route.path.startsWith('/adminpanel') }"
          aria-label="Админ панель"
          v-tooltip="sidebarCollapsed ? 'Админ панель' : undefined"
          @click="closeMobileMenu(false)"
        >
          <span class="nav-icon"><ShieldCheck :size="18" :stroke-width="1.8" /></span>
          <span class="nav-label">Админ панель</span>
        </RouterLink>
      </nav>

      <div class="sidebar-bottom">
        <button class="help-link" type="button" :aria-label="sidebarCollapsed ? 'Помощь' : undefined" v-tooltip="sidebarCollapsed ? 'Помощь' : undefined" @click="closeMobileMenu(false); authMode = 'help'">
          <span class="nav-icon"><CircleHelp :size="18" :stroke-width="1.8" /></span>
          <span class="help-label">Помощь</span>
          <ArrowUpRight class="help-arrow" :size="14" />
        </button>
        <div class="sidebar-version" :aria-label="websiteSettings.name"><span class="version-dot"></span><span class="sidebar-version-label">{{ websiteSettings.name }} / CS</span></div>
      </div>
    </aside>

    <main class="main-content">
      <header v-if="!isLandingLayout" class="topbar">
        <div class="mobile-header">
          <button ref="mobileMenuToggle" class="mobile-menu-toggle" type="button" :aria-expanded="mobileMenuOpen" aria-controls="site-sidebar" aria-label="Открыть меню" v-tooltip="'Открыть меню'" @click="openMobileMenu"><Menu :size="21" /></button>
          <RouterLink class="mobile-header-brand" to="/" :aria-label="`${websiteSettings.name} — главная`"><BrandMark /></RouterLink>
        </div>
        <div class="topbar-label"><span class="topbar-mark"></span> ИГРОВОЕ СООБЩЕСТВО <span class="topbar-divider">/</span> CS</div>
        <div class="topbar-actions">
          <button
            class="theme-toggle"
            type="button"
            :aria-label="darkTheme ? 'Включить светлую тему' : 'Включить тёмную тему'"
            v-tooltip="darkTheme ? 'Включить светлую тему' : 'Включить тёмную тему'"
            :aria-pressed="darkTheme"
            @click="toggleTheme"
          >
            <Sun v-if="darkTheme" :size="15" />
            <Moon v-else :size="15" />
          </button>
          <template v-if="!currentUser">
            <button class="login-button" type="button" @click="openAuth('login')"><LogIn :size="16" /><span>Войти</span></button>
            <button class="register-button" type="button" @click="openAuth('register')"><UserPlus :size="16" /><span>Регистрация</span></button>
          </template>
          <template v-else>
          <HeaderFriends v-model:open="headerFriendsOpen" :user-id="currentUser.id" />
          <div ref="profileWrap" class="profile-wrap topbar-account">
            <RouterLink class="profile-button" :to="profileLink" :aria-label="`Открыть профиль ${currentUser.nickname}`" @click="profileMenuOpen = false; notificationsOpen = false">
              <img v-if="currentUser.avatarUrl" class="profile-avatar" :src="currentUser.avatarUrl" alt="" />
              <span v-else class="profile-avatar profile-initials">{{ currentUser.initials }}</span>
              <span class="profile-button-copy">
                <span class="profile-nickname">{{ currentUser.nickname }}</span>
                <span v-if="currentUser.steamId?.trim()" class="profile-button-rating"><img :src="`/icons/levels/level-${currentUser.warRating && currentUser.warRating.level >= 1 && currentUser.warRating.level <= 10 ? currentUser.warRating.level : 0}.svg`" :alt="currentUser.warRating?.level ? `Уровень ${currentUser.warRating.level}` : 'Unknown'" /><span>{{ currentUser.warRating?.elo ?? '—' }} <small>ELO</small></span></span>
              </span>

            </RouterLink>
          <div ref="notificationsWrap" class="notifications-wrap">
            <button class="notifications-button" type="button" :aria-expanded="notificationsOpen" aria-haspopup="dialog" :aria-label="unreadNotificationCount ? `Уведомления, непрочитанных: ${unreadNotificationCount}` : 'Уведомления'" v-tooltip="unreadNotificationCount ? `Непрочитанных уведомлений: ${unreadNotificationCount}` : 'Уведомления'" @click="toggleNotifications">
              <Bell :size="14" fill="currentColor" :stroke-width="1.5" />
              <span v-if="unreadNotificationCount > 0" class="notification-unread-indicator" aria-hidden="true">
                <span class="notification-ping motion-safe:animate-ping"></span>
                <span class="notification-unread-dot"></span>
              </span>
            </button>
            <Transition name="account-menu">
              <section v-if="notificationsOpen" class="notifications-panel" role="dialog" aria-label="Уведомления">
                <header class="notifications-panel-heading"><h2>Уведомления</h2><span class="notifications-heading-actions"><button v-if="unreadNotificationCount > 0" type="button" @click="markAllNotificationsRead">Прочитать все</button><button v-if="notifications.length" class="notifications-clear-button" type="button" aria-label="Очистить уведомления" v-tooltip="'Очистить уведомления'" :disabled="notificationsClearBusy" @click="clearNotifications"><X :size="15" /></button></span></header>
                <p v-if="notificationsLoading && !notifications.length" class="notifications-panel-message">Загружаем уведомления…</p>
                <p v-else-if="notificationsError" class="notifications-panel-message" role="alert">Список уведомлений недоступен.</p>
                <div v-else-if="notifications.length" class="notifications-list">
                  <RouterLink v-for="notification in notifications" :key="notification.id" class="notification-item" :class="{ 'is-unread': !notification.isRead }" :to="notification.link || (notification.data.broadcast === true ? '/' : '/friends')" @click="openNotification(notification)">
                    <span class="notification-item-copy"><small v-if="typeof notification.data.sender === 'string'" class="notification-item-sender">От {{ notification.data.sender }}</small><strong>{{ notification.title }}</strong><span>{{ notification.message }}</span></span>
                    <time v-if="notification.createdAt" :datetime="notification.createdAt">{{ notificationDateLabel(notification.createdAt) }}</time>
                  </RouterLink>
                </div>
                <p v-else class="notifications-panel-message">Новых уведомлений пока нет.</p>
              </section>
            </Transition>
          </div>
            <button class="profile-options-button" type="button" :aria-label="`Меню профиля ${currentUser.nickname}`" :aria-expanded="profileMenuOpen" aria-haspopup="menu" @click="profileMenuOpen = !profileMenuOpen; notificationsOpen = false"><EllipsisVertical :size="16" /></button>
            <Transition name="account-menu">
              <div v-if="profileMenuOpen" class="profile-menu" role="menu">
                <RouterLink :to="profileLink" role="menuitem" @click="profileMenuOpen = false"><UserRound :size="15" /> Профиль <ArrowUpRight :size="14" /></RouterLink>
                <RouterLink to="/friends" role="menuitem" @click="profileMenuOpen = false"><Users :size="15" /> Друзья <ArrowUpRight :size="14" /></RouterLink>
                <RouterLink to="/tickets" role="menuitem" @click="profileMenuOpen = false"><CircleHelp :size="15" /> Тикеты <ArrowUpRight :size="14" /></RouterLink>
                <RouterLink to="/settings" role="menuitem" @click="profileMenuOpen = false"><Settings :size="15" /> Настройки <ArrowUpRight :size="14" /></RouterLink>
                <button type="button" role="menuitem" @click="signOut">Выйти</button>
              </div>
            </Transition>
          </div>
          </template>
        </div>
      </header>

      <div class="page-content">
        <RouterView v-slot="{ Component, route: pageRoute }">
          <Transition name="route" mode="out-in" appear>
            <div :key="pageRoute.name === 'adminpanel' || pageRoute.name === 'adminpanel-section' ? 'admin-workspace' : pageRoute.name === 'tickets' || pageRoute.name === 'lobby' ? pageRoute.path : pageRoute.fullPath" class="route-page">
              <component :is="Component" v-bind="pageRoute.name === 'home' ? {authReady,authenticated:!!currentUser,darkTheme} : {}" v-on="pageEventListeners" />
            </div>
          </Transition>
        </RouterView>
        <footer v-if="!isLandingLayout" class="page-footer">
          <span>© {{ new Date().getFullYear() }} {{ websiteSettings.name }}</span>
          <span><i></i> {{ websiteSettings.tagline }}</span>
        </footer>
      </div>
    </main>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="authMode" class="modal-backdrop" @click.self="closeDialog()" @keydown.esc="closeDialog()">
          <section class="info-dialog" :class="{ 'auth-two-factor-dialog': authMode === 'login' && twoFactorRequired }" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <button v-if="authMode === 'login' && twoFactorRequired" class="dialog-close auth-step-back" type="button" aria-label="Назад к email и паролю" v-tooltip="'Назад к email и паролю'" @click="backToCredentials"><ArrowLeft :size="18" /></button>
          <button class="dialog-close" type="button" aria-label="Закрыть" @click="closeDialog()"><X :size="18" /></button>
          <div class="section-kicker">{{ websiteSettings.name.toUpperCase() }} / ACCOUNT</div>
          <h2 id="dialog-title">{{ authTitle }}</h2>
          <p v-if="authMode === 'help'">{{ authDescription }}</p>
          <div v-else-if="authMode === 'required'" class="auth-required">
            <p>{{ authDescription }}</p>
            <div class="dialog-actions">
              <button class="dialog-secondary auth-choice" type="button" @click="openAuth('login')"><LogIn :size="14" /> Войти</button>
              <button class="dialog-primary auth-choice" type="button" @click="openAuth('register')"><UserPlus :size="14" /> Зарегистрироваться</button>
            </div>
          </div>
          <div v-else-if="authMode === 'privacy'" class="privacy-copy">
            <p>Для работы аккаунта {{ websiteSettings.name }} сохраняет email и никнейм. Пароль хранится только в виде криптографического хеша, а дата согласия с политикой — в записи аккаунта.</p>
            <p>Эти данные используются для входа и работы функций сообщества. Перед публичным запуском владелец сайта должен дополнить политику своими реквизитами, контактами для запросов и правилами хранения данных.</p>
            <div class="dialog-actions"><button class="dialog-secondary" type="button" @click="authMode = 'register'">Назад к регистрации</button></div>
          </div>
          <form v-else class="auth-form" @submit.prevent="submitAuth">
            <Transition name="auth-step" mode="out-in" @after-enter="focusAuthStep">
              <div v-if="authMode === 'login' && twoFactorRequired" key="two-factor" class="auth-two-factor">
                <p class="auth-two-factor-copy">Введите шестизначный код из Google Authenticator.</p>
                <label class="auth-field">
                  <span>Код подтверждения</span>
                  <div class="auth-code-inputs" role="group" aria-label="Шестизначный код Google Authenticator">
                    <input
                      v-for="index in twoFactorPositions"
                      :key="index"
                      :ref="(element) => setTwoFactorInput(index, element)"
                      class="auth-input auth-code-input"
                      type="text"
                      inputmode="numeric"
                      :autocomplete="index === 0 ? 'one-time-code' : 'off'"
                      :value="twoFactorDigits[index]"
                      :aria-label="`Цифра ${index + 1} из 6`"
                      :aria-invalid="Boolean(fieldError('two_factor_code'))"
                      :maxlength="6"
                      required
                      @input="handleTwoFactorInput(index, $event)"
                      @keydown="handleTwoFactorKeydown(index, $event)"
                    />
                  </div>
                  <span v-if="fieldError('two_factor_code')" class="field-error">{{ fieldError('two_factor_code') }}</span>
                </label>
              </div>
              <div v-else key="credentials" class="auth-credentials">
                <label v-if="!telegramPending" class="auth-field">
                  <span>Email</span>
                  <input v-model.trim="authForm.email" class="auth-input" type="email" name="email" autocomplete="email" required maxlength="254" placeholder="name@example.com" :aria-invalid="Boolean(fieldError('email'))" />
                  <span v-if="fieldError('email')" class="field-error">{{ fieldError('email') }}</span>
                  <button v-if="authMode === 'register' && hasEmailConflict" class="auth-inline-link" type="button" @click="switchToLogin">Войти в существующий аккаунт</button>
                </label>

                <label v-if="authMode === 'register'" class="auth-field">
                  <span>Никнейм</span>
                  <input v-model.trim="authForm.nickname" class="auth-input" type="text" name="nickname" autocomplete="nickname" required minlength="2" maxlength="32" pattern="[\p{L}\p{N}_!?#@]+" v-tooltip="'Только буквы, цифры и символы _ ! ? # @. Без пробелов и ссылок.'" placeholder="Ваш никнейм" :aria-invalid="Boolean(fieldError('nickname'))" />
                  <span v-if="fieldError('nickname')" class="field-error">{{ fieldError('nickname') }}</span>
                </label>

                <label v-if="authMode !== 'login' || !twoFactorRequired" class="auth-field">
                  <span>Пароль</span>
                  <input ref="authPasswordInput" v-model="authForm.password" class="auth-input" type="password" name="password" :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'" required minlength="8" placeholder="Не менее 8 символов" :aria-invalid="Boolean(fieldError('password'))" />
                  <span v-if="fieldError('password')" class="field-error">{{ fieldError('password') }}</span>
                </label>

                <label v-if="authMode === 'register'" class="auth-field">
                  <span>Подтвердить пароль</span>
                  <input v-model="authForm.password_confirmation" class="auth-input" type="password" name="password_confirmation" autocomplete="new-password" required minlength="8" placeholder="Повторите пароль" />
                </label>

                <div v-if="authMode === 'register'" class="privacy-consent">
                  <input id="privacy-accepted" v-model="authForm.privacy_accepted" type="checkbox" required />
                  <label for="privacy-accepted">Я принимаю</label>
                  <button class="auth-inline-link" type="button" @click="authMode = 'privacy'">Политику конфиденциальности</button>
                  <span v-if="fieldError('privacy_accepted')" class="field-error">{{ fieldError('privacy_accepted') }}</span>
                </div>
              </div>
            </Transition>



            <div class="dialog-actions">
              <button class="dialog-secondary" type="button" @click="closeDialog()">Отмена</button>
              <button class="dialog-primary" type="submit" :disabled="authBusy || (twoFactorRequired && authForm.two_factor_code.length !== 6)">
                {{ authBusy ? 'Проверяем…' : authMode === 'register' ? 'Создать аккаунт' : twoFactorRequired ? 'Подтвердить' : 'Войти' }}
              </button>
            </div>

            <div v-if="!telegramPending && !twoFactorRequired" class="auth-telegram-section">
              <div class="auth-provider-divider"><span>или</span></div>
              <button class="auth-telegram-button" type="button" @click="beginTelegramLogin">
                <img src="/icons/socials/64px/telegram.png" width="19" height="19" alt="" aria-hidden="true" />
                <span>Продолжить с Telegram</span>
              </button>
            </div>
            <p v-if="telegramPending" class="auth-switch-row">Telegram подтверждён. Выберите никнейм и создайте пароль.</p>
            <p v-if="!telegramPending && !twoFactorRequired" class="auth-switch-row">
              {{ authMode === 'login' ? 'Ещё нет аккаунта?' : 'Уже зарегистрированы?' }}
              <button class="auth-inline-link" type="button" @click="authMode === 'login' ? openAuth('register') : switchToLogin()">
                {{ authMode === 'login' ? 'Регистрация' : 'Войти' }}
              </button>
            </p>
          </form>
          <div v-if="authMode === 'help'" class="dialog-actions"><button class="dialog-secondary" type="button" @click="closeDialog()">Закрыть</button></div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
