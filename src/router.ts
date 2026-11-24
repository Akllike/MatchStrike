import { createRouter, createWebHistory } from 'vue-router'
import AppShell from './AppShell.vue'
import { getCurrentUser } from './api'
import { adminLandingPath, canAccessAdmin } from './adminAccess'
import { loadWebsiteSettings, websiteSettings } from './websiteSettings'

const HomePage = () => import('./HomePage.vue')
const MatchesPage = () => import('./MatchesPage.vue')
const LobbyPage = () => import('./LobbyPage.vue')
const MatchDetailPage = () => import('./MatchDetailPage.vue')
const StatsPage = () => import('./StatsPage.vue')
const BansPage = () => import('./BansPage.vue')
const ProfilePage = () => import('./ProfilePage.vue')
const FriendsPage = () => import('./FriendsPage.vue')
const TicketsPage = () => import('./TicketsPage.vue')
const SettingsPage = () => import('./SettingsPage.vue')
const AdminPanelPage = () => import('./AdminPanelPage.vue')
const AdminNotificationsPage = () => import('./AdminNotificationsPage.vue')

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', name: 'home', component: HomePage },
        { path: 'lobby', name: 'lobby', component: LobbyPage },
        { path: 'matches', redirect: { name: 'matches-mode', params: { mode: 'mix' } } },
        { path: 'matches/:mode(mix|war)', name: 'matches-mode', component: MatchesPage },
        { path: 'matches/:id(\\d+)', name: 'match-detail', component: MatchDetailPage },
        { path: 'stats', name: 'stats', redirect: { name: 'stats-players' } },
        { path: 'stats/players', name: 'stats-players', component: StatsPage },
        { path: 'stats/season', name: 'stats-season', component: StatsPage },
        { path: 'bans', name: 'bans', component: BansPage },
        { path: 'profile/:nickname', name: 'profile', component: ProfilePage },
        { path: 'friends', name: 'friends', component: FriendsPage, meta: { requiresAuth: true } },
        { path: 'tickets', name: 'tickets', component: TicketsPage, meta: { requiresAuth: true } },
        { path: 'settings', name: 'settings', component: SettingsPage, meta: { requiresAuth: true } },
        { path: 'adminpanel', name: 'adminpanel', component: AdminPanelPage, meta: { requiresAdmin: true } },
        { path: 'notifications', name: 'admin-notifications', component: AdminNotificationsPage, meta: { requiresAdmin: true, adminPermission: 'notifications' } },
        { path: 'adminpanel/:section(users|tickets|servers|statistics|bans|mutes|operations|audit|settings)', name: 'adminpanel-section', component: AdminPanelPage, meta: { requiresAdmin: true } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  await loadWebsiteSettings()
  if (to.name === 'lobby' && !websiteSettings.value.lobbyEnabled && !to.query.room) return { name: 'home' }
  if (to.name === 'stats-season' && !websiteSettings.value.seasonEnabled) return { name: 'stats-players' }
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)
  const requiredAdminPermission = to.meta.adminPermission as string | undefined
  if (!requiresAdmin && !to.matched.some((record) => record.meta.requiresAuth)) return true

  let user
  try {
    user = await getCurrentUser()
  } catch {
    // Treat an unavailable auth endpoint as unauthenticated.
  }

  if (!user) return { name: 'home', query: { auth: 'login', redirect: to.fullPath } }
  if (!requiresAdmin) return true
  if (!user.adminRole) return { name: 'home' }

  if (requiredAdminPermission) {
    if (canAccessAdmin(user.adminRole, requiredAdminPermission as Parameters<typeof canAccessAdmin>[1])) return true
    return adminLandingPath(user.adminRole)
  }

  const permission = to.name === 'adminpanel' ? 'overview' : String(to.params.section ?? '')
  if (canAccessAdmin(user.adminRole, permission as Parameters<typeof canAccessAdmin>[1])) return true

  return adminLandingPath(user.adminRole)
})
