<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Ban, Check, Crown, Timer, Swords } from '@lucide/vue'
import type { LobbyRoom } from '../api'
import { matchMapImage, handleMapImageError } from '../matchArtwork'
const props=defineProps<{room: LobbyRoom; userId?: number; busy: boolean; now: number; enabled: boolean}>()
const emit=defineEmits<{begin:[captains:number[]]; choose:[map:string]}>()
const captains=ref<number[]>([])
watch(()=>[props.room.id,props.room.members.map(m=>`${m.userId}:${m.team}`).join(',')],()=>{
  captains.value=[1,2].map(team=>props.room.members.find(m=>m.team===team && m.userId===captains.value[team-1])?.userId
    ?? props.room.members.find(m=>m.team===team && m.userId===props.room.captainId)?.userId
    ?? props.room.members.filter(m=>m.team===team).sort((a,b)=>a.seat-b.seat)[0]?.userId ?? 0)
},{immediate:true})
const owner=computed(()=>props.userId===props.room.captainId)
const veto=computed(()=>props.room.veto)
const step=computed(()=>veto.value?.history.length ?? 0)
const turn=computed(()=>veto.value ? (step.value%2===0 ? veto.value.firstTeam : 3-veto.value.firstTeam) : 1)
const action=computed(()=>props.room.format==='BO1' || step.value<2 || (props.room.format==='BO3' && step.value>=4) ? 'ban' : 'pick')
const seconds=computed(()=>veto.value?.deadline ? Math.max(0,Math.ceil((Date.parse(veto.value.deadline)-props.now)/1000)) : 30)
const canChoose=computed(()=>props.enabled && !props.busy && props.room.status==='waiting' && veto.value && !veto.value.complete && seconds.value>0 && veto.value.captains[turn.value-1]===props.userId)
const teamName=(team:number|null)=>team===1 ? props.room.teamAName : team===2 ? props.room.teamBName : 'Решающая карта'
const selection=(map:string)=>veto.value?.history.find(item=>item.map===map)
</script>

<template>
  <section class="veto-panel" aria-labelledby="veto-title">
    <header class="veto-heading"><div><span class="section-kicker">MAP VETO · {{ room.format }}</span><h3 id="veto-title">{{ veto?.complete ? 'Карты определены' : 'Пики и баны' }}</h3></div><span v-if="veto && !veto.complete" class="veto-clock"><Timer :size="17" />{{ seconds }} c</span><Check v-else-if="veto?.complete" :size="24" /></header>
    <template v-if="!veto">
      <p>Семь карт. Капитаны ходят по очереди, первый ход определяется случайно. На решение — 30 секунд, затем карта выбирается автоматически.</p>
      <div class="veto-captains"><label v-for="team in [1,2]" :key="team"><span><Crown :size="14" />Капитан · {{ teamName(team) }}</span><select v-model.number="captains[team-1]" :disabled="!owner || busy || !enabled"><option :value="0" disabled>Ожидаем игроков</option><option v-for="member in room.members.filter(m=>m.team===team)" :key="member.userId" :value="member.userId">{{ member.nickname }}</option></select></label></div>
      <button v-if="owner && room.status==='waiting'" type="button" class="veto-start" :disabled="busy || !enabled || room.members.length!==room.teamSize*2 || captains.includes(0)" @click="emit('begin',captains)"><Swords :size="16" />Начать выбор карт</button>
      <p v-else>Выбор запускает создатель комнаты после заполнения команд.</p>
    </template>
    <p v-else-if="!veto.complete" class="veto-turn" aria-live="polite"><strong>{{ teamName(turn) }}</strong> · {{ room.members.find(m=>m.userId===veto!.captains[turn-1])?.nickname }} {{ action==='ban' ? 'банит карту' : 'выбирает карту' }}<span v-if="canChoose">Ваш ход — нажмите на карту</span></p>
    <p v-else>Порядок игры готов. Создатель комнаты может запустить матч.</p>
    <div class="veto-maps"><button v-for="map in room.mapPool" :key="map" type="button" class="veto-map" :class="[selection(map)?.action,{'is-available':canChoose && veto?.remaining.includes(map)}]" :disabled="!canChoose || !veto?.remaining.includes(map)" :aria-label="`${action==='ban'?'Забанить':'Выбрать'} ${map}`" @click="emit('choose',map)"><img v-if="matchMapImage(map)" :src="matchMapImage(map)!" alt="" @error="handleMapImageError" /><span class="veto-map-content"><span class="veto-map-state"><Ban v-if="selection(map)?.action==='ban'" :size="15" /><Check v-else-if="selection(map)" :size="15" />{{ selection(map)?.action==='ban' ? 'Бан' : selection(map)?.action==='pick' ? 'Пик' : selection(map) ? 'Решающая' : 'В пуле' }}</span><strong>{{ map }}</strong><small v-if="selection(map)">{{ teamName(selection(map)!.team) }}</small></span></button></div>
    <ol v-if="veto?.history.length" class="veto-history"><li v-for="(item,index) in veto.history" :key="item.map"><span>{{ String(index+1).padStart(2,'0') }}</span><Ban v-if="item.action==='ban'" :size="14" /><Check v-else :size="14" /><div><strong>{{ item.map }}</strong><small>{{ teamName(item.team) }} · {{ item.action==='ban'?'бан':item.action==='pick'?'пик':'последняя карта' }}{{ item.automatic && item.action!=='decider'?' · автоматически':'' }}</small></div></li></ol>
    <small class="veto-note" v-if="room.status==='waiting'">После начала выбора состав и настройки фиксируются. Выход или исключение участника сбросит выбор карт.</small>
  </section>
</template>

<style scoped>
.veto-panel{padding:24px;background:var(--panel);border-radius:18px;box-shadow:0 12px 30px #0002;margin-bottom:24px;min-width:0}.veto-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:14px;color:var(--yellow)}.veto-heading h3{color:var(--text);font-size:21px;margin:5px 0 0}.veto-panel p{color:var(--muted);font-size:12px;line-height:1.7;margin:0 0 16px}.veto-clock{display:flex;gap:8px;align-items:center;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}.veto-captains{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}.veto-captains label{min-width:0;display:grid;gap:9px;font-size:12px}.veto-captains label span{display:flex;gap:7px;color:var(--muted)}.veto-captains select{width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);font:inherit}.veto-start{display:flex;align-items:center;gap:8px;background:var(--yellow);color:var(--bg);padding:12px 18px;border:0;border-radius:8px;font:inherit;font-weight:700;margin-bottom:20px}.veto-start:disabled{opacity:.5}.veto-turn strong{color:var(--text)}.veto-turn span{display:block;color:var(--yellow)}.veto-maps{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.veto-map{position:relative;isolation:isolate;min-height:165px;overflow:hidden;border:2px solid transparent;border-radius:11px;background:#152333;color:#fff;text-align:left;padding:12px;display:flex;align-items:end;transition:border-color .2s,filter .2s;font:inherit}.veto-map img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}.veto-map:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#07111a10,#07111af5);z-index:-1}.veto-map:disabled{opacity:1;cursor:default}.veto-map.ban{filter:grayscale(1);opacity:.5}.veto-map.pick,.veto-map.decider{border-color:#56cba5}.veto-map.is-available{cursor:pointer}.veto-map.is-available:hover,.veto-map.is-available:focus-visible{border-color:var(--yellow);outline:0}.veto-map-content{display:grid;gap:8px;min-width:0}.veto-map-content strong{font-size:12px;overflow-wrap:anywhere}.veto-map-content small{font-size:10px;color:#b4c5d5}.veto-map-state{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.veto-history{list-style:none;padding:0;margin:18px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px}.veto-history li{display:flex;align-items:center;gap:10px;background:var(--line-soft);padding:10px;border-radius:8px;font-size:11px;color:var(--muted)}.veto-history li>span{color:var(--subtle);font-size:10px}.veto-history strong,.veto-history small{display:block;overflow-wrap:anywhere}.veto-history strong{color:var(--text);margin-bottom:4px}.veto-note{display:block;margin-top:16px;color:var(--subtle);font-size:11px;line-height:1.7}@media(max-width:600px){.veto-panel{padding:16px}.veto-captains{grid-template-columns:1fr}.veto-maps{grid-template-columns:repeat(2,minmax(0,1fr))}.veto-map{min-height:145px}.veto-history{grid-template-columns:1fr}}
</style>
