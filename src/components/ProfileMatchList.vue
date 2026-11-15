<script setup lang="ts">
import { Trophy, ChevronRight } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import type { GameMatch } from '../api'
import { handleMapImageError, matchMapImage } from '../matchArtwork'
import { formatMatchDuration } from '../matchDuration'

defineProps<{ matches: GameMatch[]; mode: 'Mix' | 'War' }>()
const number=(value:number | null | undefined, decimals=0)=>value==null?'—':value.toFixed(decimals)
function date(value:string) {
  const d=new Date(value)
  return Number.isNaN(d.getTime())?{day:'Дата неизвестна',time:'—',full:''}:{
    day:d.toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short'}),
    time:d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),full:d.toLocaleString('ru-RU'),
  }
}
function result(match:GameMatch) {
  if(match.status==='cancelled')return {label:'Отменён',short:'×',kind:'cancelled'}
  if(match.status==='live')return {label:'В процессе',short:'LIVE',kind:'live'}
  if(match.status==='preparing')return {label:'Подготовка',short:'…',kind:'preparing'}
  return match.playerResult==='win'?{label:'Победа',short:'W',kind:'win'}:
    match.playerResult==='loss'?{label:'Поражение',short:'L',kind:'loss'}:
    match.playerResult==='draw'?{label:'Ничья',short:'Н',kind:'draw'}:{label:'Нет результата',short:'—',kind:'unknown'}
}
function score(match:GameMatch) {
  return match.playerScore!=null && match.opponentScore!=null
    ? [match.playerScore,match.opponentScore] : [match.teamA.score,match.teamB.score]
}
function level(match:GameMatch) { const n=match.playerStats?.level;return n && n>=1 && n<=10?n:0 }
</script>

<template>
  <div v-if="matches.length" class="player-match-history" :class="{ 'is-war': mode==='War' }">
    <div class="player-match-head" aria-hidden="true"><span>Дата</span><span>Результат</span><span v-if="mode==='War'">ELO</span><span>KAST</span><span>K / D / A</span><span>K / D</span><span>ADR</span><span>Карта</span><span></span></div>
    <div class="player-match-rows">
      <RouterLink v-for="match in matches" :key="match.id" class="player-match-row" :class="`is-${result(match).kind}`"
        :to="{ name:'match-detail',params:{id:match.id} }" :aria-label="`${match.map}, ${result(match).label}, матч ${match.id}`">
        <span class="player-match-date" v-tooltip="date(match.updatedAt).full"><strong>{{ date(match.updatedAt).day }}</strong><small>{{ date(match.updatedAt).time }}</small></span>
        <span class="player-match-result" v-tooltip="`${result(match).label} · ${match.scoreType==='maps'?'Счёт по картам':'Счёт по раундам'}`"><span class="player-match-outcome">{{ result(match).short }}</span><span class="player-match-score"><b>{{ score(match)[0] ?? '—' }}</b><i>:</i>{{ score(match)[1] ?? '—' }}</span></span>
        <span v-if="mode==='War'" class="player-match-elo" v-tooltip="'Сохранённый ELO на момент матча'"><img :src="`/icons/levels/level-${level(match)}.svg`" :alt="level(match)?`Уровень ${level(match)}`:'Unknown'" /><span>{{ match.playerStats?.elo ?? '—' }}</span></span>
        <span class="player-match-metrics">
          <span class="player-match-kast" v-tooltip="'Процент раундов с убийством, ассистом, выживанием или разменом'"><small class="match-cell-label">KAST</small><span class="kast-badge" :class="{ 'is-good':(match.playerStats?.kast??0)>=75 }" :style="{ '--kast':`${Math.min(100,Math.max(0,match.playerStats?.kast??0))}%` }">{{ number(match.playerStats?.kast,1) }}<small v-if="match.playerStats?.kast!=null">%</small></span></span>
          <span class="player-match-kda" v-tooltip="'Убийства / смерти / ассисты'"><small class="match-cell-label">K / D / A</small><span>{{ number(match.playerStats?.kills) }}<i>/</i>{{ number(match.playerStats?.deaths) }}<i>/</i>{{ number(match.playerStats?.assists) }}</span></span>
          <span class="player-match-kdr" v-tooltip="'Соотношение убийств и смертей'"><small class="match-cell-label">K / D</small><span>{{ number(match.playerStats?.kdr,2) }}</span></span>
          <span class="player-match-adr" v-tooltip="'Средний урон за раунд'"><small class="match-cell-label">ADR</small><span>{{ number(match.playerStats?.adr,1) }}</span></span>
        </span>
        <span class="player-match-map" v-tooltip="`${match.map} · ${match.serverName??'Игровой сервер'}`"><img v-if="matchMapImage(match.map)" :src="matchMapImage(match.map)??undefined" alt="" loading="lazy" @error="handleMapImageError" /><span><strong>{{ match.map }}</strong><small>{{ match.format??'Classic' }} · {{ formatMatchDuration(match.durationSeconds) }}</small></span></span>
        <ChevronRight class="player-match-arrow" :size="14" />
      </RouterLink>
    </div>
  </div>
  <div v-else class="empty-state section-empty matches-empty" role="status"><span class="empty-icon"><Trophy :size="21" /></span><div><strong>Матчей {{ mode }} пока нет</strong><span>Матчи этого режима появятся после участия игрока с привязанным Steam ID.</span></div></div>
</template>

<style scoped>
.player-match-history { container:player-matches / inline-size; --columns:minmax(72px,.6fr) minmax(84px,1fr) 55px minmax(92px,1fr) 48px 55px minmax(115px,1.3fr) 14px; }
.player-match-history.is-war { --columns:minmax(72px,.6fr) minmax(84px,1fr) minmax(72px,.85fr) 55px minmax(92px,1fr) 48px 55px minmax(115px,1.3fr) 14px; }
.player-match-head,.player-match-row { display:grid; grid-template-columns:var(--columns); align-items:center; gap:10px; padding:0 14px; }
.player-match-head { padding-top:3px; padding-bottom:12px; border-left:3px solid transparent; color:var(--subtle); font-size:9px; font-weight:500; }
.player-match-head>span { text-align:center; }
.player-match-head>span:first-child,.player-match-head>span:nth-last-child(2) { text-align:left; }
.player-match-result,.player-match-elo { justify-content:center; }
.player-match-kast,.player-match-kda,.player-match-kdr,.player-match-adr { text-align:center; }
.player-match-rows { display:grid; gap:5px; }
.player-match-row { --result:var(--subtle); min-height:60px; padding-top:10px; padding-bottom:10px; border-left:3px solid var(--result); border-radius:4px; color:var(--text); background:var(--panel); text-decoration:none; box-shadow:0 2px 8px rgb(0 0 0 / .04); transition:background-color .15s; font-size:11px; }
.player-match-row:hover { background:var(--surface-tint); }
.player-match-row.is-win { --result:#20b97b; }.player-match-row.is-loss { --result:#e85c6d; }.player-match-row.is-draw { --result:#c79c42; }.player-match-row.is-live { --result:var(--yellow); }
.player-match-date { display:grid; gap:5px; }.player-match-date strong { font-weight:500; white-space:nowrap; }.player-match-date small { color:var(--subtle); font-size:9px; }
.player-match-result { display:flex; align-items:center; gap:8px; }.player-match-outcome { display:grid; place-items:center; min-width:19px; height:20px; padding:0 3px; border-radius:4px; background:color-mix(in srgb,var(--result) 16%,transparent); color:var(--result); font-size:10px; font-weight:700; }
.player-match-score { display:flex; align-items:center; gap:4px; white-space:nowrap; }.player-match-score b { color:var(--result); font-weight:600; }.player-match-score i,.player-match-kda i { color:var(--subtle); font-style:normal; }
.player-match-elo { display:flex; align-items:center; gap:7px; white-space:nowrap; }.player-match-elo img { width:23px; height:23px; }
.player-match-metrics { display:contents; }.match-cell-label { display:none; }
.kast-badge { position:relative; display:inline-flex; align-items:baseline; gap:1px; padding:5px 4px; border-radius:4px; background:var(--line-soft); font-size:10px; font-weight:600; overflow:hidden; }.kast-badge:after { position:absolute; bottom:0; left:0; width:var(--kast); height:2px; background:var(--muted); content:''; }.kast-badge small { font-size:7px; font-weight:400; }.kast-badge.is-good { color:#15976c; background:rgb(31 189 132 / .1); }.kast-badge.is-good:after { background:#1fbd84; }
.player-match-kda>span { display:flex; align-items:center; justify-content:center; gap:3px; white-space:nowrap; }.player-match-kdr,.player-match-adr { white-space:nowrap; }
.player-match-map { display:flex; align-items:center; gap:9px; min-width:0; }.player-match-map>img { width:32px; height:29px; object-fit:cover; border-radius:4px; flex-shrink:0; }.player-match-map>span { display:grid; gap:5px; min-width:0; }.player-match-map strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; font-weight:500; }.player-match-map small { color:var(--subtle); font-size:8px; white-space:nowrap; }.player-match-arrow { color:var(--subtle); }
@container player-matches (max-width:800px) {
  .player-match-head { display:none; }
  .player-match-row { grid-template-columns:minmax(0,1fr) auto; gap:12px 10px; padding:13px 14px; }
  .player-match-date { grid-column:1; grid-row:1; display:flex; align-items:baseline; gap:8px; }
  .player-match-result { grid-column:2; grid-row:1; justify-self:end; }
  .player-match-map { grid-column:1; grid-row:2; }.player-match-map>span { gap:4px; }.player-match-map strong { font-size:11px; }
  .player-match-elo { grid-column:2; grid-row:2; justify-self:end; }
  .player-match-metrics { grid-column:1/-1; grid-row:3; display:grid; grid-template-columns:.9fr 1.6fr .9fr 1fr; gap:8px; padding-top:10px; border-top:1px solid var(--line-soft); }
  .player-match-metrics>span { display:grid; justify-items:start; gap:6px; font-size:11px; text-align:left; }
  .player-match-kda>span { justify-content:flex-start; }
  .match-cell-label { display:block; color:var(--subtle); font-size:8px; font-weight:400; }
  .player-match-arrow { display:none; }
}
</style>
