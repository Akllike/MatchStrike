<script setup lang="ts">
import { computed } from 'vue'
import { Ban, Check, Timer, Swords } from '@lucide/vue'
import type { LobbyRoom } from '../api'
import { matchMapImage, handleMapImageError } from '../matchArtwork'

const props = defineProps<{ room: LobbyRoom; userId?: number; busy: boolean; now: number; enabled: boolean }>()
const emit = defineEmits<{ choose: [map: string] }>()
const veto = computed(() => props.room.veto)
const step = computed(() => veto.value?.history.length ?? 0)
const turn = computed(() => veto.value ? (step.value % 2 === 0 ? veto.value.firstTeam : 3 - veto.value.firstTeam) : 1)
const action = computed(() => props.room.format === 'BO1' || step.value < 2 || (props.room.format === 'BO3' && step.value >= 4) ? 'ban' : 'pick')
const seconds = computed(() => veto.value?.deadline ? Math.max(0, Math.ceil((Date.parse(veto.value.deadline) - props.now) / 1000)) : 30)
const canChoose = computed(() => props.enabled && !props.busy && props.room.status === 'waiting' && veto.value
  && !veto.value.complete && seconds.value > 0 && veto.value.captains[turn.value - 1] === props.userId)
const turnPlayer = computed(() => veto.value?.captains[turn.value - 1])
const turnNickname = computed(() => props.room.members.find(member => member.userId === turnPlayer.value)?.nickname ?? 'Капитан')
const teamName = (team: number | null) => team === 1 ? props.room.teamAName : team === 2 ? props.room.teamBName : 'Решающая карта'
const selection = (map: string) => veto.value?.history.find(item => item.map === map)
const mapTitle = (map: string) => {
  const title = map.replace(/^de_/, '').replace(/_(?:ob|csgo(?:_v\d+)?(?:_fix)?)$/i, '').replaceAll('_', ' ')
  return title === 'dust2' ? 'Dust II' : title.replace(/\b\w/g, char => char.toUpperCase())
}
const turnPlan = computed(() => {
  if (!veto.value) return []
  const actions = props.room.format === 'BO1' ? Array(6).fill('ban')
    : props.room.format === 'BO3' ? ['ban', 'ban', 'pick', 'pick', 'ban', 'ban']
      : ['ban', 'ban', 'pick', 'pick', 'pick', 'pick']
  return Array.from({ length: 7 }, (_, index) => {
    const history = veto.value!.history[index]
    const currentAction = index === 6 ? 'decider' : actions[index]
    const team = index === 6 ? null : index % 2 === 0 ? veto.value!.firstTeam : 3 - veto.value!.firstTeam
    return { action: currentAction, team, complete: Boolean(history), current: !veto.value!.complete && index === step.value,
      map: history?.map ?? null, automatic: history?.automatic ?? false }
  })
})
const timerPercent = computed(() => `${Math.min(100, Math.max(0, seconds.value / 30 * 100))}%`)
</script>

<template>
  <section class="veto-panel" aria-labelledby="veto-title">
    <header class="veto-heading">
      <div><span class="veto-kicker">КАРТЫ · {{ room.format }}</span><h3 id="veto-title">{{ veto?.complete ? 'Порядок карт' : 'Пики и баны' }}</h3></div>
      <span v-if="veto && !veto.complete" class="veto-clock" :aria-label="`Осталось ${seconds} секунд`"><Timer :size="17" />{{ seconds }}<small>сек.</small></span>
    <span v-else-if="veto?.complete" class="veto-complete"><Check :size="16" /> {{ room.status === 'waiting' ? 'Ищем сервер' : 'Готовим сервер' }}</span>
    </header>

    <template v-if="veto">
      <div class="veto-turn-card" :class="{ 'is-complete': veto.complete }" aria-live="polite">
        <span class="veto-turn-icon"><Check v-if="veto.complete" :size="19" /><Ban v-else-if="action === 'ban'" :size="19" /><Swords v-else :size="19" /></span>
        <div class="veto-turn-copy">
          <span class="veto-turn-label">{{ veto.complete ? 'ВЫБОР ЗАВЕРШЁН' : `ХОД ${String(step + 1).padStart(2, '0')} ИЗ 06 · ${action === 'ban' ? 'БАН' : 'ПИК'}` }}</span>
          <strong v-if="!veto.complete">{{ teamName(turn) }} <i>·</i> {{ turnNickname }} {{ action === 'ban' ? 'банит карту' : 'выбирает карту' }}</strong>
          <strong v-else>Карты серии определены в порядке игры</strong>
          <span v-if="canChoose" class="veto-your-turn">Ваш ход — выберите карту ниже</span>
          <span v-else-if="!veto.complete" class="veto-waiting-turn">Ожидаем решение капитана · автоматически через {{ seconds }} сек.</span>
        </div>
        <span v-if="!veto.complete" class="veto-timer-track" aria-hidden="true"><i :style="{ width: timerPercent }"></i></span>
      </div>

      <ol class="veto-sequence" aria-label="Порядок выбора карт">
        <li v-for="(item, index) in turnPlan" :key="index" :class="[{ 'is-current': item.current, 'is-complete': item.complete, 'is-decider': item.action === 'decider' }, `is-${item.action}`]">
          <span>{{ item.complete ? '✓' : String(index + 1).padStart(2, '0') }}</span><strong>{{ item.action === 'ban' ? 'Бан' : item.action === 'pick' ? 'Пик' : 'Решение' }}</strong>
          <small>{{ item.complete ? item.map : teamName(item.team) }}</small>
        </li>
      </ol>
    </template>

    <div class="veto-map-grid" :class="{ 'is-choosing': canChoose }">
      <button v-for="(map, index) in room.mapPool" :key="map" type="button" class="veto-map-card"
        :class="[{ 'is-available': canChoose && veto?.remaining.includes(map), 'is-banned': selection(map)?.action === 'ban', 'is-picked': selection(map)?.action === 'pick', 'is-decider': selection(map)?.action === 'decider' }, `map-${index + 1}`]"
        :disabled="!canChoose || !veto?.remaining.includes(map)" :aria-label="`${action === 'ban' ? 'Забанить' : 'Выбрать'} карту ${map}`" @click="emit('choose', map)">
        <img v-if="matchMapImage(map)" :src="matchMapImage(map)!" alt="" loading="lazy" @error="handleMapImageError" />
        <span class="veto-map-overlay"></span>
        <span class="veto-map-badge" :class="{ 'is-current': canChoose && veto?.remaining.includes(map), 'is-ban': selection(map)?.action === 'ban', 'is-pick': selection(map)?.action === 'pick', 'is-decider': selection(map)?.action === 'decider' }">
          <Ban v-if="selection(map)?.action === 'ban'" :size="12" /><Check v-else-if="selection(map)" :size="12" />
          {{ selection(map)?.action === 'ban' ? 'Забанена' : selection(map)?.action === 'pick' ? 'Выбрана' : selection(map)?.action === 'decider' ? 'Решающая' : canChoose && veto?.remaining.includes(map) ? (action === 'ban' ? 'Бан · выбрать' : 'Пик · выбрать') : 'В пуле' }}
        </span>
        <span class="veto-map-name"><strong>{{ mapTitle(map) }}</strong><small>{{ map }}</small></span>
        <span v-if="selection(map)" class="veto-map-team">{{ teamName(selection(map)!.team) }}</span>
        <span v-else class="veto-map-index">{{ String(index + 1).padStart(2, '0') }}</span>
      </button>
    </div>

    <footer class="veto-footer"><span><i></i> {{ room.mapPool.length }} карт в выборе</span><span v-if="veto && !veto.complete">Ход переходит автоматически по таймеру</span><span v-else-if="veto?.complete">{{ room.status === 'waiting' ? 'Ожидаем свободный сервер · запуск произойдёт автоматически' : 'Сервер готовится · подключение откроется здесь' }}</span></footer>
  </section>
</template>

<style scoped>
.veto-panel{position:relative;overflow:hidden;min-width:0;margin:0 0 24px;padding:24px;border:0;border-radius:18px;background:var(--panel);box-shadow:var(--shadow-soft);font-family:'Onest',sans-serif;color:var(--text)}
.veto-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.veto-kicker{color:var(--yellow-dim);font-size:10px;font-weight:700;letter-spacing:.1em}.veto-heading h3{margin:4px 0 0;color:var(--text);font-family:'Onest',sans-serif;font-size:22px;font-weight:700;letter-spacing:-.035em;line-height:1.2}.veto-clock,.veto-complete{display:flex;align-items:center;gap:7px;color:var(--yellow-dim);font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}.veto-clock small{font-size:11px;font-weight:600}.veto-complete{color:#10b981;font-size:12px}
.veto-intro{display:flex;align-items:center;gap:13px;margin-bottom:18px;padding:15px 16px;border:1px solid var(--line-soft);border-radius:12px;background:color-mix(in srgb,var(--panel) 74%,var(--bg))}.veto-intro-icon{display:grid;width:38px;height:38px;flex:none;place-items:center;border-radius:10px;background:var(--surface-tint);color:var(--yellow)}.veto-intro strong{font-size:13px;font-weight:700}.veto-intro p,.veto-owner-note{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.6}.veto-captains{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}.veto-captains label{display:grid;min-width:0;gap:8px;padding:12px;border:1px solid var(--line-soft);border-radius:11px;background:var(--panel)}.veto-captains label>span{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:11px;font-weight:600}.veto-captains select{width:100%;min-height:40px;padding:8px 11px;border:1px solid var(--line);border-radius:8px;outline:none;background:var(--bg);color:var(--text);font-family:'Onest',sans-serif;font-size:12px}.veto-captains select:focus-visible{border-color:var(--yellow);box-shadow:0 0 0 3px color-mix(in srgb,var(--yellow) 18%,transparent)}.veto-start{display:inline-flex;min-height:42px;align-items:center;gap:8px;padding:0 16px;border:0;border-radius:8px;background:var(--yellow);color:#fff;font-family:'Onest',sans-serif;font-size:12px;font-weight:700;box-shadow:0 5px 16px color-mix(in srgb,var(--yellow) 24%,transparent);transition:filter .18s,transform .18s}.veto-start:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}.veto-start:disabled{opacity:.48;cursor:not-allowed}.veto-owner-note{display:inline-block;margin:0 0 18px;padding:10px 12px;border-radius:8px;background:var(--line-soft)}
.veto-turn-card{position:relative;display:flex;min-height:76px;align-items:center;gap:13px;overflow:hidden;margin-bottom:14px;padding:13px 16px 17px;border:1px solid color-mix(in srgb,var(--yellow) 28%,var(--line));border-radius:12px;background:linear-gradient(110deg,color-mix(in srgb,var(--yellow) 11%,var(--panel)),var(--panel) 56%)}.veto-turn-card.is-complete{border-color:color-mix(in srgb,#10b981 28%,var(--line));background:linear-gradient(110deg,color-mix(in srgb,#10b981 10%,var(--panel)),var(--panel) 56%)}.veto-turn-icon{display:grid;width:42px;height:42px;flex:none;place-items:center;border-radius:11px;background:color-mix(in srgb,var(--yellow) 14%,var(--panel));color:var(--yellow)}.is-complete .veto-turn-icon{background:color-mix(in srgb,#10b981 14%,var(--panel));color:#10b981}.veto-turn-copy{display:grid;gap:3px;min-width:0}.veto-turn-label{color:var(--yellow-dim);font-size:9px;font-weight:700;letter-spacing:.09em}.veto-turn-copy strong{color:var(--text);font-size:13px;font-weight:700}.veto-turn-copy strong i{padding:0 3px;color:var(--subtle);font-style:normal}.veto-your-turn,.veto-waiting-turn{color:var(--muted);font-size:11px}.veto-your-turn{color:var(--yellow-dim);font-weight:600}.veto-timer-track{position:absolute;right:0;bottom:0;left:0;height:3px;background:var(--line-soft)}.veto-timer-track i{display:block;height:100%;border-radius:0 4px 4px 0;background:var(--yellow);transition:width 400ms linear}
.veto-sequence{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin:0 0 16px;padding:0;list-style:none}.veto-sequence li{display:grid;min-width:0;grid-template-columns:20px minmax(0,1fr);grid-template-rows:auto auto;align-items:center;column-gap:6px;row-gap:3px;padding:8px 9px;border:1px solid var(--line-soft);border-radius:8px;background:color-mix(in srgb,var(--panel) 76%,var(--bg));color:var(--muted)}.veto-sequence li>span{display:grid;width:19px;height:19px;grid-row:1 / span 2;place-items:center;border-radius:6px;background:var(--line-soft);font-size:9px;font-weight:700}.veto-sequence li strong{overflow:hidden;color:var(--text);font-size:10px;text-overflow:ellipsis}.veto-sequence li small{overflow:hidden;color:var(--subtle);font-size:8px;text-overflow:ellipsis;white-space:nowrap}.veto-sequence li.is-current{border-color:color-mix(in srgb,var(--yellow) 52%,var(--line));background:color-mix(in srgb,var(--yellow) 8%,var(--panel));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--yellow) 12%,transparent)}.veto-sequence li.is-current>span{background:var(--yellow);color:#fff}.veto-sequence li.is-complete{border-color:color-mix(in srgb,#10b981 18%,var(--line-soft))}.veto-sequence li.is-complete>span{background:color-mix(in srgb,#10b981 14%,var(--panel));color:#059669}.veto-sequence li.is-decider>span{font-size:8px}
.veto-map-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.veto-map-card{position:relative;isolation:isolate;display:flex;min-width:0;min-height:164px;flex-direction:column;align-items:flex-start;justify-content:flex-end;overflow:hidden;padding:13px;border:1px solid var(--line);border-radius:12px;background:#162536;color:#fff;text-align:left;font-family:'Onest',sans-serif;cursor:default;transition:transform .2s,border-color .2s,box-shadow .2s,filter .2s}.veto-map-card img{position:absolute;z-index:-2;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .45s cubic-bezier(.2,.75,.25,1),filter .25s}.veto-map-overlay{position:absolute;z-index:-1;inset:0;background:linear-gradient(180deg,rgba(5,14,24,.08) 10%,rgba(5,14,24,.28) 42%,rgba(5,14,24,.94) 100%)}.veto-map-card:disabled{opacity:1}.veto-map-card.is-available{border-color:color-mix(in srgb,var(--yellow) 48%,var(--line));cursor:pointer;box-shadow:0 5px 18px color-mix(in srgb,var(--yellow) 10%,transparent)}.veto-map-card.is-available:hover,.veto-map-card.is-available:focus-visible{z-index:1;transform:translateY(-3px);border-color:var(--yellow);outline:none;box-shadow:0 10px 25px color-mix(in srgb,var(--yellow) 24%,transparent)}.veto-map-card.is-available:hover img{transform:scale(1.07)}.veto-map-card.is-banned{filter:grayscale(.82);border-color:color-mix(in srgb,#f87171 30%,var(--line))}.veto-map-card.is-banned .veto-map-overlay{background:linear-gradient(180deg,rgba(10,13,18,.34),rgba(10,13,18,.9))}.veto-map-card.is-picked,.veto-map-card.is-decider{border-color:color-mix(in srgb,#10b981 52%,var(--line));box-shadow:inset 0 0 0 1px color-mix(in srgb,#10b981 35%,transparent)}.veto-map-badge{position:absolute;top:10px;left:10px;display:inline-flex;min-height:24px;align-items:center;gap:5px;padding:0 8px;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:rgba(8,18,29,.72);color:#e5edf5;font-size:9px;font-weight:700;backdrop-filter:blur(7px)}.veto-map-badge.is-current{border-color:color-mix(in srgb,var(--yellow) 50%,transparent);color:#d9f7ff}.veto-map-badge.is-ban{border-color:rgba(248,113,113,.38);color:#fecaca}.veto-map-badge.is-pick,.veto-map-badge.is-decider{border-color:rgba(52,211,153,.42);color:#a7f3d0}.veto-map-name{display:grid;min-width:0;gap:2px}.veto-map-name strong{font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.25;text-shadow:0 1px 8px #0008}.veto-map-name small{max-width:100%;color:rgba(230,239,247,.76);font-size:9px;font-weight:500;line-height:1.3;overflow-wrap:anywhere;text-shadow:0 1px 7px #000}.veto-map-team{position:absolute;right:10px;bottom:13px;max-width:42%;overflow:hidden;color:#c7f9e7;font-size:8px;text-align:right;text-overflow:ellipsis;white-space:nowrap}.veto-map-index{position:absolute;right:11px;bottom:12px;color:rgba(255,255,255,.6);font-size:9px;font-variant-numeric:tabular-nums}.veto-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:13px;color:var(--subtle);font-size:10px;line-height:1.5}.veto-footer>span:first-child{display:flex;align-items:center;gap:6px}.veto-footer i{width:6px;height:6px;border-radius:50%;background:var(--yellow)}
@media(max-width:900px){.veto-map-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.veto-sequence{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:600px){.veto-panel{padding:16px;border-radius:14px}.veto-heading h3{font-size:20px}.veto-captains{grid-template-columns:1fr}.veto-sequence{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.veto-sequence li:last-child{grid-column:span 2}.veto-map-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.veto-map-card{min-height:142px;padding:10px}.veto-map-name strong{font-size:13px}.veto-map-name small{font-size:8px}.veto-turn-card{gap:10px;padding:11px 12px 15px}.veto-turn-icon{width:36px;height:36px}.veto-turn-copy strong{font-size:12px}.veto-footer{display:grid;grid-template-columns:1fr}}
@media(max-width:360px){.veto-map-grid{grid-template-columns:1fr}.veto-map-card{min-height:168px}.veto-clock{font-size:15px}}
@media(prefers-reduced-motion:reduce){.veto-map-card,.veto-map-card img,.veto-start,.veto-timer-track i{transition:none}}
</style>
