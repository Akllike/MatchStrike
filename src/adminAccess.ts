import type { AdminRole } from './api'

export const adminSections = [
  { id: 'users', label: 'Пользователи' },
  { id: 'tickets', label: 'Тикеты' },
  { id: 'servers', label: 'Серверы' },
  { id: 'statistics', label: 'Статистика' },
  { id: 'bans', label: 'Баны' },
  { id: 'mutes', label: 'Муты' },
] as const

export type AdminSection = typeof adminSections[number]['id']
export type AdminPermission = 'overview' | AdminSection | 'notifications'

const rolePermissions: Record<AdminRole, readonly AdminPermission[]> = {
  moderator: ['tickets', 'bans', 'mutes'],
  administrator: ['users', 'tickets', 'bans', 'mutes'],
  high_administrator: ['overview', 'users', 'tickets', 'statistics', 'bans', 'mutes', 'notifications'],
  developer: ['overview', 'users', 'tickets', 'servers', 'statistics', 'bans', 'mutes', 'notifications'],
}

export function canAccessAdmin(role: AdminRole | null, permission: AdminPermission): boolean {
  return role !== null && rolePermissions[role].includes(permission)
}

export function adminLandingPath(role: AdminRole): string {
  if (role === 'moderator') return '/adminpanel/tickets'
  if (role === 'administrator') return '/adminpanel/users'
  return '/adminpanel'
}