const apiBaseUrl = '/api/v1'

export type AdminRole = 'moderator' | 'administrator' | 'high_administrator' | 'developer'
export type StatisticsSource = 'own' | 'third_party'
export type TicketCategory = 'general' | 'account_block' | 'server_ban' | 'technical' | 'other' | 'player_report'

export interface TicketMessage {
  id: number
  authorName: string
  avatarUrl: string | null
  isAdmin: boolean
  eventType: 'status_opened' | 'status_closed' | 'status_auto_closed' | null
  body: string
  createdAt: string
}

export interface Ticket {
  id: number
  subject: string
  category: TicketCategory | null
  status: 'open' | 'closed'
  unread: boolean
  nickname: string
  lastMessage: TicketMessage | null
}

export interface TicketConversation {
  ticket: Ticket
  messages: TicketMessage[]
}

export interface ApiHealth {
  status: 'ok'
  service: string
}

export interface PublicGameServer {
  id: number
  name: string
  map: string | null
  mode: string
  playersOnline: number | null
  playerLimit: number | null
  address: string
}

export interface StatsPlayer {
  id: number
  nickname: string
  avatarUrl: string | null
  profileNickname: string | null
  rank: number | null
  kills: number
  deaths: number
  kdr: number
  points: number
}

export interface StatsPlayersPage {
  source: StatisticsSource
  updatedAt: string | null
  players: StatsPlayer[]
  pagination: {
    currentPage: number
    lastPage: number
    total: number
    perPage: number
  }
}

export interface AuthUser {
  id: number
  email: string
  nickname: string
  steamId: string | null
  twoFactorEnabled: boolean
  adminRole: AdminRole | null
  avatarUrl: string | null
  coverUrl: string | null
  socialLinks: SocialLinks
}

export interface AdminOverviewStats {
  last24Hours: number
  last7Days: number
  lastMonth: number
  total: number
}

export interface AdminUserSummary {
  id: number
  nickname: string
  email: string
  steamId: string | null
  adminRole: AdminRole | null
  adminRoleLabel: string | null
  isBlocked: boolean
  avatarUrl: string | null
  coverUrl: string | null
  createdAt: string | null
  lastSeenAt: string | null
}

export interface AdminGameServer {
  id: number
  name: string | null
  ip: string
  port: number
  query: {
    hostName: string | null
    map: string | null
    players: number | null
    maxPlayers: number | null
    version: string | null
  }
  queryCheckedAt: string | null
  sourcebansConnected: boolean
  levelsConnected: boolean
  donutmatchConnected: boolean
  donutmatchLastSeenAt: string | null
  sourcebansSettings: AdminServerIntegrationSettings | null
  levelsSettings: AdminServerIntegrationSettings | null
}

export type AdminServerIntegration = 'sourcebans' | 'levels'

export interface AdminServerDatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  table: string
  playerColumn: string
  authColumn: string
  reasonColumn?: string
  createdColumn?: string
  endsColumn?: string
  killsColumn?: string
  deathsColumn?: string
  pointsColumn?: string
  rankColumn?: string
}

export interface AdminServerIntegrationSettings {
  host: string
  port: number
  database: string
  username: string
  table: string
  columns: Record<string, string>
}

export type AdminIntegrationRecord = Record<string, string | number | null>

export interface GameMatch {
  id: number
  serverNumber: number
  serverName: string | null
  mode: 'War' | 'Mix'
  format: 'Classic' | 'BO1' | 'BO3' | 'BO5' | null
  status: 'live' | 'finished' | 'preparing' | 'cancelled'
  map: string
  teamA: { name?: string | null; score: number | null }
  teamB: { name?: string | null; score: number | null }
  scoreType: 'maps' | 'rounds'
  roundTeams: [{ name?: string | null; score: number }, { name?: string | null; score: number }]
  updatedAt: string
  durationSeconds?: number | null
  playerSide?: 'ct' | 't' | null
  playerResult?: 'win' | 'loss' | 'draw' | null
}

export interface PlayerMatchesPage {
  matches: GameMatch[]
  pagination: { currentPage: number; lastPage: number; total: number; perPage: number }
}

export interface GameMatchesPage {
  connected: boolean
  hasMatches: boolean
  matches: GameMatch[]
  finishedMatches: number
  pagination: { currentPage: number; lastPage: number; total: number }
}

export type BanStatusFilter = 'all' | 'active' | 'expired'

export interface SourceBan {
  id: number
  serverId: number
  serverName: string
  player: string
  authId: string
  reason: string
  createdAt: string | null
  endsAt: string | null
  length: number
  permanent: boolean
  status: 'active' | 'expired'
  account: {
    id: number
    nickname: string
    avatarUrl: string | null
    profileUrl: string
  } | null
}

export interface SourceBansPage {
  connected: boolean
  bans: SourceBan[]
  counts: Record<BanStatusFilter, number>
  pagination: { currentPage: number; lastPage: number; total: number; perPage: number }
}

export type AdminBanStatusFilter = 'all' | 'active' | 'expired' | 'unbanned' | 'deleted'

export interface AdminSourceBan extends Omit<SourceBan, 'status' | 'account'> {
  ip: string
  status: 'active' | 'expired' | 'unbanned' | 'deleted'
  unbanReason: string | null
}

export interface AdminSourceBansPage {
  connected: boolean
  bans: AdminSourceBan[]
  counts: Record<AdminBanStatusFilter, number>
  pagination: { currentPage: number; lastPage: number; total: number; perPage: number }
}

export interface MatchPlayer {
  name: string
  kills: number | null
  deaths: number | null
  account: {
    id: number
    nickname: string
    avatarUrl: string | null
    profileUrl: string
  } | null
}

export interface GameMatchDetails extends GameMatch {
  round: number | null
  endReason: string | null
  playersRetained: boolean
  playersCt: MatchPlayer[]
  playersT: MatchPlayer[]
  seriesMaps: string[]
  seriesMapIndex: number | null
  seriesResults: {
    mapIndex: number
    map: string
    teamAScore: number
    teamBScore: number
    winner: 'team_a' | 'team_b' | 'draw'
  }[]
  seriesPlayerStats: {
    mapIndex: number
    map: string
    teamCt: { name?: string | null; score: number }
    teamT: { name?: string | null; score: number }
    playersCt: MatchPlayer[]
    playersT: MatchPlayer[]
  }[]
  veto: {
    active: boolean
    step: number
    stepCount: number
    action: 'ban' | 'pick' | null
    team: string | null
    lastMap: string | null
    automatic: boolean
    availableMaps: string[]
    bannedMaps: string[]
    pickedMaps: string[]
    history: { step: number; action: 'ban' | 'pick'; map: string; team: string | null; captain: string | null; automatic: boolean }[]
  } | null
  realtime: { key: string; host: string; port: number; secure: boolean; path: string } | null
}

export interface PlayerMatch {
  id: string
  map: string
  mode: string
  playedAt: string
  winner: string
  score: string
}

export interface ProfileStats {
  kills: number
  deaths: number
  points: number
  kdr: number
  servers: ProfileServerStats[]
}

export interface ProfileServerStats {
  serverId: number
  serverName: string
  rank: number | null
  kills: number
  deaths: number
  points: number
}

export interface MapWinRate {
  map: string
  matches: number
  wins: number
  winRate: number
}

export interface PlayerProfile {
  id: number
  nickname: string
  avatarUrl: string | null
  coverUrl: string | null
  socialLinks: Partial<Record<SocialPlatform, string>>
  isBlocked: boolean
  joinedAt: string | null
  isOwn: boolean
  isAuthenticated: boolean
  friendshipStatus: 'pending' | 'incoming' | 'accepted' | null
  stats: ProfileStats | null
  friends: FriendSummary[]
  recentMatches: GameMatch[]
  mapWinRates: MapWinRate[]
}

export type SocialPlatform = 'telegram' | 'instagram' | 'youtube' | 'twitch' | 'trovo' | 'boosty'
export type SocialLinks = Partial<Record<SocialPlatform, string>>

export interface FriendSummary {
  id: number
  nickname: string
  avatarUrl: string | null
  lastSeenAt: string | null
}

export interface IncomingFriendRequest {
  id: number
  userId: number
  nickname: string
  avatarUrl: string | null
  sentAt: string | null
}

export interface AppNotification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  data: Record<string, unknown>
  isRead: boolean
  createdAt: string | null
}

export type NotificationCategory = 'system' | 'friend_request' | 'friend_acceptance' | 'team_invitation' | 'ticket'
export type NotificationPreferences = Record<'enabled' | NotificationCategory, boolean>
export interface NotificationSettings {
  preferences: NotificationPreferences
  pushSupported: boolean
  pushConfigured: boolean
  pushPublicKey: string | null
  subscriptionCount: number
}

export interface AdminBroadcastResult {
  status: 'sent'
  sender: string
  totalUsers: number
  sent: number
  skippedByPreferences: number
  offlineWithPushSubscription: number
  failed: number
}

export interface FriendRequestResult {
  status: 'pending' | 'incoming' | 'accepted'
  alreadySent?: boolean
}

export interface RegisterPayload {
  email: string
  nickname: string
  password: string
  password_confirmation: string
  privacy_accepted: boolean
}

export interface LoginPayload {
  email: string
  password: string
  two_factor_code?: string
}

export interface LoginResponse {
  user?: AuthUser
  requiresTwoFactor?: boolean
}

export interface AccountSession {
  id: number
  device: string
  deviceType: 'mobile' | 'tablet' | 'desktop'
  ipAddress: string | null
  lastActivity: string | null
  isCurrent: boolean
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: Record<string, string[]> = {},
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

interface AuthResponse {
  user: AuthUser
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as {
    message?: string
    errors?: Record<string, string[]>
  }

  if (!response.ok) {
    throw new ApiRequestError(
      data.message ?? 'Не удалось выполнить запрос.',
      response.status,
      data.errors ?? {},
    )
  }

  return data as T
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/auth/csrf`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ csrfToken: string }>(response)

  return data.csrfToken
}

async function mutateJson<T>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', payload?: unknown): Promise<T> {
  const csrfToken = await getCsrfToken()
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrfToken,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })

  return readJson<T>(response)
}

async function postJson<T>(url: string, payload: unknown = {}): Promise<T> {
  return mutateJson<T>(url, 'POST', payload)
}

async function postAuth<T>(endpoint: string, payload: unknown = {}): Promise<T> {
  return postJson<T>(`${apiBaseUrl}/auth/${endpoint}`, payload)
}

function ticketsUrl(admin: boolean): string {
  return `${apiBaseUrl}/${admin ? 'admin' : 'me'}/tickets`
}

export async function getTickets(admin: boolean): Promise<Ticket[]> {
  const response = await fetch(ticketsUrl(admin), { credentials: 'include', headers: { Accept: 'application/json' } })
  return (await readJson<{ tickets: Ticket[] }>(response)).tickets
}

export async function getTicket(admin: boolean, id: number): Promise<TicketConversation> {
  const response = await fetch(`${ticketsUrl(admin)}/${id}`, { credentials: 'include', headers: { Accept: 'application/json' } })
  return readJson<TicketConversation>(response)
}

export async function markTicketRead(admin: boolean, id: number, lastMessageId: number): Promise<void> {
  await postJson(`${ticketsUrl(admin)}/${id}/read`, { lastMessageId })
}

export function createTicket(subject: string, category: TicketCategory, body: string): Promise<TicketConversation> {
  return postJson<TicketConversation>(ticketsUrl(false), { subject, category, body })
}

export function replyToTicket(admin: boolean, id: number, body: string): Promise<TicketConversation> {
  return postJson<TicketConversation>(`${ticketsUrl(admin)}/${id}/messages`, { body })
}

export function setTicketStatus(id: number, status: Ticket['status']): Promise<TicketConversation> {
  return mutateJson<TicketConversation>(`${ticketsUrl(true)}/${id}/status`, 'PATCH', { status })
}

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await fetch(`${apiBaseUrl}/health`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`)
  }

  return response.json() as Promise<ApiHealth>
}

export async function registerAccount(payload: RegisterPayload): Promise<AuthUser> {
  const response = await postAuth<AuthResponse>('register', payload)
  return response.user
}

export async function loginAccount(payload: LoginPayload): Promise<LoginResponse> {
  return postAuth<LoginResponse>('login', payload)
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (response.status === 401) return null

  const data = await readJson<AuthResponse>(response)
  return data.user
}

export async function getAdminOverview(): Promise<AdminOverviewStats> {
  const response = await fetch(`${apiBaseUrl}/admin/overview`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ stats: AdminOverviewStats }>(response)
  return data.stats
}

export async function getAdminUsers(
  search = '',
  role: AdminRole | 'none' | '' = '',
): Promise<AdminUserSummary[]> {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (role) params.set('role', role)
  const query = params.size > 0 ? `?${params.toString()}` : ''
  const response = await fetch(`${apiBaseUrl}/admin/users${query}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ users: AdminUserSummary[] }>(response)
  return data.users
}

export async function getAdminServers(): Promise<AdminGameServer[]> {
  const response = await fetch(`${apiBaseUrl}/admin/servers`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ servers: AdminGameServer[] }>(response)
  return data.servers
}

export async function saveAdminServer(
  payload: { name: string; ip: string; port: number; rconPassword: string },
  serverId?: number,
): Promise<AdminGameServer> {
  const url = serverId ? `${apiBaseUrl}/admin/servers/${serverId}` : `${apiBaseUrl}/admin/servers`
  const data = await mutateJson<{ server: AdminGameServer }>(url, serverId ? 'PATCH' : 'POST', payload)
  return data.server
}

export async function deleteAdminServer(serverId: number): Promise<void> {
  await mutateJson<{ status: string }>(`${apiBaseUrl}/admin/servers/${serverId}`, 'DELETE')
}

export async function connectDonutMatch(serverId: number): Promise<string> {
  const data = await mutateJson<{ token: string }>(`${apiBaseUrl}/admin/servers/${serverId}/donutmatch`, 'POST')
  return data.token
}

export async function disconnectDonutMatch(serverId: number): Promise<void> {
  await mutateJson<{ status: string }>(`${apiBaseUrl}/admin/servers/${serverId}/donutmatch`, 'DELETE')
}

export async function getGameMatches(mode: 'War' | 'Mix' | null, page = 1): Promise<GameMatchesPage> {
  const params = new URLSearchParams({ page: String(page) })
  if (mode) params.set('mode', mode)
  return readJson<GameMatchesPage>(await fetch(`${apiBaseUrl}/matches?${params}`, { headers: { Accept: 'application/json' } }))
}

export async function getGameMatch(id: string): Promise<GameMatchDetails> {
  const data = await readJson<{ match: GameMatchDetails }>(await fetch(`${apiBaseUrl}/matches/${encodeURIComponent(id)}`, { cache: 'no-store', headers: { Accept: 'application/json' } }))
  return data.match
}

export async function getBans(page = 1, search = '', status: BanStatusFilter = 'all'): Promise<SourceBansPage> {
  const params = new URLSearchParams({ page: String(page), status })
  if (search.trim()) params.set('search', search.trim())
  const response = await fetch(`${apiBaseUrl}/bans?${params}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  return readJson<SourceBansPage>(response)
}

export async function getAdminBans(page = 1, search = '', status: AdminBanStatusFilter = 'all'): Promise<AdminSourceBansPage> {
  const params = new URLSearchParams({ page: String(page), status })
  if (search.trim()) params.set('search', search.trim())
  const response = await fetch(`${apiBaseUrl}/admin/bans?${params}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  return readJson<AdminSourceBansPage>(response)
}

export async function updateAdminBan(
  serverId: number,
  banId: number,
  payload: { player: string; authId: string; ip: string; reason: string; permanent: boolean; endsAt: number | null },
): Promise<void> {
  await mutateJson<{ status: string }>(`${apiBaseUrl}/admin/servers/${serverId}/bans/${banId}`, 'PUT', payload)
}

export async function unbanAdminBan(serverId: number, banId: number, reason = ''): Promise<void> {
  await postJson<{ status: string }>(`${apiBaseUrl}/admin/servers/${serverId}/bans/${banId}/unban`, { reason })
}

export async function deleteAdminBan(serverId: number, banId: number): Promise<void> {
  await mutateJson<{ status: string }>(`${apiBaseUrl}/admin/servers/${serverId}/bans/${banId}`, 'DELETE')
}

export async function saveAdminServerIntegration(
  serverId: number,
  integration: AdminServerIntegration,
  config: AdminServerDatabaseConfig,
): Promise<AdminGameServer> {
  const data = await mutateJson<{ server: AdminGameServer }>(
    `${apiBaseUrl}/admin/servers/${serverId}/integrations/${integration}`,
    'PUT',
    config,
  )
  return data.server
}

export async function disconnectAdminServerIntegration(
  serverId: number,
  integration: AdminServerIntegration,
): Promise<AdminGameServer> {
  const data = await mutateJson<{ server: AdminGameServer }>(
    `${apiBaseUrl}/admin/servers/${serverId}/integrations/${integration}`,
    'DELETE',
  )
  return data.server
}

export async function getAdminServerIntegrationData(
  serverId: number,
  integration: AdminServerIntegration,
): Promise<AdminIntegrationRecord[]> {
  const response = await fetch(`${apiBaseUrl}/admin/servers/${serverId}/integrations/${integration}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ records: AdminIntegrationRecord[] }>(response)
  return data.records
}

export async function refreshAdminServerQuery(serverId: number): Promise<AdminGameServer> {
  const data = await mutateJson<{ server: AdminGameServer }>(`${apiBaseUrl}/admin/servers/${serverId}/query`, 'POST')
  return data.server
}

export async function executeAdminServerRcon(serverId: number, command: string): Promise<string> {
  const data = await mutateJson<{ output: string }>(`${apiBaseUrl}/admin/servers/${serverId}/rcon`, 'POST', { command })
  return data.output
}

export async function updateAdminUser(
  userId: number,
  payload: { nickname: string; email: string; steamId: string | null },
): Promise<AdminUserSummary> {
  const data = await mutateJson<{ user: AdminUserSummary }>(`${apiBaseUrl}/admin/users/${userId}`, 'PATCH', payload)
  return data.user
}

export async function updateAdminUserRole(
  userId: number,
  adminRole: AdminRole | null,
): Promise<AdminUserSummary> {
  const data = await mutateJson<{ user: AdminUserSummary }>(`${apiBaseUrl}/admin/users/${userId}/role`, 'PATCH', { adminRole })
  return data.user
}

export async function updateAdminUserBlockStatus(
  userId: number,
  isBlocked: boolean,
): Promise<AdminUserSummary> {
  const data = await mutateJson<{ user: AdminUserSummary }>(`${apiBaseUrl}/admin/users/${userId}/block`, 'PATCH', { isBlocked })
  return data.user
}

export async function updateAdminUserPassword(
  userId: number,
  password: string,
  passwordConfirmation: string,
): Promise<void> {
  await mutateJson<{ status: string }>(`${apiBaseUrl}/admin/users/${userId}/password`, 'PATCH', {
    password,
    password_confirmation: passwordConfirmation,
  })
}

export async function deleteAdminUserMedia(
  userId: number,
  field: 'avatar' | 'cover',
): Promise<AdminUserSummary> {
  const data = await mutateJson<{ user: AdminUserSummary }>(`${apiBaseUrl}/admin/users/${userId}/media/${field}`, 'DELETE')
  return data.user
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await mutateJson<{ status: string }>(`${apiBaseUrl}/admin/users/${userId}`, 'DELETE')
}

export async function logoutAccount(): Promise<void> {
  await postAuth('logout')
}

export async function getPlayerMatches(nickname: string, page = 1): Promise<PlayerMatchesPage> {
  const params = new URLSearchParams({ page: String(page) })
  const response = await fetch(`${apiBaseUrl}/users/${encodeURIComponent(nickname)}/matches?${params}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  return readJson<PlayerMatchesPage>(response)
}

export async function getPlayerProfile(nickname: string): Promise<PlayerProfile> {
  const response = await fetch(`${apiBaseUrl}/users/${encodeURIComponent(nickname)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ profile: PlayerProfile }>(response)
  return data.profile
}

export async function getFriends(): Promise<FriendSummary[]> {
  const response = await fetch(`${apiBaseUrl}/me/friends`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ friends: FriendSummary[] }>(response)
  return data.friends
}

export async function getIncomingFriendRequests(): Promise<IncomingFriendRequest[]> {
  const response = await fetch(`${apiBaseUrl}/me/friend-requests`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ requests: IncomingFriendRequest[] }>(response)
  return data.requests
}

export function sendAdminBroadcastNotification(payload: {
  sender: string
  title: string
  message: string
  link: string
}): Promise<AdminBroadcastResult> {
  return postJson<AdminBroadcastResult>(`${apiBaseUrl}/admin/notifications`, payload)
}

export async function getAppNotifications(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const response = await fetch(`${apiBaseUrl}/me/notifications`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  return readJson<{ notifications: AppNotification[]; unreadCount: number }>(response)
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await fetch(`${apiBaseUrl}/me/notification-settings`, { credentials: 'include', headers: { Accept: 'application/json' } })
  return readJson<NotificationSettings>(response)
}

export async function updateNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
  const response = await mutateJson<{ preferences: NotificationPreferences }>(`${apiBaseUrl}/me/notification-settings`, 'PUT', { preferences })
  return response.preferences
}

export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  await postJson(`${apiBaseUrl}/me/push-subscriptions`, {
    endpoint: json.endpoint,
    keys: json.keys,
    contentEncoding: PushManager.supportedContentEncodings?.[0] ?? 'aes128gcm',
  })
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await mutateJson(`${apiBaseUrl}/me/push-subscriptions`, 'DELETE', { endpoint })
}

export async function markAppNotificationRead(notificationId: number): Promise<void> {
  await postJson(`${apiBaseUrl}/me/notifications/${notificationId}/read`)
}

export async function markAllAppNotificationsRead(): Promise<void> {
  await postJson(`${apiBaseUrl}/me/notifications/read-all`)
}

export async function clearAppNotifications(): Promise<void> {
  await mutateJson(`${apiBaseUrl}/me/notifications`, 'DELETE')
}

export async function acceptFriendRequest(requestId: number): Promise<void> {
  await postJson(`${apiBaseUrl}/me/friend-requests/${requestId}/accept`)
}

export async function rejectFriendRequest(requestId: number): Promise<void> {
  const csrfToken = await getCsrfToken()
  const response = await fetch(`${apiBaseUrl}/me/friend-requests/${requestId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken },
  })
  await readJson<{ status: string }>(response)
}

export async function removeFriendFromList(nickname: string): Promise<void> {
  const csrfToken = await getCsrfToken()
  const response = await fetch(`${apiBaseUrl}/me/friends/${encodeURIComponent(nickname)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken },
  })
  await readJson<{ status: string }>(response)
}

export async function updateAccountSettings(payload: {
  nickname?: string
  email?: string
  current_password?: string
  two_factor_code?: string
}): Promise<AuthUser> {
  const data = await postJson<AuthResponse>(`${apiBaseUrl}/me/settings`, payload)
  return data.user
}

export async function changeAccountPassword(payload: {
  current_password: string
  password: string
  password_confirmation: string
  two_factor_code?: string
}): Promise<void> {
  await postJson(`${apiBaseUrl}/me/password`, payload)
}

export async function updateProfileMedia(files: { avatar?: File; cover?: File }): Promise<AuthUser> {
  const csrfToken = await getCsrfToken()
  const formData = new FormData()
  if (files.avatar) formData.append('avatar', files.avatar)
  if (files.cover) formData.append('cover', files.cover)

  const response = await fetch(`${apiBaseUrl}/me/profile-media`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken },
    body: formData,
  })
  const data = await readJson<AuthResponse>(response)
  return data.user
}

export async function deleteProfileMedia(field: 'avatar' | 'cover'): Promise<AuthUser> {
  const data = await mutateJson<AuthResponse>(`${apiBaseUrl}/me/profile-media/${field}`, 'DELETE')
  return data.user
}

export async function updateAccountSteamId(steamId: string | null): Promise<AuthUser> {
  const data = await mutateJson<AuthResponse>(`${apiBaseUrl}/me/steam-id`, 'PUT', { steamId })
  return data.user
}

export async function updateSocialLinks(socialLinks: Partial<Record<SocialPlatform, string | null>>): Promise<SocialLinks> {
  const data = await mutateJson<{ socialLinks: SocialLinks }>(`${apiBaseUrl}/me/social-links`, 'PUT', { socialLinks })
  return data.socialLinks
}

export async function getAccountSessions(): Promise<AccountSession[]> {
  const response = await fetch(`${apiBaseUrl}/me/sessions`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ sessions: AccountSession[] }>(response)
  return data.sessions
}

export async function revokeAccountSession(sessionId: number): Promise<void> {
  await mutateJson(`${apiBaseUrl}/me/sessions/${sessionId}`, 'DELETE')
}

export async function revokeOtherAccountSessions(): Promise<number> {
  const data = await mutateJson<{ status: string; revoked: number }>(`${apiBaseUrl}/me/sessions/others`, 'DELETE')
  return data.revoked
}

export async function setupGoogleAuthenticator(): Promise<{ secret: string; otpauthUri: string }> {
  return postJson(`${apiBaseUrl}/me/two-factor/setup`)
}

export async function confirmGoogleAuthenticator(code: string): Promise<void> {
  await postJson(`${apiBaseUrl}/me/two-factor/confirm`, { code })
}

export async function disableGoogleAuthenticator(code: string): Promise<void> {
  await mutateJson(`${apiBaseUrl}/me/two-factor`, 'DELETE', { code })
}

export async function sendFriendRequest(nickname: string): Promise<FriendRequestResult> {
  return postJson(`${apiBaseUrl}/users/${encodeURIComponent(nickname)}/friend-requests`)
}

export async function reportPlayer(
  nickname: string,
  payload: { reason: 'cheating' | 'abuse' | 'other'; details: string },
): Promise<{ status: 'received'; ticketId: number }> {
  return postJson(`${apiBaseUrl}/users/${encodeURIComponent(nickname)}/reports`, payload)
}

export async function getPublicServers(): Promise<PublicGameServer[]> {
  const response = await fetch(`${apiBaseUrl}/servers`, {
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ servers: PublicGameServer[] }>(response)
  return data.servers
}

export async function getStatsPlayers(page = 1, search = ''): Promise<StatsPlayersPage> {
  const params = new URLSearchParams({ page: String(page) })
  if (search.trim()) params.set('search', search.trim())
  const response = await fetch(`${apiBaseUrl}/stats/players?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  return readJson<StatsPlayersPage>(response)
}

export async function getAdminStatisticsSource(): Promise<StatisticsSource> {
  const response = await fetch(`${apiBaseUrl}/admin/statistics/source`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await readJson<{ source: StatisticsSource }>(response)
  return data.source
}

export async function updateAdminStatisticsSource(source: StatisticsSource): Promise<StatisticsSource> {
  const data = await mutateJson<{ source: StatisticsSource }>(`${apiBaseUrl}/admin/statistics/source`, 'PUT', { source })
  return data.source
}
