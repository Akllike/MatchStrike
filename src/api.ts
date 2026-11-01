const apiBaseUrl = '/api/v1'

export type AdminRole = 'moderator' | 'administrator' | 'high_administrator' | 'developer'
export type StatisticsSource = 'own' | 'third_party'

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
  recentMatches: PlayerMatch[]
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

export type NotificationCategory = 'system' | 'friend_request' | 'friend_acceptance' | 'team_invitation'
export type NotificationPreferences = Record<'enabled' | NotificationCategory, boolean>
export interface NotificationSettings {
  preferences: NotificationPreferences
  pushSupported: boolean
  pushConfigured: boolean
  pushPublicKey: string | null
  subscriptionCount: number
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
): Promise<void> {
  await postJson(`${apiBaseUrl}/users/${encodeURIComponent(nickname)}/reports`, payload)
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

