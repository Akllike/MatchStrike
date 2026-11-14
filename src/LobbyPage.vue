<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Users, Plus, LockKeyhole, Crown, ArrowLeft, ArrowUpRight, X, Copy, Play, Timer, Map, Settings, ShieldCheck, LoaderCircle, Swords, Trophy } from '@lucide/vue'
import { getCurrentUser, getLobbies, getLobby, saveLobby, takeLobbySeat, leaveLobby, startLobby, cancelLobby } from './api'
import type { AuthUser, LobbyListing, LobbyRoom, LobbySettings } from './api'
import PageLoader from './components/PageLoader.vue'
import { matchMapImage } from './matchArtwork'

const router = useRouter()
const route = useRoute()
const user = ref<AuthUser | null>(null)
const listing = ref<LobbyListing | null>(null)
const room = ref<LobbyRoom | null>(null)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const formError = ref('')
const copied = ref('')
const page = ref(1)
const now = ref(Date.now())
const editor = ref<HTMLDialogElement | null>(null)
const passwordDialog = ref<HTMLDialogElement | null>(null)
const editing = ref<string | undefined>()
const changePassword = ref(false)
const joinPassword = ref('')
const targetSeat = ref<{ team: number; seat: number } | null>(null)
const form = ref<LobbySettings>(defaultSettings())
let poll: ReturnType<typeof setInterval> | undefined
let clock: ReturnType<typeof setInterval> | undefined
let fetching = false
let disposed = false
let version = 0
function defaultSettings(): LobbySettings { return { name: '', password: '', team_size: 5, format: 'Classic', maps: [], rounds_per_half: 15, team_a_name: 'Команда A', team_b_name: 'Команда B' } }
const mine = computed(() => room.value?.members.find(member => member.userId === user.value?.id))
const captain = computed(() => !!user.value && room.value?.captainId === user.value.id)
const filled = computed(() => !!room.value && room.value.members.length === room.value.teamSize * 2)
const terminal = computed(() => room.value && ['completed', 'cancelled'].includes(room.value.status))
const countdown = computed(() => { const seconds = room.value?.deadline ? Math.max(0, Math.ceil((Date.parse(room.value.deadline) - now.value) / 1000)) : 300; return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` })
const mapCount = computed(() => form.value.format === 'BO3' ? 3 : form.value.format === 'BO5' ? 5 : 1)
const stateLabels: Record<LobbyRoom['status'], string> = { waiting: 'Набор игроков', provisioning: 'Готовим сервер', joining: 'Подключение игроков', live: 'Матч на сервере', completed: 'Матч завершён', cancelled: 'Комната закрыта' }
const seatMember = (team: number, seat: number) => room.value?.members.find(member => member.team === team && member.seat === seat)
function closeReason(reason: string | null): string {
  const messages: Record<string, string> = {
    connect_timeout: 'За пять минут состав не подключился. Сервер освобождается.',
    not_enough_players: 'Матч отменён: к концу подготовки составы сторон оказались неполными.',
    preparation_timeout: 'Игровой сервер не подтвердил запуск после подготовки. Матч отменён.',
  }
  return messages[reason ?? ''] ?? 'Комната больше не принимает игроков.'
}
function login() { void router.push({ name: 'home', query: { auth: 'login', redirect: '/lobby' } }) }
function openRoom(value: LobbyRoom) { room.value = value; error.value = ''; version++; void router.replace({ query: { room: value.id } }) }
function back() { room.value = null; version++; error.value = ''; void router.replace({ query: {} }) }
function invite() { if (room.value) void copy(`${window.location.origin}/lobby?room=${room.value.id}`, 'Ссылка') }

async function refresh() {
  if (fetching || busy.value || disposed) return
  fetching = true
  const id = version
  try {
    const data = await getLobbies(page.value)
    if (disposed || id !== version) return
    listing.value = data
    const selectedId = room.value?.id ?? (typeof route.query.room === 'string' ? route.query.room : null)
    if (selectedId) {
      const updated = data.rooms.find(item => item.id === selectedId) ?? (data.myRoom?.id === selectedId ? data.myRoom : await getLobby(selectedId))
      if (!disposed && id === version) room.value = updated
    }
  } catch (e) { if (!disposed && id === version) error.value = e instanceof Error ? e.message : 'Не удалось загрузить лобби.' }
  finally { fetching = false; if (!disposed) loading.value = false }
}
async function act(work: () => Promise<void>) {
  if (busy.value) return
  busy.value = true; error.value = ''; version++
  try { await work() } catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось выполнить действие.' }
  finally { busy.value = false; void refresh() }
}
async function openEditor(edit = false) {
  if (!user.value) { login(); return }
  if (!user.value.steamId) { error.value = 'Привяжите Steam в настройках профиля, чтобы создавать комнаты.'; return }
  editing.value = edit ? room.value?.id : undefined
  form.value = edit && room.value ? { name: room.value.name, team_size: room.value.teamSize, format: room.value.format, maps: [...room.value.maps], rounds_per_half: room.value.roundsPerHalf, team_a_name: room.value.teamAName, team_b_name: room.value.teamBName, password: '' } : { ...defaultSettings(), name: `Комната ${user.value.nickname}`, maps: listing.value?.maps.slice(0, 1) ?? [] }
  formError.value = ''; changePassword.value = !edit
  await nextTick(); editor.value?.showModal()
}
function toggleMap(map: string) {
  const index = form.value.maps.indexOf(map)
  if (index >= 0) form.value.maps.splice(index, 1)
  else if (form.value.maps.length < mapCount.value) form.value.maps.push(map)
  else if (mapCount.value === 1) form.value.maps = [map]
}
watch(() => form.value.format, () => { form.value.maps = form.value.maps.slice(0, mapCount.value) })
async function submitRoom() {
  if (busy.value) return
  busy.value = true; formError.value = ''; version++
  try {
    const payload = { ...form.value }
    if (editing.value && !changePassword.value) delete payload.password
    if (payload.password === '') payload.password = null
    const saved = await saveLobby(payload, editing.value)
    editor.value?.close(); openRoom(saved)
  } catch (e) { formError.value = e instanceof Error ? e.message : 'Не удалось сохранить комнату.' }
  finally { busy.value = false; void refresh() }
}
async function occupy(team: number, seat: number) {
  if (!user.value) { login(); return }
  if (!room.value || room.value.status !== 'waiting' || seatMember(team, seat)) return
  if (room.value.isPrivate && !mine.value) { targetSeat.value = { team, seat }; joinPassword.value = ''; formError.value = ''; passwordDialog.value?.showModal(); return }
  await act(async () => { room.value = await takeLobbySeat(room.value!.id, team, seat) })
}
async function joinPrivate() {
  if (!room.value || !targetSeat.value || busy.value) return
  busy.value = true; formError.value = ''; version++
  try { room.value = await takeLobbySeat(room.value.id, targetSeat.value.team, targetSeat.value.seat, joinPassword.value); passwordDialog.value?.close(); joinPassword.value = '' }
  catch (e) { formError.value = e instanceof Error ? e.message : 'Не удалось войти.' }
  finally { busy.value = false; void refresh() }
}
async function copy(text: string, label: string) { try { await navigator.clipboard.writeText(text); copied.value = label; setTimeout(() => { copied.value = '' }, 2000) } catch { error.value = 'Не удалось скопировать. Выделите и скопируйте значение вручную.' } }
onMounted(async () => {
  try { user.value = await getCurrentUser() } catch { user.value = null }
  if (disposed) return
  await refresh()
  poll = setInterval(() => { if (!document.hidden) void refresh() }, 2000)
  clock = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => { disposed = true; version++; if (poll) clearInterval(poll); if (clock) clearInterval(clock); editor.value?.close(); passwordDialog.value?.close() })
</script>

<template>
  <div class="lobby-page">
    <section class="welcome-section route-intro"><div class="welcome-copy"><div class="eyebrow"><span class="eyebrow-line"></span> СОБЕРИТЕ СВОЙ СОСТАВ <span class="eyebrow-slash">/</span> LOBBY</div><h1>Лобби</h1><p>Свои команды. Свои правила. Ваш следующий матч начинается здесь.</p></div><div class="route-intro-mark"><Users :size="28" :stroke-width="1.5" /></div></section>
    <div v-if="error" class="lobby-alert" role="alert">{{ error }} <RouterLink v-if="user && !user.steamId" to="/settings">Настройки профиля <ArrowUpRight :size="13" /></RouterLink></div>
    <PageLoader v-if="loading" message="Загружаем комнаты…" />
    <template v-else-if="!room">
      <div class="lobby-toolbar"><div><span class="section-kicker">ИГРАТЬ ВМЕСТЕ</span><h2>Комнаты игроков <small>{{ listing?.pagination.total ?? 0 }}</small></h2><p><span class="lobby-online-dot"></span> Свободных серверов: {{ listing?.availableServers ?? 0 }}</p></div><button class="lobby-primary" type="button" :disabled="busy || !!listing?.myRoom" @click="openEditor()"><Plus :size="17" /> Создать лобби</button></div>
      <button v-if="listing?.myRoom" class="lobby-mine" type="button" @click="openRoom(listing.myRoom)"><Users :size="20" /><span>Вы уже в комнате<strong>{{ listing.myRoom.name }}</strong></span><ArrowUpRight :size="20" /></button>
      <div v-if="listing?.rooms.length" class="lobby-grid">
        <button v-for="item in listing.rooms" :key="item.id" type="button" class="room-card" @click="openRoom(item)">
          <div class="room-card-map" :style="{ backgroundImage: matchMapImage(item.maps[0]) ? `url(${matchMapImage(item.maps[0])})` : undefined }"><span class="room-format">{{ item.teamSize }} × {{ item.teamSize }} <i>·</i> {{ item.format }}</span><LockKeyhole v-if="item.isPrivate" :size="16" /><span v-else class="room-public">Открытая</span></div>
          <div class="room-card-body"><span class="room-status" :class="{ 'is-live': item.status === 'live' }">{{ stateLabels[item.status] }}</span><h3>{{ item.name }}</h3><p>{{ item.maps.join(' · ') }}</p><div class="room-preview-teams"><span v-for="team in [1, 2]" :key="team"><i v-for="seat in item.teamSize" :key="seat" :class="{ occupied: item.members.some(member => member.team === team && member.seat === seat) }"><Users :size="12" /></i></span></div><div class="room-card-footer"><span>{{ item.members.length }} / {{ item.teamSize * 2 }} игроков</span><strong>В комнату <ArrowUpRight :size="14" /></strong></div></div>
        </button>
      </div>
      <div v-else class="lobby-empty"><span><Swords :size="29" /></span><h3>Первый матч — за вами</h3><p>Создайте комнату, выберите карту и пригласите игроков занять места.</p><button class="lobby-primary" type="button" @click="openEditor()"><Plus :size="16" /> Создать комнату</button></div>
      <div v-if="listing && listing.pagination.lastPage > 1" class="lobby-pagination"><button class="friend-action" :disabled="page === 1" @click="page--; refresh()">Назад</button><span>{{ page }} / {{ listing.pagination.lastPage }}</span><button class="friend-action" :disabled="page >= listing.pagination.lastPage" @click="page++; refresh()">Далее</button></div>
      <p class="lobby-footnote"><ShieldCheck :size="15" /> Для участия нужен привязанный Steam. Сервер и пароль выдаются участникам после запуска капитаном.</p>
    </template>
    <template v-else>
      <button class="lobby-back" type="button" @click="back()"><ArrowLeft :size="15" /> Все комнаты</button>
      <section class="lobby-room-hero"><div><span class="room-status">{{ stateLabels[room.status] }} <LockKeyhole v-if="room.isPrivate" :size="12" /></span><h2>{{ room.name }}</h2><p>{{ room.teamSize }} × {{ room.teamSize }} <i>·</i> {{ room.format }} <i>·</i> MR{{ room.roundsPerHalf }}</p></div><div class="lobby-room-actions"><button v-if="captain && room.status === 'waiting'" class="friend-action" :disabled="busy" @click="openEditor(true)"><Settings :size="14" /> Настройки</button><button class="friend-action" @click="invite()"><Copy :size="14" /> Пригласить</button></div></section>
      <div class="lobby-room-maps"><span><Map :size="15" /> Карты матча</span><b v-for="(map, index) in room.maps" :key="map"><small>{{ String(index + 1).padStart(2, '0') }}</small>{{ map }}</b></div>
      <div v-if="room.status === 'provisioning' || room.status === 'joining'" class="lobby-countdown"><Timer :size="27" /><div><strong>{{ countdown }}</strong><span>на подключение и начало матча</span></div><p>{{ room.status === 'provisioning' ? 'Игровой сервер готовит карту и защищает вход. Адрес появится после подтверждения готовности.' : room.preparationEndsAt ? 'Весь состав на сервере. После 30 секунд подготовки автоматически начнётся ножевой раунд.' : 'Подключитесь через Steam. После сбора состава начнётся 30-секундная подготовка.' }}</p></div>
      <div v-if="terminal" class="lobby-result"><Trophy :size="24" /><h3>{{ room.status === 'completed' ? 'Матч завершён' : 'Комната закрыта' }}</h3><p>{{ closeReason(room.finishReason) }}</p><RouterLink v-if="room.matchId" :to="`/matches/${room.matchId}`" class="friend-action">Страница матча <ArrowUpRight :size="14" /></RouterLink></div>
      <div v-else class="lobby-teams"><section v-for="team in [1, 2]" :key="team" class="lobby-team" :class="{ 'is-team-b': team === 2 }"><header><span>{{ team === 1 ? 'A' : 'B' }}</span><h3>{{ team === 1 ? room.teamAName : room.teamBName }}</h3><small>{{ room.members.filter(member => member.team === team).length }} / {{ room.teamSize }}</small></header><button v-for="seat in room.teamSize" :key="seat" type="button" class="lobby-seat" :class="{ 'is-occupied': seatMember(team, seat), 'is-me': seatMember(team, seat)?.userId === user?.id }" :disabled="busy || room.status !== 'waiting' || !!seatMember(team, seat)" @click="occupy(team, seat)"><span class="seat-number">{{ String(seat).padStart(2, '0') }}</span><template v-if="seatMember(team, seat)"><img v-if="seatMember(team, seat)?.avatarUrl" :src="seatMember(team, seat)!.avatarUrl!" alt="" /><span v-else class="seat-avatar"><Users :size="19" /></span><span class="seat-player"><strong>{{ seatMember(team, seat)?.nickname }}</strong><small>{{ seatMember(team, seat)?.userId === user?.id ? 'Это вы' : 'Участник' }}</small></span><Crown v-if="seatMember(team, seat)?.userId === room.captainId" class="seat-crown" :size="17" /><span v-if="room.status !== 'waiting'" class="seat-connection" :class="{ connected: seatMember(team, seat)?.connected }" v-tooltip="seatMember(team, seat)?.connected ? 'На игровом сервере' : 'Ожидаем подключения'"></span></template><template v-else><span class="seat-avatar empty"><Plus :size="20" /></span><span class="seat-player"><strong>Свободное место</strong><small>{{ room.status === 'waiting' ? 'Занять место в команде' : 'Состав зафиксирован' }}</small></span><ArrowUpRight :size="16" /></template></button></section></div>
      <div v-if="room.server && mine" class="lobby-connect"><div><span class="section-kicker">ВАШ ИГРОВОЙ СЕРВЕР</span><h3>{{ room.server.address }}</h3><p>Пароль: <code>{{ room.server.password }}</code><button type="button" aria-label="Скопировать пароль" @click="copy(room.server.password, 'Пароль')"><Copy :size="13" /></button></p></div><div><button class="friend-action" @click="copy(`password ${room.server.password}; connect ${room.server.address}`, 'Команда')"><Copy :size="14" /> Команда подключения</button><a class="lobby-primary" :href="`steam://connect/${room.server.address}/${encodeURIComponent(room.server.password)}`"><Play :size="15" /> Подключиться</a></div></div>
      <footer v-if="!terminal" class="lobby-controls"><p><Crown :size="16" /> {{ captain ? 'Вы капитан комнаты' : 'Настройки и запуск — у капитана комнаты' }}<span v-if="room.status === 'waiting'">{{ filled ? 'Обе команды в сборе' : `Ожидаем ещё ${room.teamSize * 2 - room.members.length} игроков` }}</span></p><div><button v-if="mine && room.status === 'waiting'" class="friend-action" :disabled="busy" @click="act(async () => { await leaveLobby(room!.id); back() })">Покинуть</button><button v-if="captain && ['waiting', 'joining', 'provisioning'].includes(room.status)" class="friend-action" :disabled="busy" @click="act(async () => { await cancelLobby(room!.id); back() })">Закрыть комнату</button><button v-if="captain && room.status === 'waiting'" class="lobby-primary" :disabled="busy || !filled" @click="act(async () => { room = await startLobby(room!.id) })"><LoaderCircle v-if="busy" class="is-spinning" :size="16" /><Play v-else :size="16" /> Запустить матч</button><RouterLink v-if="room.matchId" class="friend-action" :to="`/matches/${room.matchId}`">Матч <ArrowUpRight :size="14" /></RouterLink></div></footer>
    </template>
    <p v-if="copied" class="lobby-copied" role="status">{{ copied }} скопирована</p>
    <dialog ref="editor" class="lobby-dialog" @click="event => { if (event.target === editor) editor?.close() }"><form @submit.prevent="submitRoom"><header><div><span class="section-kicker">ВАШ МАТЧ — ВАШИ ПРАВИЛА</span><h2>{{ editing ? 'Настройки комнаты' : 'Создать лобби' }}</h2></div><button type="button" aria-label="Закрыть" @click="editor?.close()"><X :size="20" /></button></header><p v-if="formError" class="lobby-alert" role="alert">{{ formError }}</p><label class="lobby-field">Название комнаты<input v-model.trim="form.name" required minlength="3" maxlength="64" /></label><div class="lobby-form-row"><label class="lobby-field">Команда A<input v-model.trim="form.team_a_name" required maxlength="40" /></label><label class="lobby-field">Команда B<input v-model.trim="form.team_b_name" required maxlength="40" /></label></div><fieldset><legend>Игроков за сторону</legend><div class="lobby-segments"><button v-for="size in [1, 2, 3, 4, 5]" :key="size" type="button" :aria-pressed="form.team_size === size" @click="form.team_size = size">{{ size }} × {{ size }}</button></div></fieldset><fieldset><legend>Формат матча</legend><div class="lobby-segments"><button v-for="format in (['Classic', 'BO1', 'BO3', 'BO5'] as const)" :key="format" type="button" :aria-pressed="form.format === format" @click="form.format = format">{{ format }}</button></div><p>{{ form.format === 'Classic' ? 'Обычный War на одной карте' : form.format === 'BO1' ? 'Серия из одной карты' : `Серия до ${form.format === 'BO3' ? 2 : 3} побед` }}</p></fieldset><fieldset><legend>Карты <small>{{ form.maps.length }} / {{ mapCount }}</small></legend><p>Выберите {{ mapCount }} {{ mapCount === 1 ? 'карту' : 'карты' }} в порядке игры.</p><div class="lobby-map-picker"><button v-for="map in listing?.maps ?? []" :key="map" type="button" :aria-pressed="form.maps.includes(map)" @click="toggleMap(map)"><span>{{ form.maps.includes(map) ? form.maps.indexOf(map) + 1 : '+' }}</span>{{ map }}</button></div><p v-if="!listing?.maps.length">Карты появятся после подключения сервера с включённым режимом лобби.</p></fieldset><div class="lobby-form-row"><label class="lobby-field">Раундов за сторону<select v-model.number="form.rounds_per_half"><option :value="15">MR15 — до 16 побед</option><option :value="12">MR12 — до 13 побед</option></select></label><label class="lobby-field">{{ editing ? 'Новый пароль комнаты' : 'Пароль комнаты' }}<input v-model="form.password" type="password" :disabled="!!editing && !changePassword" minlength="4" maxlength="64" autocomplete="new-password" placeholder="Без пароля — открытая" /></label></div><label v-if="editing" class="lobby-check"><input v-model="changePassword" type="checkbox" /> Изменить пароль (пустое поле снимет защиту)</label><p class="lobby-dialog-note"><ShieldCheck :size="15" /> Пароль комнаты нужен для входа в лобби. Пароль игрового сервера создаётся отдельно при запуске.</p><button class="lobby-primary" type="submit" :disabled="busy || form.maps.length !== mapCount"><LoaderCircle v-if="busy" class="is-spinning" :size="16" /><Plus v-else :size="16" /> {{ editing ? 'Сохранить настройки' : 'Создать комнату' }}</button></form></dialog>
    <dialog ref="passwordDialog" class="lobby-dialog is-password"><form @submit.prevent="joinPrivate"><header><h2>Закрытая комната</h2><button type="button" aria-label="Закрыть" @click="passwordDialog?.close()"><X :size="19" /></button></header><p v-if="formError" class="lobby-alert" role="alert">{{ formError }}</p><label class="lobby-field">Пароль комнаты<input v-model="joinPassword" type="password" required maxlength="64" autocomplete="off" /></label><button class="lobby-primary" type="submit" :disabled="busy"><LockKeyhole :size="15" /> Занять место</button></form></dialog>
  </div>
</template>

<style scoped>
.lobby-page { color:var(--text); }.lobby-page button,.lobby-page input,.lobby-page select { font:inherit; }.lobby-page button { cursor:pointer; }.lobby-page button:disabled { opacity:.5; cursor:not-allowed; }.lobby-page h2,.lobby-page h3,.lobby-page p { margin:0; }.lobby-page button:focus-visible,.lobby-page a:focus-visible { outline:2px solid var(--yellow); outline-offset:4px; }
.lobby-toolbar { display:flex; align-items:center; justify-content:space-between; gap:18px; margin:28px 0 22px; }.lobby-toolbar h2 { margin:7px 0 12px; font-size:23px; font-weight:700; letter-spacing:-.6px; }.lobby-toolbar h2 small { color:var(--subtle); font-size:14px; margin-left:7px; }.lobby-toolbar p { display:flex; gap:7px; align-items:center; color:var(--muted); font-size:11px; }.lobby-online-dot { width:6px; height:6px; background:var(--yellow); border-radius:50%; }
.lobby-primary { display:inline-flex; align-items:center; justify-content:center; gap:9px; border:0; border-radius:10px; padding:13px 18px; background:var(--yellow); color:var(--bg); font-size:12px!important; font-weight:700!important; text-decoration:none; white-space:nowrap; }.lobby-primary:hover:not(:disabled) { filter:brightness(1.08); }
.lobby-page .friend-action { font-size:11px; }
.lobby-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr)); gap:18px; }.room-card { min-width:0; padding:0; overflow:hidden; border:0; border-radius:15px; background:var(--panel); color:var(--text); box-shadow:var(--shadow-soft); text-align:left; }.room-card:hover .room-card-footer strong { color:var(--yellow); }.room-card-map { display:flex; align-items:flex-start; justify-content:space-between; padding:17px; height:105px; background-color:var(--surface-tint); background-size:cover; background-position:center; position:relative; isolation:isolate; color:#e6f5ff; }.room-card-map:before { position:absolute; inset:0; z-index:-1; content:''; background:linear-gradient(180deg,#091a2d77,#091a2d); }.room-format { font-size:12px; font-weight:700; }.room-format i { font-style:normal; padding:0 6px; opacity:.5; }.room-public { font-size:10px; color:#c0d7e8; }.room-card-body { padding:20px; }.room-status { display:inline-flex; gap:7px; align-items:center; color:var(--yellow); font-size:10px; font-weight:600; }.room-status.is-live { color:#20b98b; }.room-card h3 { font-size:18px; font-weight:700; margin:9px 0 8px; overflow-wrap:anywhere; }.room-card p { font-size:10px; line-height:1.7; color:var(--muted); overflow-wrap:anywhere; }.room-preview-teams { display:flex; justify-content:space-between; gap:15px; margin:22px 0; }.room-preview-teams>span { display:flex; gap:5px; }.room-preview-teams i { display:grid; place-items:center; width:23px; height:26px; border-radius:5px; background:var(--line-soft); color:var(--subtle); }.room-preview-teams i.occupied { color:var(--yellow); background:var(--surface-tint); }.room-card-footer { display:flex; justify-content:space-between; gap:12px; font-size:11px; color:var(--muted); }.room-card-footer strong { display:flex; align-items:center; gap:5px; color:var(--text); }
.lobby-mine { display:flex; width:100%; align-items:center; gap:14px; padding:20px; margin-bottom:22px; border:0; border-radius:13px; color:var(--yellow); background:var(--surface-tint); text-align:left; }.lobby-mine span { flex:1; color:var(--muted); font-size:11px; }.lobby-mine strong { display:block; color:var(--text); font-size:15px; margin-top:5px; }.lobby-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:50px 20px; border-radius:17px; background:var(--panel); box-shadow:var(--shadow-soft); }.lobby-empty>span { display:grid; place-items:center; width:65px; height:65px; border-radius:17px; margin-bottom:20px; background:var(--surface-tint); color:var(--yellow); }.lobby-empty h3 { font-size:22px; font-weight:700; }.lobby-empty p { max-width:380px; font-size:12px; line-height:1.8; color:var(--muted); margin:12px 0 23px; }.lobby-footnote { display:flex; align-items:flex-start; gap:9px; margin-top:25px!important; font-size:11px; line-height:1.8; color:var(--muted); }.lobby-footnote svg { flex-shrink:0; margin-top:3px; color:var(--yellow); }.lobby-pagination { display:flex; align-items:center; justify-content:center; gap:20px; margin-top:24px; font-size:11px; }
.lobby-alert { display:flex; flex-wrap:wrap; gap:10px; padding:15px 18px; border-radius:10px; background:var(--surface-tint); color:var(--text); font-size:12px; line-height:1.8; margin:16px 0; }.lobby-alert a { display:inline-flex; align-items:center; color:var(--yellow); }.lobby-back { display:flex; align-items:center; gap:8px; padding:0; margin:26px 0 22px; border:0; background:none; color:var(--muted); font-size:12px!important; }
.lobby-room-hero { display:flex; align-items:center; justify-content:space-between; gap:20px; }.lobby-room-hero h2 { font-size:29px; font-weight:700; letter-spacing:-1px; margin:8px 0 10px; overflow-wrap:anywhere; }.lobby-room-hero p { color:var(--muted); font-size:12px; }.lobby-room-hero p i { padding:0 7px; font-style:normal; color:var(--subtle); }.lobby-room-actions { display:flex; flex-wrap:wrap; gap:8px; }.lobby-room-maps { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:24px 0; }.lobby-room-maps>span { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:11px; margin-right:5px; }.lobby-room-maps b { display:flex; gap:9px; padding:10px 12px; border-radius:8px; background:var(--panel); font-size:11px; }.lobby-room-maps small { color:var(--subtle); font-size:9px; }
.lobby-teams { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }.lobby-team { --team-color:var(--yellow); padding:20px; border-radius:16px; background:var(--panel); box-shadow:var(--shadow-soft); }.lobby-team.is-team-b { --team-color:#b18cdb; }.lobby-team header { display:flex; align-items:center; gap:11px; margin-bottom:20px; }.lobby-team header>span { display:grid; place-items:center; width:34px; height:34px; border-radius:10px; background:var(--surface-tint); color:var(--team-color); font-size:15px; font-weight:700; }.lobby-team h3 { min-width:0; flex:1; overflow-wrap:anywhere; font-size:16px; font-weight:700; }.lobby-team header small { color:var(--muted); font-size:11px; white-space:nowrap; }
.lobby-seat { display:flex; align-items:center; gap:12px; width:100%; padding:14px 10px; border:0; border-radius:10px; background:transparent; color:var(--muted); text-align:left; margin-top:5px; }.lobby-seat:disabled { opacity:1!important; cursor:default!important; }.lobby-seat:not(:disabled):hover,.lobby-seat.is-me { background:var(--surface-tint); }.seat-number { color:var(--subtle); font-size:10px; }.lobby-seat img,.seat-avatar { flex-shrink:0; display:grid; place-items:center; width:39px; height:39px; border-radius:50%; object-fit:cover; color:var(--team-color); background:var(--line-soft); }.seat-avatar.empty { border:1px dashed var(--line); background:none; color:var(--subtle); }.seat-player { display:flex; flex:1; min-width:0; flex-direction:column; gap:6px; }.seat-player strong { color:var(--text); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.seat-player small { font-size:9px; color:var(--muted); }.seat-crown { color:#d1a644; }.seat-connection { flex-shrink:0; width:7px; height:7px; border-radius:50%; background:var(--subtle); }.seat-connection.connected { background:#21b68c; box-shadow:0 0 0 4px #21b68c15; }
.lobby-countdown { display:flex; gap:18px; align-items:center; padding:22px; margin-bottom:22px; border-radius:14px; background:var(--surface-tint); color:var(--yellow); }.lobby-countdown>div { display:flex; flex-direction:column; gap:5px; flex-shrink:0; }.lobby-countdown strong { font-size:30px; font-weight:700; font-variant-numeric:tabular-nums; }.lobby-countdown span { font-size:9px; color:var(--muted); }.lobby-countdown p { font-size:11px; line-height:1.8; color:var(--muted); margin-left:auto; max-width:360px; }.lobby-connect { display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; align-items:center; padding:24px; border-radius:15px; background:var(--panel); box-shadow:var(--shadow-soft); margin-top:22px; }.lobby-connect h3 { font-size:21px; margin:8px 0 12px; }.lobby-connect p { display:flex; align-items:center; flex-wrap:wrap; gap:7px; font-size:11px; color:var(--muted); }.lobby-connect code { color:var(--text); overflow-wrap:anywhere; }.lobby-connect p button { display:flex; border:0; color:var(--muted); background:none; }.lobby-connect>div:last-child { display:flex; flex-wrap:wrap; gap:10px; }.lobby-controls { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:20px; margin-top:25px; }.lobby-controls>p { display:grid; grid-template-columns:auto 1fr; gap:7px; font-size:11px; color:var(--muted); }.lobby-controls>p svg { color:#d1a644; }.lobby-controls>p span { grid-column:2; font-size:10px; }.lobby-controls>div { display:flex; flex-wrap:wrap; gap:8px; }.lobby-result { display:flex; flex-direction:column; align-items:center; gap:15px; padding:40px 20px; border-radius:16px; background:var(--panel); color:var(--yellow); text-align:center; }.lobby-result h3 { color:var(--text); font-size:21px; }.lobby-result p { color:var(--muted); font-size:12px; }.lobby-copied { position:fixed; z-index:100; bottom:25px; left:50%; transform:translateX(-50%); padding:14px 22px; border-radius:10px; color:var(--text); background:var(--panel); box-shadow:var(--shadow-soft); font-size:12px; }
.lobby-dialog { position:fixed; max-height:90dvh; width:min(620px,calc(100vw - 30px)); padding:0; border:0; border-radius:18px; background:var(--panel); color:var(--text); box-shadow:var(--shadow-soft); margin:auto; }.lobby-dialog::backdrop { background:#020817b8; backdrop-filter:blur(5px); }.lobby-dialog form { padding:27px; }.lobby-dialog header { display:flex; justify-content:space-between; gap:15px; align-items:center; margin-bottom:24px; }.lobby-dialog h2 { font-size:23px; font-weight:700; margin-top:6px; }.lobby-dialog header button { border:0; padding:5px; background:none; color:var(--muted); }.lobby-field { display:flex; flex:1; min-width:0; flex-direction:column; gap:9px; font-size:11px; color:var(--muted); margin-top:16px; }.lobby-field input,.lobby-field select { width:100%; border:1px solid var(--line); border-radius:9px; padding:11px 12px; background:var(--bg); color:var(--text); font-size:12px; }.lobby-form-row { display:flex; gap:15px; }.lobby-dialog fieldset { padding:0; margin:24px 0 0; border:0; }.lobby-dialog legend { font-size:12px; font-weight:600; margin-bottom:12px; }.lobby-dialog legend small { color:var(--subtle); margin-left:8px; }.lobby-segments { display:flex; gap:7px; }.lobby-segments button { flex:1; border:0; border-radius:9px; padding:12px 8px; background:var(--line-soft); color:var(--muted); font-size:12px; }.lobby-segments button[aria-pressed=true] { color:var(--yellow); background:var(--surface-tint); box-shadow:inset 0 -2px var(--yellow); }.lobby-dialog fieldset p { color:var(--muted); font-size:10px; line-height:1.8; margin:10px 0; }.lobby-map-picker { display:flex; flex-wrap:wrap; gap:6px; }.lobby-map-picker button { display:flex; gap:8px; align-items:center; padding:8px 10px; border:0; border-radius:7px; font-size:10px; color:var(--muted); background:var(--line-soft); }.lobby-map-picker button[aria-pressed=true] { color:var(--yellow); background:var(--surface-tint); }.lobby-map-picker button span { font-size:9px; }.lobby-dialog-note { display:flex; align-items:flex-start; gap:8px; margin:22px 0!important; font-size:10px; line-height:1.8; color:var(--muted); }.lobby-dialog-note svg { flex-shrink:0; color:var(--yellow); margin-top:3px; }.lobby-dialog form>.lobby-primary { width:100%; }.lobby-check { display:flex; gap:8px; font-size:11px; margin-top:15px; color:var(--muted); }.is-password { max-width:380px; }.is-password .lobby-primary { margin-top:22px; }
@media(max-width:700px) { .lobby-toolbar { align-items:flex-start; flex-wrap:wrap; }.lobby-room-hero { flex-direction:column; align-items:flex-start; }.lobby-room-hero h2 { font-size:25px; }.lobby-teams { grid-template-columns:1fr; gap:14px; }.lobby-team { padding:15px; }.lobby-countdown { flex-wrap:wrap; padding:18px; }.lobby-countdown p { width:100%; margin-left:0; max-width:none; }.lobby-connect { padding:20px; }.lobby-connect h3 { font-size:18px; }.lobby-dialog form { padding:21px; }.lobby-form-row { flex-direction:column; gap:0; }.lobby-dialog h2 { font-size:21px; }.room-card-body { padding:18px; }.lobby-room-maps { gap:7px; }.lobby-controls>div { width:100%; }.lobby-controls .lobby-primary { flex:1; } }
</style>
