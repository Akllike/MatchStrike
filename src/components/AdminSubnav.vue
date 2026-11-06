<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Activity, Ban, CircleHelp, Gamepad2, Megaphone, Users, X } from '@lucide/vue'
import { adminSections, canAccessAdmin } from '../adminAccess'
import type { AdminRole } from '../api'

const props = defineProps<{ role: AdminRole | null }>()
const route = useRoute()

const sectionIcons = {
  users: Users,
  tickets: CircleHelp,
  servers: Gamepad2,
  statistics: Activity,
  bans: Ban,
  mutes: X,
} as const
</script>

<template>
  <nav v-if="props.role" class="admin-subnav" aria-label="Разделы админ панели">
    <RouterLink
      v-if="canAccessAdmin(props.role, 'overview')"
      class="admin-subnav-link"
      :class="{ 'is-active': route.name === 'adminpanel' }"
      :to="{ name: 'adminpanel' }"
    >Обзор</RouterLink>
    <RouterLink
      v-if="canAccessAdmin(props.role, 'notifications')"
      class="admin-subnav-link"
      :class="{ 'is-active': route.name === 'admin-notifications' }"
      :to="{ name: 'admin-notifications' }"
    ><Megaphone :size="14" /> Уведомления</RouterLink>
    <RouterLink
      v-for="item in adminSections.filter((entry) => canAccessAdmin(props.role, entry.id))"
      :key="item.id"
      class="admin-subnav-link"
      :class="{ 'is-active': route.params.section === item.id && route.name === 'adminpanel-section' }"
      :to="{ name: 'adminpanel-section', params: { section: item.id } }"
    >
      <component :is="sectionIcons[item.id]" :size="14" /> {{ item.label }}
    </RouterLink>
  </nav>
</template>
