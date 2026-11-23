<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Crown, LockKeyhole, Map as MapIcon, ShieldCheck, UserRound, Users } from '@lucide/vue'
import type { LobbyRoom } from '../api'
import LobbyMapBackdrop from './LobbyMapBackdrop.vue'

const props = defineProps<{ room: LobbyRoom }>()
defineEmits<{ open: [room: LobbyRoom] }>()
const labels: Record<LobbyRoom['status'], string> = { waiting: 'Набор игроков', provisioning: 'Готовим сервер', joining: 'Подключение игроков', live: 'Матч на сервере', completed: 'Матч завершён', cancelled: 'Комната закрыта' }
const teams = computed(() => [1, 2].map(team => ({ id: team, name: team === 1 ? props.room.teamAName : props.room.teamBName,
  members: props.room.members.filter(member => member.team === team),
  seats: Array.from({ length: props.room.teamSize }, (_, i) => props.room.members.find(member => member.team === team && member.seat === i + 1) ?? null) })))
const captain = computed(() => props.room.members.find(member => member.userId === props.room.captainId))
const capacity = computed(() => props.room.teamSize * 2)
const spaces = computed(() => Math.max(0, capacity.value - props.room.members.length))
const state = computed(() => props.room.status === 'waiting' && props.room.veto ? props.room.veto.complete ? 'Карты определены' : 'Пики и баны' : props.room.status === 'waiting' && !spaces.value ? 'Составы собраны' : labels[props.room.status])
function hideAvatar(event: Event) { if (event.target instanceof HTMLImageElement) event.target.style.display = 'none' }
</script>

<template>
  <button type="button" class="lobby-room-card" :aria-label="`${room.name}, ${state}, ${room.members.length} из ${capacity} игроков`" @click="$emit('open', room)">
    <div class="room-cover">
      <LobbyMapBackdrop :maps="room.maps.length ? room.maps : room.mapPool" :format="room.format" />
      <div class="room-cover-top">
        <span class="room-state" :class="`is-${room.status}`"><i></i>{{ state }}</span>
        <span class="room-access" v-tooltip="room.isPrivate ? 'Вход в комнату по паролю' : 'Можно присоединиться без пароля'"><LockKeyhole v-if="room.isPrivate" :size="12" /><ShieldCheck v-else :size="12" />{{ room.isPrivate ? 'По паролю' : 'Открытая' }}</span>
      </div>
      <div class="room-cover-bottom"><div><span class="room-cover-mode">WAR MATCH</span><strong>{{ room.teamSize }}<i>×</i>{{ room.teamSize }}</strong></div><span class="room-format-tag">{{ room.format }}<small>MR{{ room.roundsPerHalf }}</small></span></div>
    </div>
    <div class="room-content">
      <div class="room-title-row"><h3>{{ room.name }}</h3><span class="room-open-icon"><ArrowUpRight :size="18" /></span></div>
      <div class="room-map-line" v-tooltip="(room.maps.length ? room.maps : room.mapPool).join(' · ')"><MapIcon :size="12" /><span>{{ room.maps.join(' · ') || 'Пул из 7 карт · выбор капитанов' }}</span></div>
      <div class="room-captain"><Crown :size="12" /><span>Капитан</span><strong>{{ captain?.nickname ?? 'Не выбран' }}</strong></div>
      <div class="room-squads">
        <div v-for="team in teams" :key="team.id" class="room-squad" :class="{ 'is-team-b': team.id === 2 }">
          <div class="room-squad-heading"><strong v-tooltip="team.name">{{ team.name }}</strong><span>{{ team.members.length }}<i>/</i>{{ room.teamSize }}</span></div>
          <div class="room-seats" :style="{ gridTemplateColumns: `repeat(${room.teamSize}, minmax(0, 1fr))` }">
            <span v-for="(member, index) in team.seats" :key="index" class="room-seat" :class="{ 'is-occupied': member }" v-tooltip="member ? `${member.nickname}${member.userId === room.captainId ? ' · капитан' : ''}` : 'Свободное место'">
              <template v-if="member"><span>{{ member.nickname.slice(0, 1).toLocaleUpperCase() }}</span><img v-if="member.avatarUrl" :src="member.avatarUrl" alt="" loading="lazy" @error="hideAvatar" /><Crown v-if="member.userId === room.captainId" class="room-seat-crown" :size="9" /></template>
              <UserRound v-else :size="12" />
            </span>
          </div>
        </div>
      </div>
      <div class="room-occupancy" aria-hidden="true"><span :style="{ width: `${room.members.length / capacity * 100}%` }"></span></div>
      <div class="room-bottom"><div><span class="room-player-count"><Users :size="13" /><strong>{{ room.members.length }}</strong> / {{ capacity }} игроков</span><small v-if="room.status === 'waiting'">{{ spaces ? `Свободно мест: ${spaces}` : 'Готово к запуску' }}</small><small v-else>{{ labels[room.status] }}</small></div><span class="room-enter">В комнату <ArrowUpRight :size="14" /></span></div>
    </div>
  </button>
</template>

<style scoped>
.lobby-room-card { display:flex; width:100%; min-width:0; height:100%; flex-direction:column; align-items:stretch; padding:0; overflow:hidden; border:0; border-radius:15px; color:var(--text); background:var(--panel); box-shadow:var(--shadow-soft); text-align:left; cursor:pointer; transition:box-shadow 180ms ease; }
.lobby-room-card:focus-visible { outline:2px solid var(--yellow); outline-offset:4px; }
.room-cover { position:relative; width:100%; height:160px; flex:0 0 160px; align-self:stretch; overflow:hidden; color:#f1f5f9; background:var(--panel); }
.room-cover-top,.room-cover-bottom { position:absolute; right:16px; left:16px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.room-cover-top { top:14px; }
.room-state,.room-access { display:inline-flex; min-width:0; align-items:center; gap:5px; padding:5px 7px; border-radius:5px; background:rgb(8 19 32 / 75%); font-size:9px; font-weight:600; }
.room-state { color:#a5e5f3; }.room-state i { width:5px; height:5px; flex-shrink:0; border-radius:50%; background:currentColor; box-shadow:0 0 8px currentColor; }
.room-state.is-live { color:#6ee7b7; }.room-state.is-joining,.room-state.is-provisioning { color:#fde68a; }.room-access { flex-shrink:0; color:#d3e2ef; }
.room-cover-bottom { bottom:14px; align-items:flex-end; }
.room-cover-bottom>div { display:grid; gap:3px; }.room-cover-mode { font-size:8px; font-weight:700; letter-spacing:.15em; color:var(--muted); }
.room-cover-bottom strong { color:var(--text); font-size:27px; font-weight:700; line-height:1; }.room-cover-bottom strong i { margin:0 5px; color:var(--muted); font-size:18px; font-style:normal; font-weight:400; }
.room-format-tag { display:flex; align-items:center; gap:7px; color:var(--text); font-size:12px; font-weight:700; }.room-format-tag small { padding:4px 5px; border-radius:4px; color:var(--muted); background:var(--surface-tint); font-size:9px; font-weight:600; }
.room-content { display:flex; width:100%; flex:1; min-width:0; align-self:stretch; flex-direction:column; padding:10px 17px 17px; }
.room-title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }.room-title-row h3 { display:-webkit-box; overflow:hidden; margin:0; color:var(--text); font-size:17px; font-weight:700; line-height:1.35; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow-wrap:anywhere; }
.room-open-icon { display:grid; width:25px; height:25px; flex-shrink:0; place-items:center; color:var(--subtle); background:var(--surface-tint); border-radius:6px; transition:color 150ms ease; }.lobby-room-card:hover .room-open-icon { color:var(--yellow); }
.room-map-line { display:flex; min-width:0; align-items:center; gap:5px; margin-top:7px; color:var(--muted); font-size:9px; line-height:1.5; }.room-map-line>svg { flex-shrink:0; }.room-map-line>span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.room-captain { display:flex; align-items:center; gap:5px; margin-top:13px; color:var(--subtle); font-size:10px; }.room-captain>svg { color:#d6a333; }.room-captain strong { min-width:0; overflow:hidden; color:var(--muted); font-size:10px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.room-squads { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:16px 0; }.room-squad { min-width:0; }.room-squad-heading { display:flex; align-items:center; justify-content:space-between; gap:5px; margin-bottom:9px; }.room-squad-heading>strong { min-width:0; overflow:hidden; color:var(--muted); font-size:10px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }.room-squad-heading>span { flex-shrink:0; color:var(--text); font-size:10px; font-variant-numeric:tabular-nums; }.room-squad-heading i { margin:0 2px; color:var(--subtle); font-style:normal; }
.room-seats { display:grid; gap:4px; }.room-seat { position:relative; display:grid; width:100%; max-width:29px; aspect-ratio:1; place-items:center; border:1px dashed var(--line); border-radius:50%; color:var(--subtle); background:var(--line-soft); font-size:10px; font-weight:600; }.room-seat.is-occupied { border:1px solid color-mix(in srgb,var(--yellow) 35%,transparent); color:var(--yellow); background:var(--surface-tint); }.is-team-b .room-seat.is-occupied { border-color:rgb(167 139 250 / 35%); color:#a78bfa; background:color-mix(in srgb,var(--panel) 88%,#a78bfa); }.room-seat>img { position:absolute; inset:0; width:100%; height:100%; border-radius:inherit; object-fit:cover; }.room-seat-crown { position:absolute; top:-4px; right:-3px; box-sizing:content-box; padding:1px; border-radius:3px; color:#eab308; background:var(--panel); }
.room-occupancy { height:3px; margin-top:auto; overflow:hidden; border-radius:9px; background:var(--line-soft); }.room-occupancy>span { display:block; height:100%; border-radius:inherit; background:var(--yellow); }
.room-bottom { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:13px; }.room-bottom>div { display:grid; gap:4px; }.room-player-count { display:flex; align-items:center; gap:4px; color:var(--muted); font-size:10px; }.room-player-count strong { color:var(--text); font-weight:700; }.room-player-count>svg { margin-right:2px; }.room-bottom small { color:var(--subtle); font-size:9px; }
.room-enter { display:inline-flex; flex-shrink:0; align-items:center; gap:5px; padding:8px 9px; border-radius:6px; color:var(--yellow); background:var(--surface-tint); font-size:10px; font-weight:600; }.lobby-room-card:hover .room-enter { color:var(--text); }
</style>
