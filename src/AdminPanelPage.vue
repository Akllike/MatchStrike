<script setup lang="ts">
import SiteAlert from './components/SiteAlert.vue'
import { websiteSettings } from './websiteSettings'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Activity, Ban, CircleHelp, Gamepad2, Image, KeyRound, Link2, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, Terminal, Trash2, Users, X, ChevronLeft, ChevronRight } from '@lucide/vue'
import PageLoader from './components/PageLoader.vue'
import SearchField from './components/SearchField.vue'
import TicketWorkspace from './components/TicketWorkspace.vue'
import AdminDashboard from './components/AdminDashboard.vue'
import AdminSiteStatistics from './components/AdminSiteStatistics.vue'
import AdminOperations from './components/AdminOperations.vue'
import AdminActivity from './components/AdminActivity.vue'
import AdminSiteSettings from './components/AdminSiteSettings.vue'
import { getWebsiteSettings } from './api'
import type { WebsiteSettings } from './api'
import { getAdminActivity, getAdminControlCenter, getAdminOperations } from './api'
import type { AdminActivityPage, AdminControlCenter, AdminOperationsData } from './api'
import { matchMapImage, handleMapImageError } from './matchArtwork'
import { setServerLobbyMode, setServerLobbyMaps, getServerLobbyMaps } from './api'
import {
  getAdminSiteStatistics,
  connectDonutMatch,
  disconnectDonutMatch,
  getAdminStatisticsSource,
  getAdminServers,
  getAdminUsers,
  getCurrentUser,
  deleteAdminServer,
  deleteAdminBan,
  disconnectAdminServerIntegration,
  getAdminBans,
  deleteAdminUserMedia,
  executeAdminServerRcon,
  refreshAdminServerQuery,
  saveAdminServer,
  saveAdminServerIntegration,
  updateAdminUser,
  updateAdminBan,
  unbanAdminBan,
  updateAdminUserBlockStatus,
  updateAdminUserPassword,
  updateAdminUserRole,
  deleteAdminUser,
} from './api'
import type { AdminBanStatusFilter, AdminGameServer, AdminSiteStatistics as AdminSiteStatisticsData, AdminRole, AdminServerDatabaseConfig, AdminServerIntegration, AdminSourceBan, AdminUserSummary, StatisticsSource } from './api'
import type { AdminSection } from './adminAccess'

const route = useRoute()
const section = computed<AdminSection | 'overview'>(() =>
  route.name === 'adminpanel' ? 'overview' : String(route.params.section) as AdminSection,
)
const adminRole = ref<AdminRole | null>(null)
const currentUserId = ref<number | null>(null)
const loading = ref(true)
const error = ref('')
const stats = ref<AdminSiteStatisticsData | null>(null)
const controlCenter = ref<AdminControlCenter | null>(null)
const operations = ref<AdminOperationsData | null>(null)
const activity = ref<AdminActivityPage | null>(null)
const siteSettings = ref<WebsiteSettings | null>(null)
const activityPage = ref(1)
const activitySearch = ref('')
const expandedServers = ref<number[]>([])
const actionToast = ref('')
const userDrawer = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
let previousOverflow: string | null = null
let sectionRequest = 0
let statisticsTimer: ReturnType<typeof setInterval> | undefined
let statisticsRefreshing = false
const statisticsSource = ref<StatisticsSource>('own')
const users = ref<AdminUserSummary[]>([])
const usersSearch = ref('')
const usersRoleFilter = ref<AdminRole | 'none' | ''>('')
const usersLoading = ref(false)
const usersSearchError = ref('')
const selectedUser = ref<AdminUserSummary | null>(null)
const userForm = ref({ nickname: '', email: '', steamId: '', adminRole: null as AdminRole | null, isBlocked: false })
const passwordForm = ref({ password: '', confirmation: '' })
const passwordEditorOpen = ref(false)
const userAction = ref<'save' | 'role' | 'password' | 'block' | 'media' | 'delete' | null>(null)
const userDialogError = ref('')
const userDialogStatus = ref('')
const confirmation = ref<'block' | 'unblock' | 'avatar' | 'cover' | 'delete' | null>(null)
const servers = ref<AdminGameServer[]>([])
const serversLoading = ref(false)
const serversError = ref('')
const serverDialog = ref<'server' | 'integration' | 'rcon' | 'donutmatch' | null>(null)
const serverAction = ref(false)
const togglingLobby = ref<number | null>(null)
const savingLobbyMaps = ref<number | null>(null)
const lobbyMapInputs = ref<Record<number, string>>({})
async function updateLobbyMaps(server: AdminGameServer, maps: string[]) {
  if (savingLobbyMaps.value !== null) return
  savingLobbyMaps.value = server.id
  serversError.value = ''
  try {
    const result = await setServerLobbyMaps(server.id, maps)
    replaceServer({ ...server, lobbyMaps: result.maps, lobbyMapsPending: result.pending, lobbyAvailableMaps: result.available })
    lobbyMapInputs.value[server.id] = ''
  } catch (error) { serversError.value = error instanceof Error ? error.message : 'Не удалось изменить пул карт.' }
  finally { savingLobbyMaps.value = null }
}
function addLobbyMap(server: AdminGameServer) {
  const map = (lobbyMapInputs.value[server.id] ?? '').trim()
  if (!/^[a-zA-Z0-9_/-]{1,63}$/.test(map)) { serversError.value = 'Укажите имя карты без пробелов и расширения .bsp.'; return }
  if (server.lobbyMaps.includes(map)) { serversError.value = 'Карта уже есть в пуле.'; return }
  void updateLobbyMaps(server, [...server.lobbyMaps, map])
}
async function refreshLobbyMaps(server: AdminGameServer) {
  if (savingLobbyMaps.value !== null) return
  savingLobbyMaps.value = server.id
  try {
    const result = await getServerLobbyMaps(server.id)
    replaceServer({ ...server, lobbyMaps: result.maps, lobbyMapsPending: result.pending, lobbyAvailableMaps: result.available })
  } catch (error) { serversError.value = error instanceof Error ? error.message : 'Не удалось обновить пул карт.' }
  finally { savingLobbyMaps.value = null }
}
async function toggleLobbyMode(server: AdminGameServer) {
  if (togglingLobby.value !== null) return
  togglingLobby.value = server.id
  serversError.value = ''
  try {
    await setServerLobbyMode(server.id, !server.lobbyEnabled)
    replaceServer({ ...server, lobbyEnabled: !server.lobbyEnabled, lobbyReady: false })
  } catch (error) { serversError.value = error instanceof Error ? error.message : 'Не удалось изменить режим сервера.' }
  finally { togglingLobby.value = null }
}
const serverDialogError = ref('')
const serverDialogStatus = ref('')
const activeServer = ref<AdminGameServer | null>(null)
const donutToken = ref('')
const siteOrigin = window.location.origin
const serverForm = ref({ name: '', ip: '', port: '27015', rconPassword: '' })
const integrationType = ref<AdminServerIntegration>('sourcebans')
const integrationForm = ref({
  host: '', port: '3306', database: '', username: '', password: '', table: '',
  playerColumn: '', authColumn: '', reasonColumn: '', createdColumn: '', endsColumn: '',
  killsColumn: '', deathsColumn: '', pointsColumn: '', rankColumn: '',
})
type IntegrationColumnKey = keyof typeof integrationForm.value
const rconCommand = ref('')
const rconOutput = ref('')
const refreshingServerId = ref<number | null>(null)
const deletingServerId = ref<number | null>(null)
const adminBans = ref<AdminSourceBan[]>([])
const adminBanCounts = ref<Record<AdminBanStatusFilter, number>>({ all: 0, active: 0, expired: 0, unbanned: 0, deleted: 0 })
const adminBanSearch = ref('')
const adminBanStatus = ref<AdminBanStatusFilter>('all')
const adminBanPage = ref(1)
const adminBanLastPage = ref(1)
const adminBanTotal = ref(0)
const adminBansLoading = ref(false)
const adminBansError = ref('')
const selectedBan = ref<AdminSourceBan | null>(null)
const banForm = ref({ player: '', authId: '', ip: '', reason: '', permanent: false, endsAt: '' })
const banAction = ref<'save' | 'unban' | 'delete' | null>(null)
const banDialogError = ref('')

const integrationColumnFields = computed<{ key: IntegrationColumnKey; label: string }[]>(() => integrationType.value === 'sourcebans'
  ? [
      { key: 'playerColumn', label: 'Колонка никнейма' },
      { key: 'authColumn', label: 'Колонка Steam ID / auth' },
      { key: 'reasonColumn', label: 'Колонка причины' },
      { key: 'createdColumn', label: 'Колонка даты бана' },
      { key: 'endsColumn', label: 'Колонка окончания' },
    ]
  : [
      { key: 'playerColumn', label: 'Колонка никнейма' },
      { key: 'authColumn', label: 'Колонка Steam ID / auth' },
      { key: 'killsColumn', label: 'Колонка убийств' },
      { key: 'deathsColumn', label: 'Колонка смертей' },
      { key: 'pointsColumn', label: 'Колонка очков' },
      { key: 'rankColumn', label: 'Колонка ранга' },
    ])
const activeIntegrationSettings = computed(() => {
  if (!activeServer.value) return null
  return integrationType.value === 'sourcebans'
    ? activeServer.value.sourcebansSettings
    : activeServer.value.levelsSettings
})

const sectionIcons = {
  users: Users,
  tickets: CircleHelp,
  servers: Gamepad2,
  statistics: Activity,
  bans: Ban,
  mutes: X,
  operations: Gamepad2,
  audit: Activity,
  settings: Settings,
} satisfies Record<AdminSection, typeof Users>
const sectionLabels: Record<AdminSection | 'overview', string> = {
  overview: 'Обзор',
  users: 'Пользователи',
  tickets: 'Тикеты',
  servers: 'Серверы',
  statistics: 'Статистика',
  bans: 'Баны',
  mutes: 'Муты',
  operations: 'Матчи и лобби',
  audit: 'Журнал действий',
  settings: 'Настройки сайта',
}
const sectionDescriptions: Partial<Record<AdminSection, string>> = {
  servers: 'Управление игровыми серверами пока не подключено.',
  mutes: 'Реестр ограничений чата пока не подключён.',
}
const roleOptions: { value: AdminRole; label: string }[] = [
  { value: 'moderator', label: 'Moderator' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'high_administrator', label: 'High Administrator' },
  { value: 'developer', label: 'Developer' },
]
const roleRanks: Record<AdminRole, number> = {
  moderator: 1,
  administrator: 2,
  high_administrator: 3,
  developer: 4,
}
const workspaceTitle = computed(() => section.value === 'bans' || section.value === 'mutes' ? 'Модерация' : sectionLabels[section.value])
watch(serversError, value => { if (value) actionToast.value = value })
watch(() => !!selectedUser.value, async opened => {
  if (opened) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    await nextTick()
    userDrawer.value?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus()
  } else {
    if (previousOverflow !== null) document.body.style.overflow = previousOverflow
    previousOverflow = null
    await nextTick(); previousFocus?.focus()
  }
})
function drawerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeUserSettings(); return }
  if (event.key !== 'Tab' || !userDrawer.value) return
  const nodes = [...userDrawer.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')]
  const first = nodes[0], last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function toggleServerDetails(id: number) { expandedServers.value = expandedServers.value.includes(id) ? expandedServers.value.filter(value => value !== id) : [...expandedServers.value, id] }
async function refreshOperations() {
  try { operations.value = await getAdminOperations() } catch (e) { actionToast.value = e instanceof Error ? e.message : 'Не удалось обновить матчи и лобби.' }
}
async function loadActivity(page: number, search: string) {
  activityPage.value = page; activitySearch.value = search
  await loadSection()
}
const assignableRoles = computed(() => roleOptions.filter((role) =>
  adminRole.value === 'developer' || roleRanks[role.value] < roleRanks[adminRole.value ?? 'moderator'],
))

function canManageUser(user: AdminUserSummary): boolean {
  if (!adminRole.value || currentUserId.value === user.id) return false
  const targetRank = user.adminRole ? roleRanks[user.adminRole] : 0
  return adminRole.value === 'developer' || targetRank < roleRanks[adminRole.value]
}

function openUserSettings(user: AdminUserSummary) {
  if (!canManageUser(user)) return
  selectedUser.value = user
  userForm.value = {
    nickname: user.nickname,
    email: user.email,
    steamId: user.steamId ?? '',
    adminRole: user.adminRole,
    isBlocked: user.isBlocked,
  }
  userDialogError.value = ''
  userDialogStatus.value = ''
  passwordForm.value = { password: '', confirmation: '' }
  passwordEditorOpen.value = false
  confirmation.value = null
}

function closeUserSettings() {
  if (userAction.value) return
  selectedUser.value = null
  confirmation.value = null
  userDialogError.value = ''
  userDialogStatus.value = ''
}

function updateUserInList(user: AdminUserSummary) {
  const index = users.value.findIndex((entry) => entry.id === user.id)
  if (index !== -1) users.value.splice(index, 1, user)
  selectedUser.value = user
  userForm.value = {
    nickname: user.nickname,
    email: user.email,
    steamId: user.steamId ?? '',
    adminRole: user.adminRole,
    isBlocked: user.isBlocked,
  }
}

async function saveUser() {
  if (!selectedUser.value) return
  userAction.value = 'save'
  userDialogError.value = ''
  try {
    updateUserInList(await updateAdminUser(selectedUser.value.id, {
      nickname: userForm.value.nickname,
      email: userForm.value.email,
      steamId: userForm.value.steamId.trim() || null,
    }))
  } catch (requestError) {
    userDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось сохранить пользователя.'
  } finally {
    userAction.value = null
  }
}

async function assignUserRole() {
  if (!selectedUser.value) return
  userAction.value = 'role'
  userDialogError.value = ''
  try {
    updateUserInList(await updateAdminUserRole(selectedUser.value.id, userForm.value.adminRole))
  } catch (requestError) {
    userDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось изменить роль.'
  } finally {
    userAction.value = null
  }
}

async function changeUserPassword() {
  if (!selectedUser.value || userAction.value) return
  userDialogError.value = ''
  userDialogStatus.value = ''

  if (passwordForm.value.password.length < 8) {
    userDialogError.value = 'Пароль должен содержать не менее 8 символов.'
    return
  }
  if (passwordForm.value.password !== passwordForm.value.confirmation) {
    userDialogError.value = 'Пароли не совпадают.'
    return
  }

  userAction.value = 'password'
  try {
    await updateAdminUserPassword(
      selectedUser.value.id,
      passwordForm.value.password,
      passwordForm.value.confirmation,
    )
    passwordForm.value = { password: '', confirmation: '' }
    passwordEditorOpen.value = false
    userDialogStatus.value = 'Пароль пользователя изменён.'
  } catch (requestError) {
    userDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось изменить пароль.'
  } finally {
    userAction.value = null
  }
}

function cancelPasswordChange() {
  passwordEditorOpen.value = false
  passwordForm.value = { password: '', confirmation: '' }
}

async function confirmUserAction() {
  if (!selectedUser.value || !confirmation.value) return
  const action = confirmation.value
  const userId = selectedUser.value.id
  userAction.value = action === 'delete' ? 'delete' : action === 'avatar' || action === 'cover' ? 'media' : 'block'
  userDialogError.value = ''
  userDialogStatus.value = ''

  try {
    if (action === 'delete') {
      await deleteAdminUser(userId)
      users.value = users.value.filter((user) => user.id !== userId)
      selectedUser.value = null
      confirmation.value = null
      return
    }

    if (action === 'avatar' || action === 'cover') {
      updateUserInList(await deleteAdminUserMedia(userId, action))
      confirmation.value = null
      userDialogStatus.value = action === 'avatar' ? 'Аватар профиля удалён.' : 'Шапка профиля удалена.'
      return
    }

    updateUserInList(await updateAdminUserBlockStatus(userId, action === 'block'))
    confirmation.value = null
  } catch (requestError) {
    userDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось выполнить действие.'
  } finally {
    userAction.value = null
  }
}

function closeServerDialog(force = false) {
  if (serverAction.value && !force) return
  serverDialog.value = null
  activeServer.value = null
  serverDialogError.value = ''
  serverDialogStatus.value = ''
  rconOutput.value = ''
  donutToken.value = ''
}

function openDonutMatch(server: AdminGameServer) {
  activeServer.value = server
  serverDialogError.value = ''
  donutToken.value = ''
  serverDialog.value = 'donutmatch'
}

async function configureDonutMatch(disconnect = false) {
  const server = activeServer.value
  if (!server || serverAction.value) return
  if (server.donutmatchConnected && !window.confirm(disconnect
    ? 'Отключить DonutMatch? История матчей сохранится.'
    : 'Создать новый ключ? Старый ключ перестанет работать.')) return
  serverAction.value = true
  serverDialogError.value = ''
  try {
    if (disconnect) {
      await disconnectDonutMatch(server.id)
      donutToken.value = ''
    } else {
      donutToken.value = await connectDonutMatch(server.id)
    }
    const updated = { ...server, donutmatchConnected: !disconnect, donutmatchLastSeenAt: null }
    activeServer.value = updated
    replaceServer(updated)
  } catch (requestError) {
    serverDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось изменить подключение DonutMatch.'
  } finally {
    serverAction.value = false
  }
}

function openServerEditor(server: AdminGameServer | null = null) {
  activeServer.value = server
  serverForm.value = {
    name: server?.name ?? '',
    ip: server?.ip ?? '',
    port: String(server?.port ?? 27015),
    rconPassword: '',
  }
  serverDialogError.value = ''
  serverDialogStatus.value = ''
  serverDialog.value = 'server'
}

function replaceServer(server: AdminGameServer) {
  const index = servers.value.findIndex((entry) => entry.id === server.id)
  if (index === -1) servers.value.unshift(server)
  else servers.value.splice(index, 1, server)
}

async function saveServerForm() {
  if (serverAction.value) return
  serverAction.value = true
  serverDialogError.value = ''
  try {
    const server = await saveAdminServer({
      name: serverForm.value.name,
      ip: serverForm.value.ip,
      port: Number(serverForm.value.port),
      rconPassword: serverForm.value.rconPassword,
    }, activeServer.value?.id)
    replaceServer(server)
    closeServerDialog(true)
  } catch (requestError) {
    serverDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось сохранить сервер.'
  } finally {
    serverAction.value = false
  }
}

async function refreshServer(server: AdminGameServer) {
  refreshingServerId.value = server.id
  serversError.value = ''
  try {
    replaceServer(await refreshAdminServerQuery(server.id))
  } catch (requestError) {
    serversError.value = requestError instanceof Error ? requestError.message : 'Не удалось обновить данные сервера.'
  } finally {
    refreshingServerId.value = null
  }
}

async function removeServer(server: AdminGameServer) {
  if (deletingServerId.value !== null || !window.confirm(`Удалить сервер ${server.name || `${server.ip}:${server.port}`}?`)) return
  deletingServerId.value = server.id
  serversError.value = ''
  try {
    await deleteAdminServer(server.id)
    servers.value = servers.value.filter((entry) => entry.id !== server.id)
  } catch (requestError) {
    serversError.value = requestError instanceof Error ? requestError.message : 'Не удалось удалить сервер.'
  } finally {
    deletingServerId.value = null
  }
}

function openIntegration(server: AdminGameServer, integration: AdminServerIntegration) {
  activeServer.value = server
  integrationType.value = integration
  const settings = integration === 'sourcebans' ? server.sourcebansSettings : server.levelsSettings
  const columns = settings?.columns ?? {}
  integrationForm.value = {
    host: settings?.host ?? '',
    port: String(settings?.port ?? 3306),
    database: settings?.database ?? '',
    username: settings?.username ?? '',
    password: '',
    table: settings?.table ?? '',
    playerColumn: columns.player ?? '',
    authColumn: columns.auth ?? '',
    reasonColumn: columns.reason ?? '',
    createdColumn: columns.created ?? '',
    endsColumn: columns.ends ?? '',
    killsColumn: columns.kills ?? '',
    deathsColumn: columns.deaths ?? '',
    pointsColumn: columns.points ?? '',
    rankColumn: columns.rank ?? '',
  }
  serverDialogError.value = ''
  serverDialogStatus.value = ''
  serverDialog.value = 'integration'
}

async function saveIntegrationForm() {
  if (!activeServer.value || serverAction.value) return
  serverAction.value = true
  serverDialogError.value = ''
  serverDialogStatus.value = ''
  try {
    const payload: AdminServerDatabaseConfig = {
      host: integrationForm.value.host,
      port: Number(integrationForm.value.port),
      database: integrationForm.value.database,
      username: integrationForm.value.username,
      password: integrationForm.value.password,
      table: integrationForm.value.table,
      playerColumn: integrationForm.value.playerColumn,
      authColumn: integrationForm.value.authColumn,
      ...(integrationType.value === 'sourcebans'
        ? {
            reasonColumn: integrationForm.value.reasonColumn,
            createdColumn: integrationForm.value.createdColumn,
            endsColumn: integrationForm.value.endsColumn,
          }
        : {
            killsColumn: integrationForm.value.killsColumn,
            deathsColumn: integrationForm.value.deathsColumn,
            pointsColumn: integrationForm.value.pointsColumn,
            rankColumn: integrationForm.value.rankColumn,
          }),
    }
    replaceServer(await saveAdminServerIntegration(activeServer.value.id, integrationType.value, payload))
    serverDialogStatus.value = 'Подключение проверено, настройки сохранены.'
  } catch (requestError) {
    serverDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось подключить базу данных.'
  } finally {
    serverAction.value = false
  }
}

async function disconnectIntegration() {
  if (!activeServer.value || serverAction.value || !activeIntegrationSettings.value) return
  const integrationLabel = integrationType.value === 'sourcebans' ? 'SourceBans' : 'Levels Ranks'
  if (!window.confirm(`Отключить ${integrationLabel} от сервера ${activeServer.value.name || activeServer.value.ip}?`)) return
  serverAction.value = true
  serverDialogError.value = ''
  try {
    replaceServer(await disconnectAdminServerIntegration(activeServer.value.id, integrationType.value))
    closeServerDialog(true)
  } catch (requestError) {
    serverDialogError.value = requestError instanceof Error ? requestError.message : `Не удалось отключить ${integrationLabel}.`
  } finally {
    serverAction.value = false
  }
}

function openRcon(server: AdminGameServer) {
  activeServer.value = server
  rconCommand.value = ''
  rconOutput.value = ''
  serverDialogError.value = ''
  serverDialog.value = 'rcon'
}

async function runRcon() {
  if (!activeServer.value || serverAction.value) return
  serverAction.value = true
  serverDialogError.value = ''
  rconOutput.value = ''
  try {
    rconOutput.value = await executeAdminServerRcon(activeServer.value.id, rconCommand.value)
  } catch (requestError) {
    serverDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось выполнить RCON-команду.'
  } finally {
    serverAction.value = false
  }
}

const banStatusOptions: { value: AdminBanStatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'expired', label: 'Истёкшие' },
  { value: 'unbanned', label: 'Разбаненные' },
  { value: 'deleted', label: 'Удалённые' },
]

async function loadAdminBans() {
  adminBansLoading.value = true
  adminBansError.value = ''
  try {
    const data = await getAdminBans(adminBanPage.value, adminBanSearch.value, adminBanStatus.value)
    adminBans.value = data.bans
    adminBanCounts.value = data.counts
    adminBanTotal.value = data.pagination.total
    adminBanLastPage.value = data.pagination.lastPage
  } catch (requestError) {
    adminBansError.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить список банов.'
  } finally {
    adminBansLoading.value = false
  }
}

function searchAdminBans() {
  adminBanPage.value = 1
  void loadAdminBans()
}

function selectAdminBanStatus(value: AdminBanStatusFilter) {
  if (adminBanStatus.value === value) return
  adminBanStatus.value = value
  adminBanPage.value = 1
  void loadAdminBans()
}

function changeAdminBanPage(value: number) {
  adminBanPage.value = value
  void loadAdminBans()
}

function dateTimeLocal(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

function banStatusLabel(ban: AdminSourceBan): string {
  return {
    active: ban.permanent ? 'Навсегда' : 'Активен',
    expired: 'Истёк',
    unbanned: 'Разбанен',
    deleted: 'Удалён',
  }[ban.status]
}

function editAdminBan(ban: AdminSourceBan) {
  if (ban.status === 'unbanned' || ban.status === 'deleted') return
  selectedBan.value = ban
  banDialogError.value = ''
  banForm.value = {
    player: ban.player,
    authId: ban.authId,
    ip: ban.ip,
    reason: ban.reason,
    permanent: ban.permanent,
    endsAt: dateTimeLocal(ban.endsAt),
  }
}

function closeBanDialog(force = false) {
  if (banAction.value && !force) return
  selectedBan.value = null
  banDialogError.value = ''
}

async function saveAdminBan() {
  if (!selectedBan.value || banAction.value) return
  banAction.value = 'save'
  banDialogError.value = ''
  try {
    const endsAt = banForm.value.permanent || !banForm.value.endsAt
      ? null
      : Math.floor(new Date(banForm.value.endsAt).getTime() / 1000)
    if (!banForm.value.permanent && (!endsAt || !Number.isFinite(endsAt))) {
      throw new Error('Укажи корректную дату окончания или выбери постоянный бан.')
    }
    await updateAdminBan(selectedBan.value.serverId, selectedBan.value.id, {
      player: banForm.value.player,
      authId: banForm.value.authId,
      ip: banForm.value.ip,
      reason: banForm.value.reason,
      permanent: banForm.value.permanent,
      endsAt,
    })
    closeBanDialog(true)
    await loadAdminBans()
  } catch (requestError) {
    banDialogError.value = requestError instanceof Error ? requestError.message : 'Не удалось сохранить бан.'
  } finally {
    banAction.value = null
  }
}

async function unbanAdminEntry(ban: AdminSourceBan) {
  if (ban.status !== 'active' || !window.confirm(`Снять бан игрока ${ban.player} на сервере «${ban.serverName}»?`)) return
  banAction.value = 'unban'
  adminBansError.value = ''
  try {
    await unbanAdminBan(ban.serverId, ban.id)
    await loadAdminBans()
  } catch (requestError) {
    adminBansError.value = requestError instanceof Error ? requestError.message : 'Не удалось снять бан.'
  } finally {
    banAction.value = null
  }
}

async function deleteAdminEntry(ban: AdminSourceBan) {
  if (ban.status === 'deleted' || !window.confirm(`Пометить бан игрока ${ban.player} как удалённый? Он исчезнет из публичного реестра, но запись останется в истории SourceBans.`)) return
  banAction.value = 'delete'
  adminBansError.value = ''
  try {
    await deleteAdminBan(ban.serverId, ban.id)
    closeBanDialog(true)
    await loadAdminBans()
  } catch (requestError) {
    adminBansError.value = requestError instanceof Error ? requestError.message : 'Не удалось удалить бан.'
  } finally {
    banAction.value = null
  }
}

async function loadSection() {
  const request = ++sectionRequest
  const currentSection = section.value
  const current = () => request === sectionRequest && currentSection === section.value
  loading.value = true
  error.value = ''

  try {
    const user = await getCurrentUser()
    if (!current()) return
    adminRole.value = user?.adminRole ?? null
    currentUserId.value = user?.id ?? null

    if (!adminRole.value) {
      error.value = 'Не удалось определить права администратора.'
      return
    }

    if (currentSection === 'overview') {
      const data = await getAdminControlCenter(); if (current()) controlCenter.value = data
    } else if (currentSection === 'statistics') {
      const data = await getAdminSiteStatistics(); if (current()) stats.value = data
    } else if (currentSection === 'users') {
      const data = await getAdminUsers(usersSearch.value, usersRoleFilter.value); if (current()) users.value = data
    } else if (currentSection === 'servers') {
      serversLoading.value = true
      const data = await getAdminServers(); if (current()) servers.value = data
    } else if (currentSection === 'operations') {
      const data = await getAdminOperations(); if (current()) operations.value = data
    } else if (currentSection === 'audit') {
      const data = await getAdminActivity(activityPage.value, activitySearch.value); if (current()) activity.value = data
    } else if (currentSection === 'settings') {
      const [data, source] = await Promise.all([getWebsiteSettings(true), getAdminStatisticsSource()])
      if (current()) { siteSettings.value = data; statisticsSource.value = source }
    } else if (currentSection === 'bans') {
      await loadAdminBans()
    }
  } catch (requestError) {
    if (current()) error.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить раздел.'
  } finally {
    if (current()) { serversLoading.value = false; loading.value = false }
  }
}

async function searchUsers() {
  if (usersLoading.value) return
  usersLoading.value = true
  usersSearchError.value = ''
  try {
    users.value = await getAdminUsers(usersSearch.value, usersRoleFilter.value)
  } catch (requestError) {
    usersSearchError.value = requestError instanceof Error ? requestError.message : 'Не удалось выполнить поиск.'
  } finally {
    usersLoading.value = false
  }
}

function clearUserSearch() {
  usersSearch.value = ''
  usersRoleFilter.value = ''
  void searchUsers()
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(timestamp)
    : '—'
}

function lastSeenLabel(value: string | null): string {
  if (!value) return 'Не заходил'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Не заходил'
  if (Date.now() - timestamp < 5 * 60 * 1000) return 'В сети'
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

onMounted(() => {
  void loadSection()
  statisticsTimer = setInterval(async () => {
    if (section.value !== 'statistics' || loading.value || statisticsRefreshing || document.hidden) return
    statisticsRefreshing = true
    const request = sectionRequest
    try {
      const data = await getAdminSiteStatistics()
      if (request === sectionRequest && section.value === 'statistics') stats.value = data
    } catch (e) {
      if (request === sectionRequest && section.value === 'statistics') actionToast.value = e instanceof Error ? e.message : 'Не удалось обновить статистику сайта.'
    } finally { statisticsRefreshing = false }
  }, 30000)
})
onBeforeUnmount(() => { if (statisticsTimer) clearInterval(statisticsTimer); sectionRequest++; if (previousOverflow !== null) document.body.style.overflow = previousOverflow })
watch(section, (next, previous) => {
  if (next !== previous) {
    void loadSection()
  }
})
</script>

<template>
  <SiteAlert :message="adminBansError" @close="adminBansError = ''" />
  <SiteAlert :message="usersSearchError" @close="usersSearchError = ''" />
  <SiteAlert :message="userDialogError" tone="error" @close="userDialogError = ''" />
  <SiteAlert :message="userDialogStatus" tone="success" @close="userDialogStatus = ''" />
  <SiteAlert :message="serverDialogError" tone="error" @close="serverDialogError = ''" />
  <SiteAlert :message="serverDialogStatus" tone="success" @close="serverDialogStatus = ''" />
  <SiteAlert :message="banDialogError" tone="error" @close="banDialogError = ''" />
  <SiteAlert :message="actionToast" @close="actionToast = ''" />

  <div class="admin-workspace">
  <header class="admin-workspace-header"><div><span class="section-kicker">{{ websiteSettings.name.toUpperCase() }} / УПРАВЛЕНИЕ</span><h1 id="admin-page-title">{{ workspaceTitle }}</h1><p>{{ section === 'overview' ? 'Серверы, игры и обращения — всё под контролем.' : 'Управление сообществом ' + websiteSettings.name }}</p></div><div><span class="admin-workspace-role"><ShieldCheck :size="14" /> {{ roleOptions.find(role => role.value === adminRole)?.label || 'Администрация' }}</span><button class="admin-server-icon-button" type="button" :disabled="loading" aria-label="Обновить раздел" v-tooltip="'Обновить раздел'" @click="loadSection"><RefreshCw :size="15" :class="{ 'is-spinning': loading }" /></button></div></header>
  <div v-if="section === 'bans' || section === 'mutes'" class="admin-segmented admin-moderation-tabs"><RouterLink to="/adminpanel/bans" :aria-current="section === 'bans' ? 'page' : undefined">Баны</RouterLink><RouterLink to="/adminpanel/mutes" :aria-current="section === 'mutes' ? 'page' : undefined">Муты</RouterLink></div>
  <Transition name="profile-content" mode="out-in">
  <PageLoader v-if="loading" key="loading" :message="`Загружаем ${sectionLabels[section].toLowerCase()}…`" />
  <div v-else-if="error" key="error" class="admin-error" role="alert">
    <strong>Не удалось открыть раздел</strong>
    <span>{{ error }}</span>
    <button class="friend-action" type="button" @click="loadSection">Повторить</button>
  </div>

  <AdminDashboard v-else-if="section === 'overview' && controlCenter && adminRole" key="overview" :data="controlCenter" :role="adminRole" />
  <AdminOperations v-else-if="section === 'operations' && operations" key="operations" :data="operations" @refresh="refreshOperations" />
  <AdminActivity v-else-if="section === 'audit' && activity" key="audit" :data="activity" @load="loadActivity" />
  <AdminSiteSettings v-else-if="section === 'settings' && siteSettings" key="settings" :data="siteSettings" :statistics-source="statisticsSource" />
  <AdminSiteStatistics v-else-if="section === 'statistics' && stats" key="statistics" :data="stats" />

  <section v-else-if="section === 'users'" key="users" class="admin-content" aria-labelledby="admin-users-title">
    <div class="section-heading">
      <div><div class="section-kicker">{{ websiteSettings.name.toUpperCase() }} / ACCOUNTS</div><h2 id="admin-users-title">Пользователи</h2></div>
      <span class="section-count">{{ users.length.toString().padStart(2, '0') }} <span>НАЙДЕНО</span></span>
    </div>
    <form class="admin-user-search" role="search" @submit.prevent="searchUsers">
      <SearchField v-model.trim="usersSearch" :maxlength="100" label="Никнейм, email или роль" placeholder="Поиск по никнейму, email или роли" />
      <label class="auth-field">
        <span>Фильтр по роли</span>
        <select v-model="usersRoleFilter" class="auth-input">
          <option value="">Все роли</option>
          <option value="none">Без роли</option>
          <option v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</option>
        </select>
      </label>
      <div class="admin-user-search-actions">
        <button class="friend-action admin-user-search-submit" type="submit" :disabled="usersLoading"><Search :size="14" /> {{ usersLoading ? 'Ищем…' : 'Найти' }}</button>
        <button class="friend-action admin-user-search-clear" type="button" aria-label="Сбросить поиск" v-tooltip="'Сбросить поиск'" :disabled="usersLoading || (!usersSearch && !usersRoleFilter)" @click="clearUserSearch"><X :size="14" /></button>
      </div>
    </form>

    <p v-if="usersLoading" class="admin-user-search-status" role="status">Ищем пользователей…</p>
    <div v-if="users.length" class="admin-table-wrap">
      <table class="admin-users-table">
        <thead><tr><th>Игрок</th><th>Email</th><th>Роль</th><th>Статус</th><th>Регистрация</th><th>Последний визит</th><th></th></tr></thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td><span class="admin-user-identity"><img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" /><span v-else class="admin-user-initial">{{ user.nickname.slice(0,1).toUpperCase() }}</span><span><RouterLink :to="{ name: 'profile', params: { nickname: user.nickname } }">{{ user.nickname }}</RouterLink><small>{{ user.steamId || 'Steam не привязан' }}</small></span></span></td>
            <td>{{ user.email }}</td>
            <td><span class="admin-role-label" :class="{ 'is-admin': user.adminRole }">{{ user.adminRoleLabel ?? 'Игрок' }}</span></td>
            <td><span class="admin-user-status" :class="{ 'is-blocked': user.isBlocked }">{{ user.isBlocked ? 'Заблокирован' : 'Активен' }}</span></td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>{{ lastSeenLabel(user.lastSeenAt) }}</td>
            <td><button class="friend-action admin-settings-button" type="button" :disabled="!canManageUser(user)" v-tooltip="canManageUser(user) ? 'Настройки пользователя' : 'Недостаточно прав для управления этим аккаунтом'" @click="openUserSettings(user)"><Settings :size="13" /> Настройки</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="admin-placeholder"><Users :size="19" /><strong>{{ usersSearch || usersRoleFilter ? 'Ничего не найдено' : 'Пользователей пока нет' }}</strong><span v-if="usersSearch || usersRoleFilter">Измените запрос или фильтр роли.</span></div>
  </section>

  <section v-else-if="section === 'servers'" key="servers" class="admin-content admin-servers-workspace" aria-labelledby="admin-servers-title">
    <div class="section-heading">
      <div><div class="section-kicker">{{ websiteSettings.name.toUpperCase() }} / INFRASTRUCTURE</div><h2 id="admin-servers-title">Игровые серверы</h2></div>
      <button class="dialog-primary admin-server-add" type="button" @click="openServerEditor()"><Plus :size="14" /> Добавить</button>
    </div>
    <div v-if="serversLoading" class="admin-server-loading" role="status">Загружаем серверы…</div>
    <div v-else-if="servers.length" class="admin-server-list">
      <article v-for="server in servers" :key="server.id" class="admin-server-card">
        <div class="admin-server-preview"><img v-if="server.query.map && matchMapImage(server.query.map)" :src="matchMapImage(server.query.map)!" alt="" loading="lazy" @error="handleMapImageError" /><div></div><span class="admin-state" :class="typeof server.query.players === 'number' ? 'is-online' : 'is-offline'"><i></i>{{ typeof server.query.players === 'number' ? 'Онлайн' : 'Нет ответа' }}</span><span class="admin-server-mode">{{ server.lobbyEnabled ? 'Только лобби' : 'Общедоступный' }}</span></div>
        <div class="admin-server-card-content">
        <div class="admin-server-card-head">
          <div class="admin-server-identity">
            <span class="admin-server-icon"><Gamepad2 :size="17" /></span>
            <div>
              <h3>{{ server.name || server.query.hostName || `Сервер ${server.id}` }}</h3>
              <span class="admin-server-address">{{ server.ip }}:{{ server.port }}</span>
            </div>
          </div>
          <button class="admin-server-icon-button" type="button" :aria-label="refreshingServerId === server.id ? 'Обновление данных сервера' : 'Обновить данные сервера'" v-tooltip="'Обновить данные сервера'" :disabled="refreshingServerId !== null || deletingServerId !== null" @click="refreshServer(server)">
            <RefreshCw :size="14" :class="{ 'is-spinning': refreshingServerId === server.id }" />
          </button>
        </div>
        <div class="admin-server-facts">
          <div><span>Карта</span><strong>{{ server.query.map || 'Нет данных' }}</strong></div>
          <div><span>Игроки</span><strong>{{ server.query.players == null ? '—' : `${server.query.players} / ${server.query.maxPlayers ?? '—'}` }}</strong></div>
        </div>
        <div class="admin-integration-badges"><span :class="{ 'is-connected': server.sourcebansConnected }"><i></i>SourceBans</span><span :class="{ 'is-connected': server.levelsConnected }"><i></i>LVL</span><span :class="{ 'is-connected': server.donutmatchConnected }"><i></i>DonutMatch</span></div>
        <button class="admin-server-details-toggle" type="button" :aria-expanded="expandedServers.includes(server.id)" :aria-controls="`admin-server-details-${server.id}`" @click="toggleServerDetails(server.id)"><Settings :size="14" /> Настройка и управление <ChevronRight :size="15" :class="{ 'is-open': expandedServers.includes(server.id) }" /></button>
        <div v-if="expandedServers.includes(server.id)" :id="`admin-server-details-${server.id}`" class="admin-server-details">
        <div class="admin-server-actions">
          <button class="friend-action server-lobby-switch" type="button" role="switch" :aria-checked="server.lobbyEnabled" :disabled="togglingLobby !== null" @click="toggleLobbyMode(server)"><span class="server-lobby-track" aria-hidden="true"><i></i></span> Лобби: {{ server.lobbyEnabled ? 'включено · только комнаты' : 'выключено · общедоступный' }}</button>
          <span v-if="server.lobbyEnabled" class="profile-data-note">{{ server.lobbyError || (server.lobbyReady ? 'Готов к распределению' : 'Ожидает мост или занят матчем') }}</span>
          <button class="friend-action" type="button" @click="openServerEditor(server)"><Pencil :size="13" /> Изменить</button>
          <button class="friend-action" type="button" @click="openIntegration(server, 'sourcebans')"><Link2 :size="13" /> {{ server.sourcebansConnected ? 'SourceBans' : 'Подключить SourceBans' }}</button>
          <button class="friend-action" type="button" @click="openIntegration(server, 'levels')"><Database :size="13" /> {{ server.levelsConnected ? 'LVL' : 'Подключить LVL' }}</button>
          <button class="friend-action" type="button" @click="openDonutMatch(server)"><Link2 :size="13" /> {{ server.donutmatchConnected ? 'DonutMatch' : 'Подключить DonutMatch' }}</button>
          <button class="friend-action" type="button" @click="openRcon(server)"><Terminal :size="13" /> Выполнить RCON</button>
          <button class="admin-danger-button is-delete" type="button" :disabled="deletingServerId === server.id || refreshingServerId !== null" @click="removeServer(server)"><Trash2 :size="13" /> {{ deletingServerId === server.id ? 'Удаляем…' : 'Удалить' }}</button>
        </div>
        <section v-if="server.lobbyEnabled" class="server-lobby-maps" aria-label="Карты для лобби">
          <header><strong>Карты для лобби</strong><span>{{ server.lobbyMapsPending ? 'Ожидаем подтверждения donut_map_pool' : 'Пул из donut_map_pool' }}</span><button class="friend-action" type="button" :disabled="savingLobbyMaps !== null" @click="refreshLobbyMaps(server)"><RefreshCw :size="12" /> Обновить</button></header>
          <div class="server-lobby-map-tags"><span v-for="map in server.lobbyMaps" :key="map" :class="{ 'is-unavailable': !server.lobbyAvailableMaps.includes(map) }"><code>{{ map }}</code><small v-if="!server.lobbyAvailableMaps.includes(map)" v-tooltip="'Карта не обнаружена на сервере. Для матча нужен установленный .bsp; после добавления дождитесь обновления моста.'" tabindex="0" aria-label="Карта не установлена">!</small><button type="button" :aria-label="`Удалить ${map} из пула лобби`" :disabled="savingLobbyMaps !== null" @click="updateLobbyMaps(server, server.lobbyMaps.filter(item => item !== map))"><X :size="12" /></button></span></div>
          <p v-if="!server.lobbyMaps.length">В пуле пока нет карт. Добавьте карты или дождитесь первого подключения обновлённого моста.</p>
          <form @submit.prevent="addLobbyMap(server)"><input v-model.trim="lobbyMapInputs[server.id]" type="text" :aria-label="`Добавить карту на сервер ${server.name || server.id}`" placeholder="Например, de_dust2_ob" required maxlength="63" :disabled="savingLobbyMaps !== null" /><button class="friend-action" type="submit" :disabled="savingLobbyMaps !== null || server.lobbyMaps.length >= 32"><Plus :size="13" /> Добавить</button></form>
          <p>Удаление убирает карту из пула будущих лобби. Файлы карты и порядок карт текущего матча сохраняются.</p>
        </section>
        </div>
        </div>
      </article>
    </div>
    <div v-else class="admin-placeholder"><Gamepad2 :size="20" /><strong>Серверы ещё не добавлены</strong><span>Добавьте IP, порт и RCON-пароль, чтобы начать управление.</span></div>
  </section>

  <section v-else-if="section === 'tickets'" key="tickets" class="admin-content" aria-label="Тикеты">
    <TicketWorkspace admin />
  </section>

  <section v-else-if="section === 'bans'" key="bans" class="admin-content" aria-labelledby="admin-bans-title">
    <div class="section-heading">
      <div><div class="section-kicker">SOURCEBANS / MODERATION</div><h2 id="admin-bans-title">Реестр банов</h2></div>
      <span class="section-count">{{ adminBanTotal.toLocaleString('ru-RU') }} <span>ЗАПИСЕЙ</span></span>
    </div>
    <form class="admin-ban-search" role="search" @submit.prevent="searchAdminBans">
      <SearchField v-model.trim="adminBanSearch" :maxlength="100" label="Поиск по нику, Steam ID, IP или причине" />
      <button class="friend-action admin-user-search-submit" type="submit" :disabled="adminBansLoading"><Search :size="14" /> Найти</button>
      <button class="friend-action admin-server-icon-button" type="button" aria-label="Обновить список" v-tooltip="'Обновить список'" :disabled="adminBansLoading" @click="loadAdminBans"><RefreshCw :size="14" :class="{ 'is-spinning': adminBansLoading }" /></button>
    </form>
    <div class="admin-ban-filters" role="group" aria-label="Фильтр по статусу бана">
      <button v-for="item in banStatusOptions" :key="item.value" type="button" :aria-pressed="adminBanStatus === item.value" @click="selectAdminBanStatus(item.value)">{{ item.label }} <span>{{ adminBanCounts[item.value].toLocaleString('ru-RU') }}</span></button>
    </div>

    <PageLoader v-if="adminBansLoading" message="Загружаем баны…" />
    <div v-else-if="adminBans.length" class="admin-table-wrap admin-bans-table-wrap">
      <table class="admin-bans-table">
        <thead><tr><th>Игрок</th><th>Причина</th><th>Сервер</th><th>Дата</th><th>Окончание</th><th>Статус</th><th>Действия</th></tr></thead>
        <tbody>
          <tr v-for="ban in adminBans" :key="`${ban.serverId}-${ban.id}`">
            <td class="admin-ban-player"><strong>{{ ban.player }}</strong><code>{{ ban.authId }}</code><small v-if="ban.ip">IP: {{ ban.ip }}</small></td>
            <td class="admin-ban-reason">{{ ban.reason }}</td>
            <td>{{ ban.serverName }}</td>
            <td>{{ formatDateTime(ban.createdAt) }}</td>
            <td>{{ ban.permanent ? 'Навсегда' : formatDateTime(ban.endsAt) }}</td>
            <td><span class="admin-ban-status" :class="`is-${ban.status}`">{{ banStatusLabel(ban) }}</span></td>
            <td><div class="admin-ban-actions">
              <button class="friend-action" type="button" :disabled="ban.status === 'unbanned' || ban.status === 'deleted' || banAction !== null" @click="editAdminBan(ban)"><Pencil :size="12" /> Изменить</button>
              <button v-if="ban.status === 'active'" class="friend-action" type="button" :disabled="banAction !== null" @click="unbanAdminEntry(ban)"><Ban :size="12" /> Разбанить</button>
              <button v-if="ban.status !== 'deleted'" class="admin-danger-button is-delete" type="button" :disabled="banAction !== null" @click="deleteAdminEntry(ban)"><Trash2 :size="12" /> Удалить</button>
            </div></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="!adminBansError" class="admin-placeholder"><Ban :size="20" /><strong>{{ adminBanSearch ? 'Ничего не найдено' : 'Банов пока нет' }}</strong><span>{{ adminBanSearch ? 'Измени поисковый запрос или фильтр.' : 'Для отображения банов подключи SourceBans хотя бы на одном сервере.' }}</span></div>
    <div v-if="adminBanLastPage > 1 && !adminBansLoading" class="donut-pagination">
      <button class="friend-action" type="button" :disabled="adminBanPage <= 1" aria-label="Предыдущая страница" @click="changeAdminBanPage(adminBanPage - 1)"><ChevronLeft :size="16" /></button>
      <span>{{ adminBanPage }} / {{ adminBanLastPage }}</span>
      <button class="friend-action" type="button" :disabled="adminBanPage >= adminBanLastPage" aria-label="Следующая страница" @click="changeAdminBanPage(adminBanPage + 1)"><ChevronRight :size="16" /></button>
    </div>
  </section>

  <section v-else-if="section !== 'overview'" :key="section" class="admin-content" :aria-label="sectionLabels[section]">
    <div class="section-heading">
      <div><div class="section-kicker">{{ websiteSettings.name.toUpperCase() }} / ADMIN</div><h2>{{ sectionLabels[section] }}</h2></div>
    </div>
    <div class="admin-placeholder">
      <component :is="sectionIcons[section]" :size="20" />
      <strong>{{ sectionDescriptions[section] ?? 'Раздел готов к подключению данных.' }}</strong>
    </div>
  </section>
  </Transition>

  <Teleport to="body">
    <Transition name="admin-drawer">
      <div v-if="selectedUser" class="modal-backdrop admin-drawer-backdrop" @click.self="closeUserSettings">
        <form ref="userDrawer" class="info-dialog admin-user-dialog admin-user-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-user-dialog-title" @submit.prevent="saveUser" @keydown="drawerKeydown">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="userAction !== null" @click="closeUserSettings"><X :size="18" /></button>
          <span class="dialog-mark"><Settings :size="19" /></span>
          <div class="section-kicker">ACCOUNTS / ADMIN</div>
          <h2 id="admin-user-dialog-title">Настройки пользователя</h2>
          <p class="admin-user-subtitle">{{ selectedUser.nickname }}</p>

          <div class="admin-user-fields">
            <label class="auth-field">
              <span>Никнейм</span>
              <input v-model.trim="userForm.nickname" class="auth-input" type="text" minlength="2" maxlength="32" pattern="[\p{L}\p{N}_!?#@]+" v-tooltip="'Только буквы, цифры и символы _ ! ? # @. Без пробелов и ссылок.'" required autocomplete="off" />
            </label>
            <label class="auth-field">
              <span>Email</span>
              <input v-model.trim="userForm.email" class="auth-input" type="email" maxlength="254" required autocomplete="off" />
            </label>
            <label class="auth-field">
              <span>Steam ID</span>
              <input v-model.trim="userForm.steamId" class="auth-input" type="text" maxlength="32" autocomplete="off" placeholder="76561198000000000 или STEAM_0:1:12345678" />
            </label>
            <label class="auth-field">
              <span>Админ-роль</span>
              <select v-model="userForm.adminRole" class="auth-input">
                <option :value="null">Не назначен</option>
                <option v-for="role in assignableRoles" :key="role.value" :value="role.value">{{ role.label }}</option>
              </select>
            </label>
            <div class="admin-user-current-status">
              <span>Доступ к сайту</span>
              <strong :class="{ 'is-blocked': userForm.isBlocked }">{{ userForm.isBlocked ? 'Заблокирован' : 'Разрешён' }}</strong>
            </div>
          </div>


          <div class="admin-user-edit-actions">
            <button class="dialog-secondary" type="button" :disabled="userAction !== null" @click="assignUserRole">{{ userAction === 'role' ? 'Сохраняем…' : 'Выдать роль' }}</button>
            <button class="dialog-primary" type="submit" :disabled="userAction !== null">{{ userAction === 'save' ? 'Сохраняем…' : 'Сохранить' }}</button>
          </div>

          <section class="admin-user-action-panel" aria-label="Безопасность аккаунта">
            <div class="admin-user-action-heading"><KeyRound :size="14" /><strong>Пароль</strong></div>
            <button v-if="!passwordEditorOpen" class="dialog-secondary admin-user-action-button" type="button" :disabled="userAction !== null" @click="passwordEditorOpen = true">Изменить пароль</button>
            <div v-else class="admin-user-password-fields">
              <label class="auth-field">
                <span>Новый пароль</span>
                <input v-model="passwordForm.password" class="auth-input" type="password" minlength="8" autocomplete="new-password" @keydown.enter.prevent="changeUserPassword" />
              </label>
              <label class="auth-field">
                <span>Повторите пароль</span>
                <input v-model="passwordForm.confirmation" class="auth-input" type="password" minlength="8" autocomplete="new-password" @keydown.enter.prevent="changeUserPassword" />
              </label>
              <div class="admin-user-inline-actions">
                <button class="dialog-secondary" type="button" :disabled="userAction !== null" @click="cancelPasswordChange">Отмена</button>
                <button class="dialog-primary" type="button" :disabled="userAction !== null" @click="changeUserPassword">{{ userAction === 'password' ? 'Сохраняем…' : 'Сохранить пароль' }}</button>
              </div>
            </div>
          </section>

          <section class="admin-user-action-panel" aria-label="Изображения профиля">
            <div class="admin-user-action-heading"><Image :size="14" /><strong>Изображения профиля</strong></div>
            <div class="admin-user-media-actions">
              <button class="admin-danger-button" type="button" :disabled="userAction !== null || !selectedUser.avatarUrl" @click="confirmation = 'avatar'"><Trash2 :size="13" /> Удалить аватар профиля</button>
              <button class="admin-danger-button" type="button" :disabled="userAction !== null || !selectedUser.coverUrl" @click="confirmation = 'cover'"><Trash2 :size="13" /> Удалить шапку профиля</button>
            </div>
          </section>



          <div class="admin-user-danger-actions">
            <button class="admin-danger-button" type="button" :disabled="userAction !== null" @click="confirmation = userForm.isBlocked ? 'unblock' : 'block'">
              <Ban :size="14" /> {{ userForm.isBlocked ? 'Разблокировать' : 'Заблокировать' }}
            </button>
            <button class="admin-danger-button is-delete" type="button" :disabled="userAction !== null" @click="confirmation = 'delete'"><Trash2 :size="14" /> Удалить</button>
          </div>

          <div v-if="confirmation" class="admin-user-confirmation" role="group" aria-label="Подтверждение действия">
            <p>{{ confirmation === 'delete' ? `Удалить аккаунт ${selectedUser.nickname}? Это действие нельзя отменить.` : confirmation === 'avatar' ? `Удалить аватар профиля ${selectedUser.nickname}?` : confirmation === 'cover' ? `Удалить шапку профиля ${selectedUser.nickname}?` : confirmation === 'block' ? `Заблокировать ${selectedUser.nickname}? Он не сможет войти на сайт.` : `Разблокировать ${selectedUser.nickname}?` }}</p>
            <div>
              <button class="dialog-secondary" type="button" :disabled="userAction !== null" @click="confirmation = null">Отмена</button>
              <button class="admin-danger-button is-confirm" type="button" :disabled="userAction !== null" @click="confirmUserAction">{{ userAction ? 'Выполняем…' : 'Подтвердить' }}</button>
            </div>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="modal">
      <div v-if="serverDialog" class="modal-backdrop" @click.self="closeServerDialog()">
        <form v-if="serverDialog === 'server'" class="info-dialog admin-server-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-server-dialog-title" @submit.prevent="saveServerForm">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="serverAction" @click="closeServerDialog()"><X :size="18" /></button>
          <span class="dialog-mark"><Gamepad2 :size="19" /></span>
          <div class="section-kicker">{{ websiteSettings.name.toUpperCase() }} / SERVER</div>
          <h2 id="admin-server-dialog-title">{{ activeServer ? 'Изменить сервер' : 'Добавить сервер' }}</h2>
          <div class="admin-server-form-fields">
            <label class="auth-field"><span>Название <small>необязательно</small></span><input v-model.trim="serverForm.name" class="auth-input" type="text" maxlength="100" autocomplete="off" /></label>
            <div class="admin-server-form-row">
              <label class="auth-field"><span>IP сервера</span><input v-model.trim="serverForm.ip" class="auth-input" type="text" required maxlength="45" autocomplete="off" placeholder="203.0.113.10" /></label>
              <label class="auth-field"><span>Порт</span><input v-model="serverForm.port" class="auth-input" type="number" min="1" max="65535" required /></label>
            </div>
            <label class="auth-field"><span>RCON-пароль <small>{{ activeServer ? 'пустое поле оставит текущий' : 'обязательно' }}</small></span><input v-model="serverForm.rconPassword" class="auth-input" type="password" :required="!activeServer" maxlength="255" autocomplete="new-password" /></label>
          </div>

          <div class="admin-server-dialog-actions">
            <button class="dialog-secondary" type="button" :disabled="serverAction" @click="closeServerDialog()">Отмена</button>
            <button class="dialog-primary" type="submit" :disabled="serverAction">{{ serverAction ? 'Сохраняем…' : 'Сохранить' }}</button>
          </div>
        </form>

        <form v-else-if="serverDialog === 'integration'" class="info-dialog admin-server-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-integration-dialog-title" @submit.prevent="saveIntegrationForm">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="serverAction" @click="closeServerDialog()"><X :size="18" /></button>
          <span class="dialog-mark"><Database :size="19" /></span>
          <div class="section-kicker">{{ integrationType === 'sourcebans' ? 'SOURCEBANS' : 'LEVELS RANKS' }} / DATABASE</div>
          <h2 id="admin-integration-dialog-title">{{ integrationType === 'sourcebans' ? 'Подключить SourceBans' : 'Подключить LVL' }}</h2>
          <p class="admin-server-dialog-subtitle">{{ activeServer?.name || activeServer?.ip }}:{{ activeServer?.port }}</p>
          <div class="admin-server-form-fields">
            <div class="admin-server-form-row">
              <label class="auth-field"><span>Хост базы данных</span><input v-model.trim="integrationForm.host" class="auth-input" type="text" required maxlength="255" autocomplete="off" /></label>
              <label class="auth-field"><span>Порт</span><input v-model="integrationForm.port" class="auth-input" type="number" min="1" max="65535" required /></label>
            </div>
            <label class="auth-field"><span>База данных</span><input v-model.trim="integrationForm.database" class="auth-input" type="text" required maxlength="128" autocomplete="off" /></label>
            <div class="admin-server-form-row">
              <label class="auth-field"><span>Пользователь БД</span><input v-model.trim="integrationForm.username" class="auth-input" type="text" required maxlength="128" autocomplete="off" /></label>
              <label class="auth-field"><span>Пароль БД <small>{{ activeIntegrationSettings ? 'пустое поле оставит текущий' : '' }}</small></span><input v-model="integrationForm.password" class="auth-input" type="password" :required="!activeIntegrationSettings" maxlength="255" autocomplete="new-password" /></label>
            </div>
            <label class="auth-field"><span>Таблица</span><input v-model.trim="integrationForm.table" class="auth-input" type="text" required maxlength="64" autocomplete="off" placeholder="Например, sb_bans" /></label>
            <div class="admin-server-column-grid">
              <label v-for="field in integrationColumnFields" :key="field.key" class="auth-field"><span>{{ field.label }}</span><input v-model.trim="integrationForm[field.key]" class="auth-input" type="text" required maxlength="64" autocomplete="off" /></label>
            </div>
          </div>


          <div class="admin-server-dialog-actions">
            <button v-if="activeIntegrationSettings" class="admin-danger-button is-delete" type="button" :disabled="serverAction" @click="disconnectIntegration">{{ serverAction ? 'Отключаем…' : 'Отключить' }}</button>
            <button class="dialog-secondary" type="button" :disabled="serverAction" @click="closeServerDialog()">Закрыть</button>
            <button class="dialog-primary" type="submit" :disabled="serverAction">{{ serverAction ? 'Проверяем…' : 'Сохранить и проверить' }}</button>
          </div>
        </form>

        <div v-else-if="serverDialog === 'donutmatch'" class="info-dialog admin-server-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-donut-title">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="serverAction" @click="closeServerDialog()"><X :size="18" /></button>
          <span class="dialog-mark"><Link2 :size="19" /></span>
          <div class="section-kicker">{{ websiteSettings.name.toUpperCase() }} / DONUTMATCH</div>
          <h2 id="admin-donut-title">DonutMatch</h2>
          <p class="admin-server-dialog-subtitle">Настройте web-модуль на игровом сервере. Матчи сохраняются после подключения.</p>
          <div v-if="activeServer" class="admin-server-form-fields">
            <label class="auth-field"><span>sm_donutmatch_web_url</span><input class="auth-input" readonly :value="`${siteOrigin}/api/v1/donutmatch/servers/${activeServer.id}/events`" @focus="($event.target as HTMLInputElement).select()" /></label>
            <label class="auth-field"><span>sm_donutmatch_web_server_id</span><input class="auth-input" readonly :value="`matchstrike-${activeServer.id}`" @focus="($event.target as HTMLInputElement).select()" /></label>
            <label v-if="donutToken" class="auth-field"><span>sm_donutmatch_web_token — сохраните сейчас, повторно не показывается</span><input class="auth-input" readonly :value="donutToken" @focus="($event.target as HTMLInputElement).select()" /></label>
            <p v-else class="admin-server-dialog-subtitle">{{ activeServer.donutmatchConnected ? 'Ключ уже создан. При смене потребуется обновить конфигурацию плагина.' : 'Создайте ключ и добавьте его в конфигурацию плагина.' }}</p>
            <p v-if="activeServer.donutmatchLastSeenAt" class="admin-server-dialog-subtitle">Последние данные: {{ formatDate(activeServer.donutmatchLastSeenAt) }}</p>
          </div>

          <div class="admin-server-dialog-actions">
            <button v-if="activeServer?.donutmatchConnected" class="dialog-secondary" type="button" :disabled="serverAction" @click="configureDonutMatch(true)">Отключить</button>
            <button class="dialog-primary" type="button" :disabled="serverAction" @click="configureDonutMatch()">{{ serverAction ? 'Сохраняем…' : activeServer?.donutmatchConnected ? 'Сменить ключ' : 'Создать ключ' }}</button>
          </div>
        </div>

        <form v-else class="info-dialog admin-server-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-rcon-dialog-title" @submit.prevent="runRcon">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="serverAction" @click="closeServerDialog()"><X :size="18" /></button>
          <span class="dialog-mark"><Terminal :size="19" /></span>
          <div class="section-kicker">REMOTE CONSOLE / RCON</div>
          <h2 id="admin-rcon-dialog-title">Выполнить RCON</h2>
          <p class="admin-server-dialog-subtitle">{{ activeServer?.name || activeServer?.ip }}:{{ activeServer?.port }}</p>
          <label class="auth-field admin-rcon-field"><span>Команда</span><input v-model.trim="rconCommand" class="auth-input" type="text" required maxlength="256" pattern="[^;\r\n]+" autocomplete="off" placeholder="status" /></label>

          <pre v-if="rconOutput" class="admin-rcon-output">{{ rconOutput }}</pre>
          <div class="admin-server-dialog-actions">
            <button class="dialog-secondary" type="button" :disabled="serverAction" @click="closeServerDialog()">Закрыть</button>
            <button class="dialog-primary" type="submit" :disabled="serverAction">{{ serverAction ? 'Выполняем…' : 'Выполнить' }}</button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="selectedBan" class="modal-backdrop" @click.self="closeBanDialog()">
        <form class="info-dialog admin-server-dialog admin-ban-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-ban-dialog-title" @submit.prevent="saveAdminBan">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="banAction !== null" @click="closeBanDialog()"><X :size="18" /></button>
          <span class="dialog-mark"><Ban :size="19" /></span>
          <div class="section-kicker">SOURCEBANS / BAN #{{ selectedBan.id }}</div>
          <h2 id="admin-ban-dialog-title">Редактирование бана</h2>
          <p class="admin-server-dialog-subtitle">{{ selectedBan.serverName }}</p>
          <div class="admin-server-form-fields">
            <label class="auth-field"><span>Никнейм игрока</span><input v-model.trim="banForm.player" class="auth-input" type="text" maxlength="128" required /></label>
            <label class="auth-field"><span>Steam ID / auth</span><input v-model.trim="banForm.authId" class="auth-input" type="text" maxlength="64" required /></label>
            <label class="auth-field"><span>IP-адрес</span><input v-model.trim="banForm.ip" class="auth-input" type="text" maxlength="32" /></label>
            <label class="auth-field"><span>Причина бана</span><textarea v-model.trim="banForm.reason" class="auth-input admin-ban-reason-input" rows="3" maxlength="1000" required /></label>
            <label class="admin-ban-permanent"><input v-model="banForm.permanent" type="checkbox" /> <span>Постоянный бан</span></label>
            <label v-if="!banForm.permanent" class="auth-field"><span>Дата окончания</span><input v-model="banForm.endsAt" class="auth-input" type="datetime-local" required /></label>
          </div>

          <div class="admin-server-dialog-actions">
            <button class="dialog-secondary" type="button" :disabled="banAction !== null" @click="closeBanDialog()">Отмена</button>
            <button class="dialog-primary" type="submit" :disabled="banAction !== null">{{ banAction === 'save' ? 'Сохраняем…' : 'Сохранить изменения' }}</button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>


  </div>
</template>

<style scoped>
.server-lobby-switch { text-align:left; }
.server-lobby-maps { margin-top:17px; padding:17px; border-radius:11px; background:var(--line-soft); }
.server-lobby-maps header { display:flex; flex-wrap:wrap; gap:8px 16px; align-items:center; justify-content:space-between; margin-bottom:13px; }
.server-lobby-maps header strong { font-size:12px; }.server-lobby-maps header>span,.server-lobby-maps p { color:var(--muted); font-size:10px; line-height:1.8; }.server-lobby-maps p { margin:10px 0 0; }
.server-lobby-map-tags { display:flex; flex-wrap:wrap; gap:7px; }.server-lobby-map-tags>span { display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:7px; background:var(--panel); color:var(--text); }.server-lobby-map-tags code { font:inherit; font-size:10px; overflow-wrap:anywhere; }.server-lobby-map-tags small { display:grid; place-items:center; width:14px; height:14px; border-radius:50%; background:var(--surface-tint); color:var(--yellow); font-weight:700; }.server-lobby-map-tags button { display:flex; align-items:center; justify-content:center; border:0; padding:2px; background:none; color:var(--subtle); cursor:pointer; }.server-lobby-map-tags button:hover { color:var(--text); }.server-lobby-map-tags .is-unavailable code { color:var(--muted); }
.server-lobby-maps form { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }.server-lobby-maps input { flex:1; min-width:150px; padding:9px 11px; border:1px solid var(--line); border-radius:8px; color:var(--text); background:var(--panel); font:inherit; font-size:11px; }
.server-lobby-track { display:inline-flex; align-items:center; width:29px; height:17px; flex-shrink:0; padding:3px; border-radius:12px; background:var(--line); transition:background .15s; }
.server-lobby-track i { display:block; width:11px; height:11px; border-radius:50%; background:var(--muted); transition:transform .15s; }
.server-lobby-switch[aria-checked=true] .server-lobby-track { background:var(--yellow); }
.server-lobby-switch[aria-checked=true] .server-lobby-track i { transform:translateX(12px); background:var(--bg); }
@media(prefers-reduced-motion:reduce) { .server-lobby-track,.server-lobby-track i { transition:none; } }
</style>
