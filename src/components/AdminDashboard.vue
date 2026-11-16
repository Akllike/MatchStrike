<script setup lang="ts">
import { computed } from 'vue'
import { Activity, ArrowUpRight, Check, CircleAlert, Clock3, Gamepad2, Headphones, Server, ShieldCheck, Swords, Users } from '@lucide/vue'
import type { AdminControlCenter, AdminRole } from '../api'
import { canAccessAdmin } from '../adminAccess'
import { handleMapImageError, matchMapImage } from '../matchArtwork'
const props = defineProps<{ data: AdminControlCenter; role: AdminRole }>()
const metrics = computed(() => [
  { label: 'Игроки онлайн', value: props.data.stats.playersOnline, note: 'На ответивших серверах', icon: Users, tone: 'cyan' },
  { label: 'Серверы онлайн', value: `${props.data.stats.serversOnline} / ${props.data.stats.serversTotal}`, note: 'Актуальные данные за 3 минуты', icon: Server, tone: 'green' },
  { label: 'Активные матчи', value: props.data.stats.activeMatches, note: `${props.data.stats.openLobbies} открытых лобби`, icon: Swords, tone: 'violet' },
  { label: 'Ожидают ответа', value: props.data.stats.unansweredTickets, note: `${props.data.stats.openTickets} открытых тикетов`, icon: Headphones, tone: 'amber' },
])
const states = { online: 'Онлайн', offline: 'Недоступен', stale: 'Данные устарели', unknown: 'Нет данных' }
const time = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ещё не получены'
</script>

<template>
  <section class="admin-dashboard" aria-label="Состояние сообщества">
    <div class="admin-health-strip"><span class="admin-live-mark"><Activity :size="14" /> Состояние сообщества</span><span><Clock3 :size="12" /> {{ time(data.updatedAt) }}</span></div>
    <div class="admin-dashboard-metrics">
      <article v-for="metric in metrics" :key="metric.label" class="admin-dashboard-metric" :class="`tone-${metric.tone}`"><span class="admin-metric-symbol"><component :is="metric.icon" :size="18" /></span><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.note }}</small></article>
    </div>
    <div class="admin-dashboard-columns">
      <section class="admin-board">
        <header class="admin-board-heading"><div><span class="section-kicker">ИНФРАСТРУКТУРА</span><h2>Игровые серверы</h2></div><RouterLink v-if="canAccessAdmin(role, 'servers')" to="/adminpanel/servers" class="admin-text-link">Управление <ArrowUpRight :size="14" /></RouterLink></header>
        <div v-if="data.servers.length" class="admin-health-servers">
          <article v-for="server in data.servers" :key="server.id" class="admin-health-server">
            <span class="admin-health-map"><img v-if="server.map && matchMapImage(server.map)" :src="matchMapImage(server.map)!" alt="" loading="lazy" @error="handleMapImageError" /><Gamepad2 v-else :size="18" /></span>
            <div class="admin-health-server-copy"><strong>{{ server.name }}</strong><span>{{ server.map || 'Карта неизвестна' }} · {{ server.lobbyOnly ? 'Только лобби' : 'Общедоступный' }}</span><small v-tooltip="`Последние данные моста: ${time(server.lastSeenAt)}`">DonutMatch: {{ { connected: 'подключён', waiting: 'ожидает данные', stale: 'нет обновлений', unconfigured: 'не подключён' }[server.bridge] }}</small></div>
            <div class="admin-health-server-value"><span class="admin-state" :class="`is-${server.state}`"><i></i>{{ states[server.state] }}</span><strong>{{ server.players ?? '—' }} <small>/ {{ server.maxPlayers ?? '—' }}</small></strong></div>
          </article>
        </div>
        <div v-else class="admin-board-empty"><Server :size="23" /><strong>Серверов пока нет</strong><span>Добавленные серверы появятся здесь.</span></div>
        <p class="admin-board-note">Показаны последние сохранённые ответы серверов. Обновление данных доступно в управлении серверами.</p>
      </section>
      <section class="admin-board">
        <header class="admin-board-heading"><div><span class="section-kicker">ВНИМАНИЕ</span><h2>Требует внимания <small>{{ data.attention.length }}</small></h2></div><ShieldCheck :size="19" /></header>
        <div v-if="data.attention.length" class="admin-attention-list"><article v-for="item in data.attention" :key="item.id" class="admin-attention-item" :class="`is-${item.severity}`"><CircleAlert :size="17" /><div><strong>{{ item.title }}</strong><p>{{ item.detail }}</p><RouterLink v-if="canAccessAdmin(role, item.section)" :to="`/adminpanel/${item.section}`" class="admin-text-link">Открыть раздел <ArrowUpRight :size="12" /></RouterLink></div></article></div>
        <div v-else class="admin-board-empty"><Check :size="25" /><strong>Всё спокойно</strong><span>По сохранённым данным проблем не обнаружено.</span></div>
      </section>
    </div>
    <section class="admin-board admin-recent-board"><header class="admin-board-heading"><div><span class="section-kicker">КОМАНДА АДМИНИСТРАЦИИ</span><h2>Последние действия</h2></div><RouterLink v-if="canAccessAdmin(role, 'audit')" to="/adminpanel/audit" class="admin-text-link">Весь журнал <ArrowUpRight :size="14" /></RouterLink></header><div v-if="data.recentActivity.length" class="admin-activity-list"><article v-for="entry in data.recentActivity" :key="entry.id"><span class="admin-activity-dot"></span><div><strong>{{ entry.action }}</strong><span>{{ entry.actor }}<template v-if="entry.resourceId"> · #{{ entry.resourceId }}</template></span></div><time>{{ time(entry.createdAt) }}</time></article></div><div v-else class="admin-board-empty"><Clock3 :size="22" /><strong>Журнал пока пуст</strong><span>Здесь будут появляться новые действия администрации.</span></div></section>
    <div class="admin-community-summary"><Users :size="15" /><span>В сообществе <strong>{{ data.stats.users }}</strong> пользователей</span><span>+{{ data.stats.newUsers }} за последние сутки</span></div>
  </section>
</template>
