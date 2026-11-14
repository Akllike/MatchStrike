<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Bell, Camera, Check, KeyRound, Link2, LogOut, Mail, Monitor, Smartphone, Tablet, Share2, Shield, ShieldCheck, Trash2, Upload, UserRound, X } from '@lucide/vue'
import QRCode from 'qrcode'
import PageLoader from './components/PageLoader.vue'
import { socialIdFromValue } from './socialLinks'
import {
  ApiRequestError,
  changeAccountPassword,
  confirmGoogleAuthenticator,
  deleteProfileMedia,
  disableGoogleAuthenticator,
  getAccountSessions,
  getCurrentUser,
  getNotificationSettings,
  revokeAccountSession,
  revokeOtherAccountSessions,
  deletePushSubscription,
  savePushSubscription,
  setupGoogleAuthenticator,
  updateAccountSettings,
  updateAccountSteamId,
  updateSocialLinks,
  updateNotificationPreferences,
  updateProfileMedia,
} from './api'
import type { AccountSession, AuthUser, NotificationCategory, NotificationSettings } from './api'

const emit = defineEmits<{
  accountUpdated: [user: AuthUser]
}>()

type SettingsTab = 'general' | 'social' | 'notifications' | 'security'
type MediaField = 'avatar' | 'cover'

const mediaSpecs: Record<MediaField, { maxBytes: number; maxWidth: number; maxHeight: number; maxSize: string }> = {
  avatar: { maxBytes: 5 * 1024 * 1024, maxWidth: 2048, maxHeight: 2048, maxSize: '5 МБ' },
  cover: { maxBytes: 8 * 1024 * 1024, maxWidth: 4096, maxHeight: 1365, maxSize: '8 МБ' },
}

const account = ref<AuthUser | null>(null)
const loading = ref(true)
const activeTab = ref<SettingsTab>('general')
const pageMessage = ref('')
const accountBusy = ref(false)
const nicknameMessage = ref('')
const emailMessage = ref('')
const accountErrors = ref<Record<string, string[]>>({})
const accountForm = reactive({ nickname: '', email: '', current_password: '' })
const steamIdForm = reactive({ steamId: '' })
const steamBusy = ref(false)
const steamMessage = ref('')
const socialBusy = ref(false)
const socialMessage = ref('')
const topToastMessage = ref('')
const topToastTone = ref<'success' | 'warning'>('success')
const socialErrors = ref<Record<string, string[]>>({})
let topToastTimer: number | undefined
const socialPlatforms = [
  { id: 'telegram', label: 'Telegram', placeholder: 'username', icon: 'telegram-svgrepo-com.svg' },
  { id: 'instagram', label: 'Instagram', placeholder: 'username', icon: 'instagram-1-svgrepo-com.svg' },
  { id: 'youtube', label: 'YouTube', placeholder: '@handle или ID канала', icon: 'youtube-svgrepo-com.svg' },
  { id: 'twitch', label: 'Twitch', placeholder: 'username', icon: 'twitch-v2-svgrepo-com.svg' },
  { id: 'trovo', label: 'Trovo', placeholder: 'username', icon: 'trovo.svg' },
  { id: 'boosty', label: 'Boosty', placeholder: 'username', icon: 'boosty.svg' },
] as const
const socialForm = reactive({ telegram: '', instagram: '', youtube: '', twitch: '', trovo: '', boosty: '' })
const steamErrors = ref<Record<string, string[]>>({})
const passwordBusy = ref(false)
const passwordMessage = ref('')
const passwordErrors = ref<Record<string, string[]>>({})
const passwordForm = reactive({ current_password: '', password: '', password_confirmation: '' })
const sensitiveChangeAction = ref<'password' | 'email' | null>(null)
const sensitiveChangeDigits = ref(['', '', '', '', '', ''])
const sensitiveChangeInputs = ref<(HTMLInputElement | null)[]>([])
const sensitiveChangePositions = [0, 1, 2, 3, 4, 5] as const
const sensitiveChangeCode = computed(() => sensitiveChangeDigits.value.join(''))
const sensitiveChangeError = ref('')
const mediaBusy = ref<MediaField | null>(null)
const mediaMessage = ref('')
const mediaError = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const sessions = ref<AccountSession[]>([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const sessionActionId = ref<number | null>(null)
const revokeOthersBusy = ref(false)
const twoFactorSetup = ref<{ secret: string; otpauthUri: string; qrCode: string } | null>(null)
const twoFactorCode = ref('')
const twoFactorBusy = ref(false)
const twoFactorError = ref('')
const twoFactorMessage = ref('')
const notificationSettings = ref<NotificationSettings | null>(null)
const notificationBusy = ref(false)
const pushEnabled = ref(false)
const notificationMessage = ref('')
const notificationError = ref('')
const notificationCategories: { id: NotificationCategory; title: string; description: string }[] = [
  { id: 'system', title: 'Системные сообщения', description: 'Объявления и важные сообщения сайта.' },
  { id: 'friend_request', title: 'Заявки в друзья', description: 'Когда кто-то отправляет вам заявку в друзья.' },
  { id: 'friend_acceptance', title: 'Принятие заявок', description: 'Когда вашу заявку в друзья принимают.' },
  { id: 'team_invitation', title: 'Приглашения в команду', description: 'Когда вас приглашают в команду.' },
  { id: 'ticket', title: 'Обращения (тикеты)', description: 'Когда администрация отвечает на ваше обращение.' },
]

const emailChanged = computed(() => account.value !== null && accountForm.email.trim().toLowerCase() !== account.value.email)
const nicknameChanged = computed(() => account.value !== null && accountForm.nickname.trim() !== account.value.nickname)
const steamIdChanged = computed(() => account.value !== null && (steamIdForm.steamId.trim() || null) !== account.value.steamId)
const otherSessionCount = computed(() => sessions.value.filter((session) => !session.isCurrent).length)

function errorFor(errors: Record<string, string[]>, field: string): string {
  return errors[field]?.[0] ?? ''
}

function dismissTopToast() {
  topToastMessage.value = ''
  if (topToastTimer !== undefined) {
    window.clearTimeout(topToastTimer)
    topToastTimer = undefined
  }
}

function showTopToast(message: string, tone: 'success' | 'warning' = 'success') {
  topToastMessage.value = message
  topToastTone.value = tone
  if (topToastTimer !== undefined) window.clearTimeout(topToastTimer)
  topToastTimer = window.setTimeout(dismissTopToast, 5000)
}

function setNotificationFeedback(message: string, tone: 'success' | 'warning' = 'success') {
  notificationMessage.value = message
  showTopToast(message, tone)
}

function clearNotificationFeedback() {
  notificationMessage.value = ''
  dismissTopToast()
}

function applyAccount(user: AuthUser) {
  account.value = user
  for (const platform of socialPlatforms) socialForm[platform.id] = socialIdFromValue(platform.id, user.socialLinks?.[platform.id])
  accountForm.nickname = user.nickname
  accountForm.email = user.email
  accountForm.current_password = ''
  steamIdForm.steamId = user.steamId ?? ''
  emit('accountUpdated', user)
}

async function saveSocialLinks() {
  if (socialBusy.value) return
  socialBusy.value = true
  socialMessage.value = ''
  socialErrors.value = {}
  try {
    const socialLinks = await updateSocialLinks(Object.fromEntries(socialPlatforms.map(({ id }) => [id, socialForm[id].trim() || null])))
    if (account.value) account.value.socialLinks = socialLinks
    showTopToast('Ссылки на социальные сети сохранены.')
  } catch (error) {
    if (error instanceof ApiRequestError) {
      socialErrors.value = error.errors
      socialMessage.value = Object.keys(error.errors).length ? '' : error.message
    } else socialMessage.value = 'Не удалось сохранить ссылки.'
  } finally { socialBusy.value = false }
}

async function loadSessions() {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    sessions.value = await getAccountSessions()
  } catch (error) {
    sessionsError.value = error instanceof Error ? error.message : 'Не удалось загрузить список сеансов.'
  } finally {
    sessionsLoading.value = false
  }
}

async function loadAccount() {
  try {
    const user = await getCurrentUser()
    if (!user) return
    applyAccount(user)
    await loadSessions()
    await loadNotificationSettings()
  } catch {
    pageMessage.value = 'Не удалось загрузить аккаунт. Обновите страницу.'
  } finally {
    loading.value = false
  }
}

async function loadNotificationSettings() {
  try {
    notificationSettings.value = await getNotificationSettings()
    await syncBrowserPushState()
  } catch (error) {
    notificationError.value = error instanceof Error ? error.message : 'Не удалось загрузить настройки уведомлений.'
  }
}

async function syncBrowserPushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    pushEnabled.value = false
    return
  }
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  pushEnabled.value = Boolean(subscription && Notification.permission === 'granted')
}

function decodeVapidKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function isIosDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandaloneApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && navigator.standalone === true)
}

async function enableBrowserPush(): Promise<boolean> {
  const settings = notificationSettings.value
  if (!settings?.pushSupported || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    setNotificationFeedback(isIosDevice() && !isStandaloneApp()
      ? 'На iPhone и iPad push доступны в установленном веб-приложении. В Safari нажмите «Поделиться» → «На экран “Домой”», откройте MatchStrike с новой иконки и включите push там.'
      : 'Этот браузер не поддерживает push-уведомления.', 'warning')
    return false
  }
  if (!settings.pushConfigured || !settings.pushPublicKey) {
    setNotificationFeedback('Push-уведомления не настроены на сервере. Уведомления сайта будут доступны в браузере.', 'warning')
    return false
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    setNotificationFeedback('Разрешите уведомления для сайта в настройках браузера.', 'warning')
    return false
  }
  const registration = await navigator.serviceWorker.register('/sw.js')
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(settings.pushPublicKey) as BufferSource,
  })
  await savePushSubscription(subscription)
  settings.subscriptionCount = Math.max(1, settings.subscriptionCount)
  pushEnabled.value = true
  return true
}

async function updateBrowserPush(value: boolean) {
  if (notificationBusy.value || !notificationSettings.value) return
  notificationBusy.value = true
  notificationError.value = ''
  clearNotificationFeedback()
  try {
    if (value) {
      if (!notificationSettings.value.preferences.enabled) {
        setNotificationFeedback('Сначала включите уведомления аккаунта.', 'warning')
        return
      }
      if (await enableBrowserPush()) setNotificationFeedback('Push-уведомления включены в этом браузере.')
    } else if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      pushEnabled.value = false
      if (notificationSettings.value.subscriptionCount > 0) notificationSettings.value.subscriptionCount -= 1
      setNotificationFeedback('Push-уведомления отключены в этом браузере.')
    }
  } catch (error) {
    notificationError.value = error instanceof Error ? error.message : 'Не удалось изменить настройку push-уведомлений.'
    await syncBrowserPushState()
  } finally {
    notificationBusy.value = false
  }
}

async function updateNotificationSetting(key: 'enabled' | NotificationCategory, value: boolean) {
  const settings = notificationSettings.value
  if (!settings || notificationBusy.value) return
  notificationBusy.value = true
  notificationError.value = ''
  clearNotificationFeedback()
  const previousPreferences = settings.preferences
  const next = { ...settings.preferences, [key]: value }
  try {
    settings.preferences = await updateNotificationPreferences(next)
    if (key === 'enabled' && !value && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
        pushEnabled.value = false
        settings.subscriptionCount = 0
      }
    }
    if (!notificationMessage.value) setNotificationFeedback(value ? 'Настройки уведомлений сохранены.' : 'Уведомления отключены.')
  } catch (error) {
    settings.preferences = previousPreferences
    notificationError.value = error instanceof Error ? error.message : 'Не удалось сохранить настройки уведомлений.'
  } finally {
    notificationBusy.value = false
  }
}

async function saveNickname() {
  if (!nicknameChanged.value || accountBusy.value) return
  accountBusy.value = true
  accountErrors.value = {}
  nicknameMessage.value = ''
  try {
    applyAccount(await updateAccountSettings({ nickname: accountForm.nickname.trim() }))
    nicknameMessage.value = 'Никнейм обновлён.'
  } catch (error) {
    if (error instanceof ApiRequestError) {
      accountErrors.value = error.errors
      if (Object.keys(error.errors).length === 0) nicknameMessage.value = error.message
    } else {
      nicknameMessage.value = 'Не удалось сохранить никнейм.'
    }
  } finally {
    accountBusy.value = false
  }
}

async function saveEmail(twoFactorCode?: string): Promise<boolean> {
  if (!emailChanged.value || accountBusy.value || (account.value?.twoFactorEnabled && !twoFactorCode)) return false
  accountBusy.value = true
  accountErrors.value = {}
  emailMessage.value = ''
  try {
    applyAccount(await updateAccountSettings({
      email: accountForm.email.trim(),
      current_password: accountForm.current_password,
      ...(account.value?.twoFactorEnabled && twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
    }))
    emailMessage.value = 'Адрес электронной почты обновлён.'
    return true
  } catch (error) {
    if (error instanceof ApiRequestError) {
      accountErrors.value = error.errors
      if (Object.keys(error.errors).length === 0) emailMessage.value = error.message
    } else {
      emailMessage.value = 'Не удалось изменить адрес электронной почты.'
    }
    return false
  } finally {
    accountBusy.value = false
  }
}

function requestEmailChange() {
  if (!emailChanged.value || accountBusy.value) return
  if (account.value?.twoFactorEnabled) {
    sensitiveChangeAction.value = 'email'
    clearSensitiveChangeCode()
    sensitiveChangeError.value = ''
    return
  }
  void saveEmail()
}

async function savePassword(twoFactorCode?: string): Promise<boolean> {
  if (passwordBusy.value || (account.value?.twoFactorEnabled && !twoFactorCode)) return false
  passwordBusy.value = true
  passwordErrors.value = {}
  passwordMessage.value = ''
  try {
    await changeAccountPassword({ ...passwordForm, ...(account.value?.twoFactorEnabled && twoFactorCode ? { two_factor_code: twoFactorCode } : {}) })
    passwordForm.current_password = ''
    passwordForm.password = ''
    passwordForm.password_confirmation = ''
    passwordMessage.value = 'Пароль изменён.'
    return true
  } catch (error) {
    if (error instanceof ApiRequestError) {
      passwordErrors.value = error.errors
      if (Object.keys(error.errors).length === 0) passwordMessage.value = error.message
    } else {
      passwordMessage.value = 'Не удалось изменить пароль.'
    }
    return false
  } finally {
    passwordBusy.value = false
  }
}

function requestPasswordChange() {
  if (passwordBusy.value) return
  if (account.value?.twoFactorEnabled) {
    sensitiveChangeAction.value = 'password'
    clearSensitiveChangeCode()
    sensitiveChangeError.value = ''
    return
  }
  void savePassword()
}

function closeSensitiveChangeDialog() {
  if (accountBusy.value || passwordBusy.value) return
  sensitiveChangeAction.value = null
  clearSensitiveChangeCode()
  sensitiveChangeError.value = ''
}

function clearSensitiveChangeCode() {
  sensitiveChangeDigits.value = ['', '', '', '', '', '']
  void nextTick(() => sensitiveChangeInputs.value[0]?.focus())
}

function setSensitiveChangeInput(index: number, element: unknown) {
  sensitiveChangeInputs.value[index] = element instanceof HTMLInputElement ? element : null
}

function handleSensitiveChangeInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const enteredDigits = input.value.replace(/\D/g, '').slice(0, 6 - index)
  const digits = [...sensitiveChangeDigits.value]

  if (enteredDigits.length > 1) {
    for (let offset = 0; offset < enteredDigits.length; offset += 1) digits[index + offset] = enteredDigits[offset]
  } else {
    digits[index] = enteredDigits
  }

  sensitiveChangeDigits.value = digits
  input.value = digits[index] ?? ''
  if (enteredDigits) {
    const nextIndex = Math.min(index + Math.max(enteredDigits.length, 1), sensitiveChangePositions.length - 1)
    sensitiveChangeInputs.value[nextIndex]?.focus()
  }
}

function handleSensitiveChangeKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    sensitiveChangeInputs.value[index - 1]?.focus()
    return
  }
  if (event.key === 'ArrowRight' && index < sensitiveChangePositions.length - 1) {
    event.preventDefault()
    sensitiveChangeInputs.value[index + 1]?.focus()
    return
  }
  if (event.key === 'Backspace' && !sensitiveChangeDigits.value[index] && index > 0) {
    const digits = [...sensitiveChangeDigits.value]
    digits[index - 1] = ''
    sensitiveChangeDigits.value = digits
    event.preventDefault()
    sensitiveChangeInputs.value[index - 1]?.focus()
  }
}

async function confirmSensitiveChange() {
  if (!sensitiveChangeAction.value || sensitiveChangeCode.value.length !== 6) return
  sensitiveChangeError.value = ''
  const saved = sensitiveChangeAction.value === 'email'
    ? await saveEmail(sensitiveChangeCode.value)
    : await savePassword(sensitiveChangeCode.value)
  if (saved) closeSensitiveChangeDialog()
  else sensitiveChangeError.value = sensitiveChangeAction.value === 'email'
    ? errorFor(accountErrors.value, 'two_factor_code') || accountErrors.value.email?.[0] || emailMessage.value || 'Не удалось подтвердить смену email.'
    : errorFor(passwordErrors.value, 'two_factor_code') || passwordErrors.value.current_password?.[0] || passwordErrors.value.password?.[0] || passwordMessage.value || 'Не удалось подтвердить смену пароля.'
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

async function validateMediaFile(file: File, field: MediaField): Promise<string | null> {
  const spec = mediaSpecs[field]
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Выберите изображение в формате JPG, PNG или WebP.'
  }
  if (file.size > spec.maxBytes) {
    return `Размер файла не должен превышать ${spec.maxSize}.`
  }

  try {
    const dimensions = await imageDimensions(file)
    if (dimensions.width > spec.maxWidth || dimensions.height > spec.maxHeight) {
      return `Максимальное разрешение: ${spec.maxWidth} × ${spec.maxHeight} px.`
    }
  } catch {
    return 'Не удалось прочитать изображение.'
  }

  return null
}

async function uploadMedia(field: MediaField, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || mediaBusy.value) return

  mediaBusy.value = field
  mediaMessage.value = ''
  mediaError.value = ''
  try {
    const validationError = await validateMediaFile(file, field)
    if (validationError) {
      mediaError.value = validationError
      return
    }

    const user = field === 'avatar'
      ? await updateProfileMedia({ avatar: file })
      : await updateProfileMedia({ cover: file })
    applyAccount(user)
    mediaMessage.value = field === 'avatar' ? 'Аватар обновлён.' : 'Шапка профиля обновлена.'
  } catch (error) {
    mediaError.value = error instanceof ApiRequestError
      ? Object.values(error.errors).flat()[0] ?? error.message
      : error instanceof Error ? error.message : 'Не удалось загрузить изображение.'
  } finally {
    mediaBusy.value = null
  }
}

async function removeMedia(field: MediaField) {
  if (!account.value || mediaBusy.value) return
  const label = field === 'avatar' ? 'аватар' : 'шапку профиля'
  if (!window.confirm(`Удалить ${label}?`)) return

  mediaBusy.value = field
  mediaMessage.value = ''
  mediaError.value = ''
  try {
    applyAccount(await deleteProfileMedia(field))
    mediaMessage.value = field === 'avatar' ? 'Аватар удалён.' : 'Шапка профиля удалена.'
  } catch (error) {
    mediaError.value = error instanceof Error ? error.message : `Не удалось удалить ${label}.`
  } finally {
    mediaBusy.value = null
  }
}

async function saveSteamId() {
  if (!steamIdChanged.value || steamBusy.value) return
  steamBusy.value = true
  steamErrors.value = {}
  steamMessage.value = ''
  try {
    const value = steamIdForm.steamId.trim()
    applyAccount(await updateAccountSteamId(value || null))
    steamMessage.value = value ? 'Steam ID сохранён.' : 'Steam ID удалён.'
  } catch (error) {
    if (error instanceof ApiRequestError) {
      steamErrors.value = error.errors
      if (Object.keys(error.errors).length === 0) steamMessage.value = error.message
    } else {
      steamMessage.value = 'Не удалось сохранить Steam ID.'
    }
  } finally {
    steamBusy.value = false
  }
}

async function beginTwoFactorSetup() {
  twoFactorBusy.value = true
  twoFactorError.value = ''
  twoFactorMessage.value = ''
  try {
    const setup = await setupGoogleAuthenticator()
    const qrCode = await QRCode.toDataURL(setup.otpauthUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: { dark: '#111314', light: '#ffffff' },
    })
    twoFactorSetup.value = { ...setup, qrCode }
    twoFactorCode.value = ''
  } catch (error) {
    twoFactorError.value = error instanceof Error ? error.message : 'Не удалось начать подключение.'
  } finally {
    twoFactorBusy.value = false
  }
}

function closeTwoFactorSetup() {
  if (twoFactorBusy.value) return
  twoFactorSetup.value = null
  twoFactorCode.value = ''
  twoFactorError.value = ''
}

async function confirmTwoFactorSetup() {
  if (!account.value || twoFactorBusy.value) return
  twoFactorBusy.value = true
  twoFactorError.value = ''
  twoFactorMessage.value = ''
  try {
    await confirmGoogleAuthenticator(twoFactorCode.value)
    applyAccount({ ...account.value, twoFactorEnabled: true })
    twoFactorSetup.value = null
    twoFactorCode.value = ''
    twoFactorMessage.value = 'Google Authenticator подключён.'
  } catch (error) {
    twoFactorError.value = error instanceof Error ? error.message : 'Не удалось подтвердить код.'
  } finally {
    twoFactorBusy.value = false
  }
}

async function turnOffTwoFactor() {
  if (!account.value || twoFactorBusy.value) return
  twoFactorBusy.value = true
  twoFactorError.value = ''
  twoFactorMessage.value = ''
  try {
    await disableGoogleAuthenticator(twoFactorCode.value)
    applyAccount({ ...account.value, twoFactorEnabled: false })
    twoFactorCode.value = ''
    twoFactorMessage.value = 'Google Authenticator отключён.'
  } catch (error) {
    twoFactorError.value = error instanceof Error ? error.message : 'Не удалось отключить Google Authenticator.'
  } finally {
    twoFactorBusy.value = false
  }
}

async function endSession(session: AccountSession) {
  if (session.isCurrent || sessionActionId.value !== null) return
  if (!window.confirm(`Завершить сеанс «${session.device}»?`)) return

  sessionActionId.value = session.id
  sessionsError.value = ''
  try {
    await revokeAccountSession(session.id)
    sessions.value = sessions.value.filter((item) => item.id !== session.id)
  } catch (error) {
    sessionsError.value = error instanceof Error ? error.message : 'Не удалось завершить сеанс.'
  } finally {
    sessionActionId.value = null
  }
}

async function endOtherSessions() {
  if (revokeOthersBusy.value || otherSessionCount.value === 0) return
  if (!window.confirm('Завершить все остальные сеансы? Текущий сеанс останется активен.')) return

  revokeOthersBusy.value = true
  sessionsError.value = ''
  try {
    await revokeOtherAccountSessions()
    sessions.value = sessions.value.filter((session) => session.isCurrent)
  } catch (error) {
    sessionsError.value = error instanceof Error ? error.message : 'Не удалось завершить остальные сеансы.'
  } finally {
    revokeOthersBusy.value = false
  }
}

function formatActivity(value: string | null): string {
  if (!value) return 'Нет данных'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Нет данных'
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

onMounted(loadAccount)
onBeforeUnmount(() => {
  if (topToastTimer !== undefined) window.clearTimeout(topToastTimer)
})
</script>

<template>
  <Transition name="profile-toast">
    <div v-if="topToastMessage" class="profile-toast" :class="{ 'is-warning': topToastTone === 'warning' }" role="status" aria-live="polite" aria-atomic="true">
      <span class="profile-toast-icon motion-safe:animate-pulse"><Bell v-if="topToastTone === 'warning'" :size="15" /><Check v-else :size="15" :stroke-width="2.5" /></span>
      <span class="profile-toast-message">{{ topToastMessage }}</span>
      <button class="profile-toast-close" type="button" aria-label="Закрыть уведомление" @click="dismissTopToast"><X :size="15" /></button>
    </div>
  </Transition>
  <section class="welcome-section route-intro" aria-labelledby="settings-page-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> АККАУНТ <span class="eyebrow-slash">/</span> SETTINGS</div>
      <h1 id="settings-page-title">Настройки</h1>
      <p>Профиль, безопасность и активные устройства.</p>
    </div>
    <div class="route-intro-mark"><Shield :size="27" :stroke-width="1.5" /></div>
  </section>

  <PageLoader v-if="loading" message="Загружаем настройки…" />
  <div v-else-if="!account" class="empty-state section-empty settings-empty" role="alert">
    <span class="empty-icon"><UserRound :size="21" /></span>
    <div><strong>Войдите в аккаунт</strong><span>{{ pageMessage || 'Настройки доступны только владельцу профиля.' }}</span></div>
  </div>
  <div v-else class="settings-workspace">
    <div class="settings-tabs" role="tablist" aria-label="Настройки аккаунта">
      <button id="settings-tab-general" class="settings-tab" type="button" role="tab" :aria-selected="activeTab === 'general'" aria-controls="settings-panel-general" @click="activeTab = 'general'"><UserRound :size="15" /> Основные</button>
      <button id="settings-tab-social" class="settings-tab" type="button" role="tab" :aria-selected="activeTab === 'social'" aria-controls="settings-panel-social" @click="activeTab = 'social'"><Share2 :size="15" /> Социальные сети</button>
      <button id="settings-tab-notifications" class="settings-tab" type="button" role="tab" :aria-selected="activeTab === 'notifications'" aria-controls="settings-panel-notifications" @click="activeTab = 'notifications'"><Bell :size="15" /> Уведомления</button>
      <button id="settings-tab-security" class="settings-tab" type="button" role="tab" :aria-selected="activeTab === 'security'" aria-controls="settings-panel-security" @click="activeTab = 'security'"><ShieldCheck :size="15" /> Безопасность</button>
    </div>

    <section v-if="activeTab === 'general'" id="settings-panel-general" class="section-panel settings-panel" role="tabpanel" aria-labelledby="settings-tab-general">
      <div class="panel-heading"><div><div class="section-kicker">PERSONAL INFORMATION</div><h2>Основные данные</h2></div><span class="settings-panel-icon"><UserRound :size="17" /></span></div>

      <div class="settings-block">
        <div class="settings-block-heading"><Camera :size="15" /><strong>Аватар</strong></div>
        <div class="settings-media-row">
          <div class="settings-avatar-preview"><img v-if="account.avatarUrl" :src="account.avatarUrl" alt="Текущий аватар" /><span v-else>{{ account.nickname.slice(0, 1).toUpperCase() }}</span></div>
          <div class="settings-media-controls">
            <span>Аватар профиля. Аватар будет показываться в вашем профиле, статистике игроков, списке банов игроков, в активных матчах и тд. Рекомендуемое разрешение: 512x512 px.</span>
            <div class="settings-inline-actions">
              <button class="dialog-secondary settings-action-button" type="button" :disabled="mediaBusy !== null" @click="avatarInput?.click()"><Upload :size="13" /> {{ mediaBusy === 'avatar' ? 'Загрузка…' : 'Изменить' }}</button>
              <button class="settings-remove-button" type="button" :disabled="!account.avatarUrl || mediaBusy !== null" @click="removeMedia('avatar')"><Trash2 :size="13" /> Удалить</button>
            </div>
            <input ref="avatarInput" class="settings-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" @change="uploadMedia('avatar', $event)" />
          </div>
        </div>
      </div>

      <form class="settings-block settings-form" @submit.prevent="saveNickname">
        <div class="settings-block-heading"><UserRound :size="15" /><strong>Никнейм</strong></div>
        <label class="auth-field"><span>Имя профиля</span><input v-model.trim="accountForm.nickname" class="auth-input" type="text" autocomplete="nickname" required minlength="2" maxlength="32" pattern="[\p{L}\p{N}_!?#@]+" v-tooltip="'Только буквы, цифры и символы _ ! ? # @. Без пробелов и ссылок.'" :aria-invalid="Boolean(errorFor(accountErrors, 'nickname'))" /><span v-if="errorFor(accountErrors, 'nickname')" class="field-error">{{ errorFor(accountErrors, 'nickname') }}</span></label>
        <p v-if="nicknameMessage" class="settings-message" role="status">{{ nicknameMessage }}</p>
        <div class="settings-actions"><span>Ваш основной никнейм, который будет указываться на сайте в статистике, блокировках, активных матчах и тд.</span><button class="dialog-primary" type="submit" :disabled="!nicknameChanged || accountBusy">{{ accountBusy ? 'Сохраняем…' : 'Сохранить никнейм' }}</button></div>
      </form>

      <div class="settings-block">
        <div class="settings-block-heading"><Upload :size="15" /><strong>Шапка профиля</strong></div>
        <div class="settings-cover-preview" :class="{ 'has-cover': account.coverUrl }" :style="account.coverUrl ? { backgroundImage: `url(${account.coverUrl})` } : undefined"><span v-if="!account.coverUrl">Изображение шапки не установлено</span></div>
        <div class="settings-media-controls settings-cover-controls">
          <span>Фоновое изображение профиля. Шапка профиля будет видна всем пользователям. Рекомендуемое разрешение: 1920х640 px.</span>
          <div class="settings-inline-actions">
            <button class="dialog-secondary settings-action-button" type="button" :disabled="mediaBusy !== null" @click="coverInput?.click()"><Upload :size="13" /> {{ mediaBusy === 'cover' ? 'Загрузка…' : 'Изменить' }}</button>
            <button class="settings-remove-button" type="button" :disabled="!account.coverUrl || mediaBusy !== null" @click="removeMedia('cover')"><Trash2 :size="13" /> Удалить</button>
          </div>
          <input ref="coverInput" class="settings-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" @change="uploadMedia('cover', $event)" />
        </div>
      </div>

      <form class="settings-block settings-form" @submit.prevent="saveSteamId">
        <div class="settings-block-heading"><Link2 :size="15" /><strong>Привязать Steam ID</strong></div>
        <label class="auth-field"><span>SteamID64 или SteamAuth2</span><input v-model.trim="steamIdForm.steamId" class="auth-input" type="text" autocomplete="off" maxlength="32" pattern="([0-9]{17}|[Ss][Tt][Ee][Aa][Mm]_[0-5]:[01]:[0-9]{1,10})" placeholder="76561198000000000 или STEAM_0:1:12345678" v-tooltip="'Введите SteamID64 из 17 цифр или SteamAuth2 в формате STEAM_0:1:12345678.'" :disabled="Boolean(account.steamId)" :aria-invalid="Boolean(errorFor(steamErrors, 'steamId'))" /><span v-if="errorFor(steamErrors, 'steamId')" class="field-error">{{ errorFor(steamErrors, 'steamId') }}</span></label>
        <p v-if="account.steamId" class="settings-message" role="status">Изменение или удаление привязанного Steam ID доступно только через тикет администрации.</p>
        <p v-if="steamMessage" class="settings-message" role="status">{{ steamMessage }}</p>
        <div class="settings-actions"><span>Поддерживаются SteamID64 и SteamAuth2</span><button v-if="!account.steamId" class="dialog-primary" type="submit" :disabled="!steamIdChanged || steamBusy">{{ steamBusy ? 'Сохраняем…' : 'Привязать Steam ID' }}</button></div>
      </form>

      <p v-if="mediaError" class="auth-message" role="alert">{{ mediaError }}</p>
      <p v-else-if="mediaMessage" class="settings-message" role="status">{{ mediaMessage }}</p>
    </section>

    <section v-else-if="activeTab === 'social'" id="settings-panel-social" class="section-panel settings-panel" role="tabpanel" aria-labelledby="settings-tab-social">
      <div class="panel-heading"><div><div class="section-kicker">SOCIAL PROFILES</div><h2>Социальные сети</h2></div><span class="settings-panel-icon"><Share2 :size="17" /></span></div>
      <form class="settings-block settings-form" @submit.prevent="saveSocialLinks">
        <p class="settings-description">Укажите имя пользователя или ID без полной ссылки. Ссылка на профиль соберётся автоматически. Оставьте поле пустым, чтобы скрыть соцсеть.</p>
        <div v-for="platform in socialPlatforms" :key="platform.id" class="social-platform-row">
          <img class="social-platform-icon" :src="`/uploads/icons/${platform.icon}`" alt="" aria-hidden="true" width="30" height="30" loading="lazy" />
          <label class="auth-field social-platform-field" :for="`social-${platform.id}`">
            <span>{{ platform.label }}</span>
            <input :id="`social-${platform.id}`" v-model.trim="socialForm[platform.id]" class="auth-input" type="text" autocomplete="off" :placeholder="platform.placeholder" maxlength="100" :aria-invalid="Boolean(errorFor(socialErrors, `socialLinks.${platform.id}`))" />
            <span v-if="errorFor(socialErrors, `socialLinks.${platform.id}`)" class="field-error">{{ errorFor(socialErrors, `socialLinks.${platform.id}`) }}</span>
          </label>
        </div>
        <p v-if="socialMessage" class="settings-message" role="status">{{ socialMessage }}</p>
        <div class="settings-actions"><span>Ссылки открываются в новой вкладке</span><button class="dialog-primary" type="submit" :disabled="socialBusy">{{ socialBusy ? 'Сохраняем…' : 'Сохранить ссылки' }}</button></div>
      </form>
    </section>
    <section v-else-if="activeTab === 'notifications'" id="settings-panel-notifications" class="section-panel settings-panel" role="tabpanel" aria-labelledby="settings-tab-notifications">
      <div class="panel-heading"><div><div class="section-kicker">NOTIFICATION PREFERENCES</div><h2>Уведомления</h2></div><span class="settings-panel-icon"><Bell :size="17" /></span></div>
      <div v-if="notificationSettings" class="settings-block settings-form">
        <div class="push-control-card">
          <div class="push-control-copy">
            <strong>Push-уведомления</strong>
            <span>Получайте уведомления браузера, когда сайт закрыт. Настройка действует отдельно для этого браузера и устройства.</span>
            <small>{{ pushEnabled ? 'Push включены в этом браузере.' : 'Push выключены в этом браузере.' }}</small>
          </div>
          <button :class="pushEnabled ? 'settings-remove-button' : 'dialog-primary'" type="button" :disabled="notificationBusy || !notificationSettings.preferences.enabled || !notificationSettings.pushSupported" @click="updateBrowserPush(!pushEnabled)">
            {{ pushEnabled ? 'Выключить push' : 'Включить push' }}
          </button>
        </div>
        <p class="settings-description">{{ notificationSettings.pushConfigured ? 'Push работает в этом браузере после получения разрешения.' : 'Для push нужно установить Web Push зависимость и задать VAPID ключи на сервере.' }}</p>
        <p v-if="notificationError" class="auth-message" role="alert">{{ notificationError }}</p>
        <div class="notification-setting-row notification-master-row">
          <div><strong>Уведомления аккаунта</strong><span>Показывать выбранные события в центре уведомлений сайта.</span></div>
          <label class="settings-switch"><input type="checkbox" aria-label="Уведомления аккаунта" :checked="notificationSettings.preferences.enabled" :disabled="notificationBusy" @change="updateNotificationSetting('enabled', ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label>
        </div>
        <div v-for="category in notificationCategories" :key="category.id" class="notification-setting-row">
          <div><strong>{{ category.title }}</strong><span>{{ category.description }}</span></div>
          <label class="settings-switch"><input type="checkbox" :aria-label="category.title" :checked="notificationSettings.preferences[category.id]" :disabled="notificationBusy || !notificationSettings.preferences.enabled" @change="updateNotificationSetting(category.id, ($event.target as HTMLInputElement).checked)" /><span aria-hidden="true"></span></label>
        </div>
      </div>
      <p v-else-if="notificationError" class="auth-message" role="alert">{{ notificationError }}</p>
      <p v-else class="settings-description">Загружаем параметры уведомлений…</p>
    </section>
    <section v-else id="settings-panel-security" class="section-panel settings-panel" role="tabpanel" aria-labelledby="settings-tab-security">
      <div class="panel-heading"><div><div class="section-kicker">ACCOUNT SECURITY</div><h2>Безопасность</h2></div><span class="settings-panel-icon"><ShieldCheck :size="17" /></span></div>

      <form class="settings-block settings-form" @submit.prevent="requestPasswordChange">
        <div class="settings-block-heading"><KeyRound :size="15" /><strong>Изменить пароль</strong></div>
        <div class="settings-two-column">
          <label class="auth-field"><span>Текущий пароль</span><input v-model="passwordForm.current_password" class="auth-input" type="password" autocomplete="current-password" required :aria-invalid="Boolean(errorFor(passwordErrors, 'current_password'))" /><span v-if="errorFor(passwordErrors, 'current_password')" class="field-error">{{ errorFor(passwordErrors, 'current_password') }}</span></label>
          <label class="auth-field"><span>Новый пароль</span><input v-model="passwordForm.password" class="auth-input" type="password" autocomplete="new-password" required minlength="8" /><span v-if="errorFor(passwordErrors, 'password')" class="field-error">{{ errorFor(passwordErrors, 'password') }}</span></label>
          <label class="auth-field"><span>Повторите новый пароль</span><input v-model="passwordForm.password_confirmation" class="auth-input" type="password" autocomplete="new-password" required minlength="8" /></label>
        </div>
        <p v-if="passwordMessage" class="settings-message" role="status">{{ passwordMessage }}</p>
        <div class="settings-actions"><span>Не менее 8 символов</span><button class="dialog-primary" type="submit" :disabled="passwordBusy">{{ passwordBusy ? 'Обновляем…' : 'Обновить пароль' }}</button></div>
      </form>

      <form class="settings-block settings-form" @submit.prevent="requestEmailChange">
        <div class="settings-block-heading"><Mail :size="15" /><strong>Адрес электронной почты</strong></div>
        <label class="auth-field"><span>Email</span><input v-model.trim="accountForm.email" class="auth-input" type="email" autocomplete="email" required maxlength="254" :aria-invalid="Boolean(errorFor(accountErrors, 'email'))" /><span v-if="errorFor(accountErrors, 'email')" class="field-error">{{ errorFor(accountErrors, 'email') }}</span></label>
        <label v-if="emailChanged" class="auth-field"><span>Текущий пароль для смены email</span><input v-model="accountForm.current_password" class="auth-input" type="password" autocomplete="current-password" required :aria-invalid="Boolean(errorFor(accountErrors, 'current_password'))" /><span v-if="errorFor(accountErrors, 'current_password')" class="field-error">{{ errorFor(accountErrors, 'current_password') }}</span></label>
        <p v-if="emailMessage" class="settings-message" role="status">{{ emailMessage }}</p>
        <div class="settings-actions"><span>Email виден только вам</span><button class="dialog-primary" type="submit" :disabled="!emailChanged || accountBusy">{{ accountBusy ? 'Сохраняем…' : 'Сохранить email' }}</button></div>
      </form>

      <section class="settings-block settings-form" aria-labelledby="settings-two-factor-title">
        <div class="settings-block-heading"><ShieldCheck :size="15" /><strong id="settings-two-factor-title">Google Authenticator</strong><span class="settings-security-status" :class="{ 'is-enabled': account.twoFactorEnabled }">{{ account.twoFactorEnabled ? 'Подключён' : 'Не подключён' }}</span></div>
        <template v-if="!account.twoFactorEnabled">
          <p class="settings-description">При входе потребуется одноразовый код из приложения-аутентификатора.</p>
          <div class="settings-actions"><span>Google Authenticator и совместимые приложения</span><button class="dialog-primary" type="button" :disabled="twoFactorBusy" @click="beginTwoFactorSetup">{{ twoFactorBusy ? 'Готовим…' : 'Подключить' }}</button></div>
        </template>
        <form v-else class="settings-form" @submit.prevent="turnOffTwoFactor">
          <p class="settings-description">Для отключения подтвердите действие одноразовым кодом из приложения.</p>
          <label class="auth-field"><span>Код подтверждения</span><input v-model.trim="twoFactorCode" class="auth-input" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000" /></label>
          <p v-if="twoFactorError" class="auth-message" role="alert">{{ twoFactorError }}</p>
          <p v-if="twoFactorMessage" class="settings-message" role="status">{{ twoFactorMessage }}</p>
          <div class="settings-actions"><span>Дополнительная защита входа</span><button class="settings-remove-button" type="submit" :disabled="twoFactorBusy"><Shield :size="13" /> {{ twoFactorBusy ? 'Проверяем…' : 'Отключить' }}</button></div>
        </form>
        <p v-if="twoFactorError && !twoFactorSetup && !account.twoFactorEnabled" class="auth-message" role="alert">{{ twoFactorError }}</p>
        <p v-if="twoFactorMessage && !account.twoFactorEnabled" class="settings-message" role="status">{{ twoFactorMessage }}</p>
      </section>

      <section class="settings-block" aria-labelledby="settings-sessions-title">
        <div class="settings-block-heading"><Monitor :size="15" /><strong id="settings-sessions-title">Активность с устройств</strong></div>
        <p v-if="sessionsError" class="auth-message" role="alert">{{ sessionsError }}</p>
        <p v-if="sessionsLoading" class="settings-description" role="status">Загружаем сеансы…</p>
        <div v-else-if="sessions.length" class="settings-session-list">
          <article v-for="session in sessions" :key="session.id" class="settings-session-row">
            <span class="settings-session-icon"><component :is="session.deviceType === 'mobile' ? Smartphone : session.deviceType === 'tablet' ? Tablet : Monitor" :size="15" /></span>
            <div class="settings-session-info"><strong>{{ session.device }} <span v-if="session.isCurrent" class="settings-current-session">Текущий</span></strong><span>{{ session.ipAddress || 'IP неизвестен' }} · {{ formatActivity(session.lastActivity) }}</span></div>
            <button v-if="!session.isCurrent" class="settings-remove-button" type="button" :disabled="sessionActionId !== null || revokeOthersBusy" :aria-label="`Завершить сеанс ${session.device}`" v-tooltip="'Завершить сеанс'" @click="endSession(session)"><LogOut :size="14" /> {{ sessionActionId === session.id ? 'Завершаем…' : 'Завершить' }}</button>
          </article>
        </div>
        <p v-else-if="!sessionsLoading" class="settings-description">Активные сеансы не найдены.</p>
        <div class="settings-actions"><span>Текущий сеанс завершите через выход из аккаунта</span><button v-if="otherSessionCount" class="settings-remove-button" type="button" :disabled="revokeOthersBusy || sessionActionId !== null" @click="endOtherSessions"><LogOut :size="13" /> {{ revokeOthersBusy ? 'Завершаем…' : 'Завершить остальные сеансы' }}</button></div>
      </section>
    </section>
  </div>

  <Transition name="modal">
    <div v-if="twoFactorSetup" class="modal-backdrop" @click.self="closeTwoFactorSetup" @keydown.esc="closeTwoFactorSetup">
      <form class="info-dialog two-factor-dialog" role="dialog" aria-modal="true" aria-labelledby="two-factor-dialog-title" @submit.prevent="confirmTwoFactorSetup">
        <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="twoFactorBusy" @click="closeTwoFactorSetup"><X :size="18" /></button>
        <span class="dialog-mark"><ShieldCheck :size="20" /></span>
        <h2 id="two-factor-dialog-title">Подключение Google Authenticator</h2>
        <p>Отсканируйте QR-код приложением-аутентификатором или введите ключ настройки вручную.</p>
        <div class="two-factor-confirmation">
          <div class="two-factor-qr"><img :src="twoFactorSetup.qrCode" alt="QR-код настройки Google Authenticator" width="220" height="220" /></div>
          <div class="settings-secret"><span>Ключ настройки</span><code>{{ twoFactorSetup.secret }}</code></div>
          <label class="auth-field"><span>Одноразовый код</span><input v-model.trim="twoFactorCode" class="auth-input" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000" :aria-invalid="Boolean(twoFactorError)" /></label>
          <p v-if="twoFactorError" class="auth-message" role="alert">{{ twoFactorError }}</p>
          <div class="dialog-actions">
            <button class="dialog-secondary" type="button" :disabled="twoFactorBusy" @click="closeTwoFactorSetup">Отмена</button>
            <button class="dialog-primary" type="submit" :disabled="twoFactorBusy">{{ twoFactorBusy ? 'Проверяем…' : 'Подтвердить подключение' }}</button>
          </div>
        </div>
      </form>
    </div>
  </Transition>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="sensitiveChangeAction" class="modal-backdrop" @click.self="closeSensitiveChangeDialog" @keydown.esc="closeSensitiveChangeDialog">
        <form class="info-dialog auth-two-factor-dialog settings-security-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="sensitive-change-title" @submit.prevent="confirmSensitiveChange">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="accountBusy || passwordBusy" @click="closeSensitiveChangeDialog"><X :size="18" /></button>
          <div class="section-kicker">MATCHSTRIKE / ACCOUNT</div>
          <h2 id="sensitive-change-title">Подтверждение изменения</h2>
          <div class="auth-form auth-two-factor">
            <p class="auth-two-factor-copy">{{ sensitiveChangeAction === 'email' ? 'Введите шестизначный код из Google Authenticator, чтобы изменить email.' : 'Введите шестизначный код из Google Authenticator, чтобы изменить пароль.' }}</p>
            <label class="auth-field">
              <span>Код подтверждения</span>
              <div class="auth-code-inputs" role="group" aria-label="Шестизначный код Google Authenticator">
                <input v-for="index in sensitiveChangePositions" :key="index" :ref="(element) => setSensitiveChangeInput(index, element)" class="auth-input auth-code-input" type="text" inputmode="numeric" :autocomplete="index === 0 ? 'one-time-code' : 'off'" :value="sensitiveChangeDigits[index]" :aria-label="`Цифра ${index + 1} из 6`" :aria-invalid="Boolean(sensitiveChangeError)" :maxlength="6" required @input="handleSensitiveChangeInput(index, $event)" @keydown="handleSensitiveChangeKeydown(index, $event)" />
              </div>
              <span v-if="sensitiveChangeError" class="field-error" role="alert">{{ sensitiveChangeError }}</span>
            </label>
          </div>
          <div class="dialog-actions">
            <button class="dialog-secondary" type="button" :disabled="accountBusy || passwordBusy" @click="closeSensitiveChangeDialog">Отмена</button>
            <button class="dialog-primary" type="submit" :disabled="sensitiveChangeCode.length !== 6 || accountBusy || passwordBusy">{{ accountBusy || passwordBusy ? 'Проверяем…' : 'Подтвердить' }}</button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>
