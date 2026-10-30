import { createRouter, createWebHistory } from 'vue-router'
import AppShell from './AppShell.vue'
import AdminPanelPage from './AdminPanelPage.vue'
import BansPage from './BansPage.vue'
import DashboardPage from './DashboardPage.vue'
import FriendsPage from './FriendsPage.vue'
import MatchesPage from './MatchesPage.vue'
import ProfilePage from './ProfilePage.vue'
import SettingsPage from './SettingsPage.vue'
import StatsPage from './StatsPage.vue'
import { getCurrentUser } from './api'
import { adminLandingPath, canAccessAdmin } from './adminAccess'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', name: 'home', component: DashboardPage },
        { path: 'matches', name: 'matches', component: MatchesPage },
        { path: 'stats', name: 'stats', component: StatsPage },
        { path: 'bans', name: 'bans', component: BansPage },
        { path: 'profile/:nickname', name: 'profile', component: ProfilePage },
        { path: 'friends', name: 'friends', component: FriendsPage, meta: { requiresAuth: true } },
        { path: 'settings', name: 'settings', component: SettingsPage, meta: { requiresAuth: true } },
        { path: 'adminpanel', name: 'adminpanel', component: AdminPanelPage, meta: { requiresAdmin: true } },
        { path: 'adminpanel/:section(users|tickets|servers|statistics|bans|mutes)', name: 'adminpanel-section', component: AdminPanelPage, meta: { requiresAdmin: true } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)
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

  const permission = to.name === 'adminpanel' ? 'overview' : String(to.params.section ?? '')
  if (canAccessAdmin(user.adminRole, permission as Parameters<typeof canAccessAdmin>[1])) return true

  return adminLandingPath(user.adminRole)
})