<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Activity, ArrowLeft, ArrowUpRight, Ban, CircleHelp, Gamepad2, LayoutDashboard, Megaphone, ScrollText, Settings, Swords, Users } from '@lucide/vue'
import { canAccessAdmin } from '../adminAccess'
import type { AdminPermission } from '../adminAccess'
import type { AdminRole } from '../api'

const props = withDefaults(defineProps<{ role: AdminRole | null; collapsed?: boolean }>(), { collapsed: false })
defineEmits<{ navigate: [] }>()
const route = useRoute()
const items = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard, to: '/adminpanel' },
  { id: 'users', label: 'Пользователи', icon: Users, to: '/adminpanel/users' },
  { id: 'servers', label: 'Серверы', icon: Gamepad2, to: '/adminpanel/servers' },
  { id: 'operations', label: 'Матчи и лобби', icon: Swords, to: '/adminpanel/operations' },
  { id: 'tickets', label: 'Тикеты', icon: CircleHelp, to: '/adminpanel/tickets' },
  { id: 'bans', label: 'Модерация', icon: Ban, to: '/adminpanel/bans' },
  { id: 'statistics', label: 'Статистика', icon: Activity, to: '/adminpanel/statistics' },
  { id: 'notifications', label: 'Уведомления', icon: Megaphone, to: '/notifications' },
  { id: 'audit', label: 'Журнал действий', icon: ScrollText, to: '/adminpanel/audit' },
  { id: 'settings', label: 'Настройки сайта', icon: Settings, to: '/adminpanel/settings' },
] as const
const visible = computed(() => items.filter(item => canAccessAdmin(props.role, item.id as AdminPermission)))
const active = (id: string, path: string) => route.path === path || (id === 'bans' && route.path === '/adminpanel/mutes')
</script>

<template>
  <nav v-if="role" id="primary-navigation" class="main-nav admin-workspace-nav" aria-label="Разделы админ панели">
    <RouterLink v-for="item in visible" :key="item.id" :to="item.to" class="nav-link" :class="{ 'is-active': active(item.id, item.to) }" :aria-current="active(item.id, item.to) ? 'page' : undefined" :aria-label="item.label" v-tooltip="collapsed ? item.label : undefined" @click="$emit('navigate')">
      <span class="nav-icon"><component :is="item.icon" :size="18" :stroke-width="1.8" /></span><span class="nav-label">{{ item.label }}</span><ArrowUpRight v-if="active(item.id, item.to)" class="nav-arrow" :size="14" />
    </RouterLink>
    <RouterLink to="/" class="nav-link admin-return-link" aria-label="Вернуться на сайт" v-tooltip="collapsed ? 'Вернуться на сайт' : undefined" @click="$emit('navigate')"><span class="nav-icon"><ArrowLeft :size="18" /></span><span class="nav-label">Вернуться на сайт</span></RouterLink>
  </nav>
</template>
