import type { AdminRole } from './api'

export const adminSections = [
  { id: 'users', label: 'Пользователи' },
  { id: 'tickets', label: 'Тикеты' },
  { id: 'servers', label: 'Серверы' },
  { id: 'statistics', label: 'Статистика' },
  { id: 'bans', label: 'Баны' },
  { id: 'mutes', label: 'Муты' },
  { id: 'operations', label: 'Матчи и лобби' },
  { id: 'audit', label: 'Журнал действий' },
  { id: 'settings', label: 'Настройки сайта' },
] as const

export type AdminSection = typeof adminSections[number]['id']
export type AdminPermission = 'overview' | AdminSection | 'notifications'

const rolePermissions: Record<AdminRole, readonly AdminPermission[]> = {
  moderator: ['tickets', 'bans', 'mutes'],
  administrator: ['users', 'tickets', 'bans', 'mutes'],
  high_administrator: ['overview', 'users', 'tickets', 'statistics', 'bans', 'mutes', 'notifications', 'audit'],
  developer: ['overview', 'users', 'tickets', 'servers', 'statistics', 'bans', 'mutes', 'notifications', 'operations', 'audit', 'settings'],
}

export function canAccessAdmin(role: AdminRole | null, permission: AdminPermission): boolean {
  return role !== null && rolePermissions[role].includes(permission)
}

export function adminLandingPath(role: AdminRole): string {
  if (role === 'moderator') return '/adminpanel/tickets'
  if (role === 'administrator') return '/adminpanel/users'
  return '/adminpanel'
}
