<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowUpRight, Users, RefreshCw } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { getFriends } from '../api'
import type { FriendSummary } from '../api'

const props=defineProps<{ userId: number }>()
const opened=defineModel<boolean>('open',{ default:false })
const route=useRoute()
const wrap=ref<HTMLElement | null>(null)
const friends=ref<FriendSummary[]>([])
const loading=ref(true)
const error=ref('')
let timer:ReturnType<typeof setInterval> | undefined
let activeUser:number | null=null
let disposed=false
const online=(friend:FriendSummary) => !friend.isBlocked && (friend.isOnline ?? (!!friend.lastSeenAt && Date.now()-Date.parse(friend.lastSeenAt)<5*60*1000))
const sorted=computed(()=>[...friends.value].sort((a,b)=>Number(online(b))-Number(online(a)) || a.nickname.localeCompare(b.nickname,'ru')))
const onlineCount=computed(()=>friends.value.filter(online).length)
const level=(friend:FriendSummary) => friend.warRating && friend.warRating.level>=1 && friend.warRating.level<=10 ? friend.warRating.level : 0
async function refresh() {
  const id=props.userId
  if(disposed || activeUser===id) return
  activeUser=id; loading.value=true; error.value=''
  try {
    const result=await getFriends()
    if(!disposed && props.userId===id) friends.value=result
  } catch(e) {
    if(!disposed && props.userId===id) error.value=e instanceof Error ? e.message : 'Не удалось загрузить друзей.'
  } finally {
    if(activeUser===id) activeUser=null
    if(!disposed && props.userId===id) loading.value=false
  }
}
function outside(event:PointerEvent) { if(event.target instanceof Node && !wrap.value?.contains(event.target)) opened.value=false }
function escape(event:KeyboardEvent) { if(event.key==='Escape' && opened.value) {opened.value=false;wrap.value?.querySelector<HTMLButtonElement>('.header-friends-button')?.focus()} }
watch(opened,value=>{if(value) void refresh()})
watch(()=>route.fullPath,()=>{opened.value=false})
watch(()=>props.userId,()=>{friends.value=[];opened.value=false;void refresh()})
onMounted(()=>{
  void refresh()
  timer=setInterval(()=>{if(!document.hidden)void refresh()},30000)
  window.addEventListener('pointerdown',outside)
  window.addEventListener('keydown',escape)
})
onUnmounted(()=>{disposed=true;if(timer)clearInterval(timer);window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape)})
</script>

<template>
  <div ref="wrap" class="header-friends">
    <button class="header-friends-button" type="button" :aria-expanded="opened" aria-haspopup="dialog" :aria-label="`Друзья${onlineCount ? `: ${onlineCount} в сети` : ''}`" @click="opened=!opened">
      <Users :size="15" /><span class="header-friends-label">Друзья</span><span v-if="onlineCount" class="friends-online-badge">{{ onlineCount }}</span>
    </button>
    <Transition name="account-menu">
      <section v-if="opened" class="header-friends-panel" role="dialog" aria-label="Список друзей">
        <header><div><strong>Друзья</strong><small>{{ onlineCount }} в сети · {{ friends.length }} всего</small></div><button type="button" :disabled="loading" aria-label="Обновить друзей" v-tooltip="'Обновить список'" @click="refresh"><RefreshCw :size="14" :class="{ 'is-spinning': loading }" /></button></header>
        <p v-if="error" class="friends-panel-message" role="alert">{{ error }}</p>
        <p v-else-if="loading && !friends.length" class="friends-panel-message" role="status">Загружаем друзей…</p>
        <div v-else-if="friends.length" class="header-friends-list">
          <RouterLink v-for="friend in sorted" :key="friend.id" class="header-friend" :to="{ name:'profile',params:{nickname:friend.nickname} }" @click="opened=false">
            <span class="header-friend-avatar"><img v-if="friend.avatarUrl" :src="friend.avatarUrl" alt="" /><span v-else>{{ friend.nickname.slice(0,1).toUpperCase() }}</span><i :class="{ 'is-online': online(friend), 'is-blocked':friend.isBlocked }" :aria-label="friend.isBlocked ? 'Заблокирован' : online(friend) ? 'В сети' : 'Не в сети'"></i></span>
            <span class="header-friend-name"><strong>{{ friend.nickname }}</strong><small :class="{ 'is-online':online(friend), 'is-blocked':friend.isBlocked }">{{ friend.isBlocked ? 'Заблокирован' : online(friend) ? 'В сети' : 'Не в сети' }}</small></span>
            <span v-if="!friend.isBlocked" class="header-friend-rating" v-tooltip="level(friend) ? `Уровень ${level(friend)}` : 'Unknown'"><img :src="`/icons/levels/level-${level(friend)}.svg`" :alt="level(friend) ? `Уровень ${level(friend)}` : 'Unknown'" /><span>{{ friend.warRating?.elo ?? '—' }} <small>ELO</small></span></span>
          </RouterLink>
        </div>
        <p v-else class="friends-panel-message">Пока нет друзей. Найдите знакомых игроков и добавьте их в друзья.</p>
        <RouterLink class="header-friends-all" to="/friends" @click="opened=false">Все друзья <ArrowUpRight :size="14" /></RouterLink>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.header-friends { position:relative; flex-shrink:0; }
.header-friends-button { position:relative; display:flex; align-items:center; gap:7px; height:28px; padding:0 9px; border:0; border-radius:0; color:var(--muted); background:var(--panel); font:inherit; font-size:10px; cursor:pointer; }
.header-friends-button:hover,.header-friends-button[aria-expanded=true] { color:var(--text); background:var(--surface-tint); }
.friends-online-badge { display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; box-sizing:border-box; min-width:17px; height:17px; padding:0 4px; border-radius:5px; color:#fff; background:#15976c; font-size:10px; font-weight:600; font-variant-numeric:tabular-nums; line-height:1; }
.header-friends-panel { position:absolute; z-index:15; top:calc(100% + 12px); right:0; width:350px; max-width:calc(100vw - 30px); border-radius:8px; background:var(--panel); box-shadow:var(--shadow-soft); color:var(--text); overflow:hidden; }
.header-friends-panel>header { display:flex; align-items:center; justify-content:space-between; padding:16px; border-bottom:1px solid var(--line-soft); }
.header-friends-panel>header>div { display:grid; gap:5px; }
.header-friends-panel>header strong { font-size:12px; }
.header-friends-panel>header small { color:var(--muted); font-size:9px; }
.header-friends-panel>header button { display:grid; place-items:center; width:27px; height:27px; padding:0; border:0; border-radius:5px; background:var(--surface-tint); color:var(--muted); cursor:pointer; }
.header-friends-panel button:disabled { opacity:.5; cursor:wait; }
.header-friends-list { max-height:340px; overflow-y:auto; overscroll-behavior:contain; }
.header-friend { display:flex; align-items:center; gap:10px; padding:12px 16px; color:var(--text); text-decoration:none; }
.header-friend:hover { background:var(--surface-tint); }
.header-friend+.header-friend { border-top:1px solid var(--line-soft); }
.header-friend-avatar { position:relative; flex-shrink:0; width:34px; height:34px; }
.header-friend-avatar>img,.header-friend-avatar>span { display:grid; place-items:center; width:34px; height:34px; border-radius:50%; object-fit:cover; background:var(--surface-tint); color:var(--yellow); font-size:12px; font-weight:600; }
.header-friend-avatar i { position:absolute; right:-1px; bottom:-1px; width:10px; height:10px; border:2px solid var(--panel); border-radius:50%; background:var(--subtle); }
.header-friend-avatar i.is-online { background:#1fbd84; }
.header-friend-avatar i.is-blocked { background:#e05260; }
.header-friend-name { display:grid; flex:1; min-width:0; gap:5px; }
.header-friend-name strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:600; }
.header-friend-name small { font-size:9px; color:var(--subtle); }
.header-friend-name small.is-online { color:#15976c; }
.header-friend-name small.is-blocked { color:#e05260; }
.header-friend-rating { display:flex; align-items:center; gap:6px; flex-shrink:0; font-size:11px; white-space:nowrap; }
.header-friend-rating>img { width:25px; height:25px; }
.header-friend-rating small { color:var(--subtle); font-size:8px; }
.friends-panel-message { margin:0; padding:22px 16px; color:var(--muted); font-size:11px; line-height:1.7; }
.header-friends-all { display:flex; align-items:center; justify-content:space-between; padding:13px 16px; border-top:1px solid var(--line-soft); color:var(--yellow); font-size:10px; text-decoration:none; }
@media(max-width:720px) {
  .header-friends-label { display:none; }
  .header-friends-button { width:30px; padding:0; justify-content:center; }
  .friends-online-badge { position:absolute; top:-5px; right:-5px; min-width:16px; height:16px; padding:0 4px; font-size:9px; }
  .header-friends-panel { position:fixed; top:63px; right:15px; width:350px; }
}
</style>
