<script setup lang="ts">
import SiteAlert from '../components/SiteAlert.vue'
import { ref } from 'vue'
import { ArrowUpRight, Clock3, Gamepad2, RefreshCw, Swords, Users, X } from '@lucide/vue'
import { cancelAdminLobby } from '../api'
import type { AdminOperationsData } from '../api'
defineProps<{ data: AdminOperationsData }>()
const emit = defineEmits<{ refresh: [] }>()
const tab = ref<'matches' | 'lobbies'>('lobbies')
const selected = ref<AdminOperationsData['lobbies'][number] | null>(null)
const reason = ref('')
const busy = ref(false)
const error = ref('')
const labels: Record<string, string> = { waiting:'Набор игроков', provisioning:'Подготовка сервера', joining:'Подключение', live:'Live', preparing:'Подготовка матча', veto:'Выбор карт', warmup:'Разминка', starting:'Запуск', knife:'Ножевой раунд', draft:'Выбор команд', ready:'Готовность', overtime:'Овертайм' }
const time = (value: string | null) => value ? new Date(value).toLocaleString('ru-RU') : '—'
function select(room: AdminOperationsData['lobbies'][number]) { selected.value = room; reason.value = ''; error.value = '' }
async function cancel() {
  if (!selected.value || busy.value || reason.value.trim().length < 5) return
  busy.value = true; error.value = ''
  try { await cancelAdminLobby(selected.value.id, reason.value.trim()); selected.value = null; emit('refresh') }
  catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось отменить комнату.' }
  finally { busy.value = false }
}
</script>

<template>
  <SiteAlert :message="error" tone="error" @close="error = ''" />

  <section class="admin-operations">
    <div class="admin-section-toolbar"><div class="admin-segmented" role="group" aria-label="Матчи и комнаты"><button type="button" :aria-pressed="tab === 'lobbies'" @click="tab = 'lobbies'"><Users :size="14" /> Лобби <span>{{ data.lobbies.length }}</span></button><button type="button" :aria-pressed="tab === 'matches'" @click="tab = 'matches'"><Swords :size="14" /> Матчи <span>{{ data.matches.length }}</span></button></div><button class="friend-action" type="button" @click="emit('refresh')"><RefreshCw :size="13" /> Обновить</button></div>
    <div v-if="tab === 'lobbies'" class="admin-operations-list">
      <article v-for="room in data.lobbies" :key="room.id" class="admin-operation-card"><header><span class="admin-operation-icon"><Users :size="20" /></span><div><h3>{{ room.name }}</h3><p>Капитан: {{ room.captain }} · {{ room.teamSize }} × {{ room.teamSize }} · {{ room.format }}</p></div><span class="admin-state" :class="{ 'is-online':room.status==='live' }">{{ labels[room.status] || room.status }}</span></header><div class="admin-operation-meta"><span><Gamepad2 :size="13" /> {{ room.serverName || 'Сервер ещё не назначен' }}</span><span><Users :size="13" /> {{ room.members }} / {{ room.teamSize * 2 }} игроков</span><span v-if="room.deadline"><Clock3 :size="13" /> До {{ time(room.deadline) }}</span></div><p class="admin-operation-maps">{{ room.maps.join(' · ') }}</p><footer><RouterLink :to="{ path:'/lobby', query:{room:room.id} }" class="admin-text-link">В комнату <ArrowUpRight :size="13" /></RouterLink><button v-if="room.canCancel" class="admin-danger-button" type="button" @click="select(room)">Отменить лобби</button><span v-else class="admin-muted-note">Матч завершается на игровом сервере</span></footer></article>
      <div v-if="!data.lobbies.length" class="admin-board-empty admin-board"><Users :size="25" /><strong>Открытых комнат нет</strong><span>Комнаты появятся после создания игроками.</span></div>
    </div>
    <div v-else class="admin-operations-list"><article v-for="match in data.matches" :key="match.id" class="admin-operation-card"><header><span class="admin-operation-icon"><Swords :size="20" /></span><div><h3>{{ match.teamA }} <span class="admin-match-score">{{ match.scoreA ?? '—' }} : {{ match.scoreB ?? '—' }}</span> {{ match.teamB }}</h3><p>{{ match.mode }} · {{ match.format }} · {{ match.map }}</p></div><span class="admin-state" :class="{ 'is-online':['live','overtime'].includes(match.status) }">{{ labels[match.status] || match.status }}</span></header><div class="admin-operation-meta"><span>{{ match.serverName || 'Сервер не указан' }}</span><span>Последнее событие: {{ time(match.updatedAt) }}</span></div><footer><RouterLink :to="`/matches/${match.id}`" class="admin-text-link">Матч #{{ match.id }} <ArrowUpRight :size="13" /></RouterLink></footer></article><div v-if="!data.matches.length" class="admin-board-empty admin-board"><Swords :size="25" /><strong>Сейчас нет активных матчей</strong><span>Здесь отображаются live-матчи и подготовка к игре.</span></div></div>
    <p class="admin-muted-note">Показаны последние 50 активных записей каждого типа.</p>
    <Teleport to="body"><Transition name="modal"><div v-if="selected" class="modal-backdrop" @click.self="!busy && (selected = null)"><form class="info-dialog admin-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-cancel-title" @submit.prevent="cancel" @keydown.esc="!busy && (selected = null)"><button class="dialog-close" type="button" :disabled="busy" aria-label="Закрыть" @click="selected = null"><X :size="18" /></button><h2 id="admin-cancel-title">Отменить лобби?</h2><p>{{ selected.name }}. Игроки покинут комнату, сервер освободится после подтверждения моста.</p><label class="auth-field"><span>Причина для журнала действий</span><textarea v-model="reason" class="auth-input" required minlength="5" maxlength="240" rows="3"></textarea></label><div class="admin-modal-actions"><button class="dialog-secondary" type="button" :disabled="busy" @click="selected = null">Назад</button><button class="admin-danger-button" type="submit" :disabled="busy || reason.trim().length < 5">{{ busy ? 'Отменяем…' : 'Отменить лобби' }}</button></div></form></div></Transition></Teleport>
  </section>
</template>
