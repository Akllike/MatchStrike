<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Target, Search } from '@lucide/vue'
import type { CssWeapon, WeaponUsageStats } from '../api'

const props = defineProps<{ catalog: CssWeapon[]; stats: WeaponUsageStats | null }>()
const category = ref('all')
const search = ref('')
const sort = ref<'rounds' | 'kills' | 'damage' | 'shots'>('rounds')
const selectedId = ref('ak47')
const categories = [
  { id: 'all', name: 'Всё оружие' }, { id: 'pistols', name: 'Пистолеты' },
  { id: 'rifles', name: 'Винтовки' }, { id: 'snipers', name: 'Снайперские' },
  { id: 'smgs', name: 'Пистолеты-пулемёты' }, { id: 'shotguns', name: 'Дробовики' },
  { id: 'machineguns', name: 'Пулемёты' }, { id: 'equipment', name: 'Снаряжение' },
]
const available = computed(() => (props.stats?.trackedMaps ?? 0) > 0)
const weapons = computed(() => props.catalog.map(weapon => ({
  ...weapon,
  shots: 0, hits: 0, kills: 0, headshots: 0, damage: 0, rounds: 0,
  ...props.stats?.weapons.find(item => item.id === weapon.id),
})))
const visibleWeapons = computed(() => weapons.value.filter(weapon =>
  (category.value === 'all' || weapon.category === category.value)
  && `${weapon.name} ${weapon.id}`.toLowerCase().includes(search.value.toLowerCase().trim()),
).sort((a, b) => b[sort.value] - a[sort.value] || a.name.localeCompare(b.name)))
watch(visibleWeapons, rows => {
  if (!rows.some(row => row.id === selectedId.value)) selectedId.value = rows[0]?.id ?? ''
})
const selected = computed(() => weapons.value.find(item => item.id === selectedId.value))
const usage = computed(() => selected.value && props.stats?.trackedRounds ? Math.min(100, selected.value.rounds / props.stats.trackedRounds * 100) : 0)
const display = (value: number) => available.value ? value.toLocaleString('ru') : '—'
const selectedMetrics = computed(() => {
  const weapon = selected.value
  if (!weapon) return []
  return [
    { label: weapon.id === 'c4' ? 'Установки' : ['hegrenade', 'flashbang', 'smokegrenade'].includes(weapon.id) ? 'Броски' : weapon.id === 'knife' ? 'Атаки' : 'Выстрелы', value: weapon.shots },
    { label: 'Попадания', value: weapon.hits }, { label: 'Убийства', value: weapon.kills },
    { label: 'Урон', value: weapon.damage }, { label: 'Хедшоты', value: weapon.headshots },
    { label: 'Раунды использования', value: weapon.rounds },
  ]
})
</script>

<template>
  <section class="weapons-explorer" aria-label="Оружие Counter-Strike Source v34">
    <header class="weapons-header"><div><span class="section-kicker">COUNTER-STRIKE: SOURCE</span><h3>Арсенал игрока</h3><p>{{ catalog.length }} видов оружия и снаряжения · только War</p></div><div class="weapons-coverage"><strong>{{ stats?.trackedMaps ?? 0 }}</strong><span>карт с детализацией</span></div></header>
    <div class="weapons-filters"><label><Search :size="15" /><input v-model="search" placeholder="Найти оружие" aria-label="Поиск оружия" /></label><select v-model="sort" aria-label="Сортировка оружия"><option value="rounds">По использованию</option><option value="kills">По убийствам</option><option value="damage">По урону</option><option value="shots">По применениям</option></select></div>
    <div class="weapons-categories" role="group" aria-label="Категория оружия"><button v-for="item in categories" :key="item.id" type="button" :aria-pressed="category === item.id" @click="category = item.id">{{ item.name }}</button></div>
    <p v-if="!available" class="weapons-note">В сохранённых матчах пока нет статистики по отдельному оружию. Значения появятся после матчей с обновлённым плагином.</p>
    <div class="weapons-layout">
      <div class="weapons-catalog"><button v-for="weapon in visibleWeapons" :key="weapon.id" type="button" :aria-pressed="selectedId === weapon.id" @click="selectedId = weapon.id"><Target :size="20" /><strong>{{ weapon.name }}</strong><span>{{ display(weapon[sort]) }} <small>{{ { rounds: 'раундов', kills: 'убийств', shots: 'применений', damage: 'урона' }[sort] }}</small></span><i><b :style="{ width: `${available && stats?.trackedRounds ? Math.min(100, weapon.rounds / stats.trackedRounds * 100) : 0}%` }"></b></i></button><p v-if="!visibleWeapons.length" class="weapons-no-results">Оружие не найдено. Попробуйте другое название.</p></div>
      <aside v-if="selected" class="weapon-details" aria-live="polite"><div class="weapon-details-title"><span><Target :size="28" /></span><div><small>ПОДРОБНАЯ СТАТИСТИКА</small><h3>{{ selected.name }}</h3></div></div><div class="weapon-detail-metrics"><article v-for="metric in selectedMetrics" :key="metric.label"><span>{{ metric.label }}</span><strong>{{ display(metric.value) }}</strong></article></div><div class="weapon-usage"><div><span>Использование в раундах</span><strong>{{ available ? `${usage.toFixed(1)}%` : '—' }}</strong></div><i><b :style="{ width: `${usage}%` }"></b></i><p>Раунды, в которых оружие применялось, среди {{ stats?.trackedRounds ?? 0 }} раундов с детализацией.</p></div><p class="weapons-note">Попадания учитывают события нанесения урона. Для дробовиков и гранат их количество может превышать число выстрелов или бросков.</p></aside>
    </div>
  </section>
</template>

<style scoped>
.weapons-explorer { margin-top:18px; }.weapons-header { display:flex; justify-content:space-between; gap:16px; align-items:center; margin-bottom:18px; }.weapons-header h3 { margin:6px 0; color:var(--text); font-size:21px; letter-spacing:-.6px; }.weapons-header p { color:var(--muted); font-size:11px; }.weapons-coverage { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }.weapons-coverage strong { color:var(--text); font-size:25px; }.weapons-coverage span { color:var(--subtle); font-size:9px; }
.weapons-filters { display:flex; gap:12px; margin-bottom:13px; }.weapons-filters label { display:flex; gap:9px; align-items:center; flex:1; padding:11px 13px; border-radius:10px; background:var(--panel); color:var(--muted); }.weapons-filters input { min-width:0; width:100%; outline:none; border:0; color:var(--text); background:transparent; font-size:11px; }.weapons-filters select { max-width:45%; border:0; padding:10px; border-radius:10px; background:var(--panel); color:var(--text); font-size:10px; }
.weapons-categories { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:18px; }.weapons-categories button { border:0; padding:9px 12px; border-radius:8px; color:var(--muted); background:var(--panel); font-size:10px; cursor:pointer; }.weapons-categories button[aria-pressed=true] { background:var(--surface-tint); color:var(--yellow); }
.weapons-layout { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(270px,1fr); gap:17px; align-items:start; }.weapons-catalog { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }.weapons-catalog>button { display:flex; min-width:0; flex-direction:column; align-items:flex-start; gap:10px; padding:16px 12px; border:0; border-radius:12px; background:var(--panel); color:var(--text); text-align:left; box-shadow:var(--shadow-soft); cursor:pointer; transition:transform .15s,background .15s; }.weapons-catalog>button svg { color:var(--subtle); }.weapons-catalog>button strong { font-size:12px; }.weapons-catalog>button span { color:var(--text); font-size:15px; font-weight:700; }.weapons-catalog small { font-size:8px; color:var(--muted); font-weight:400; }.weapons-catalog>button[aria-pressed=true] { background:var(--surface-tint); box-shadow:inset 0 -2px var(--yellow),var(--shadow-soft); }.weapons-catalog>button:hover { transform:translateY(-2px); }.weapons-catalog>button[aria-pressed=true] svg { color:var(--yellow); }
.weapons-catalog i,.weapon-usage i { display:block; width:100%; height:4px; overflow:hidden; border-radius:5px; background:var(--line-soft); }.weapons-catalog i b,.weapon-usage i b { display:block; height:100%; border-radius:inherit; background:var(--yellow); transition:width .2s; }
.weapon-details { position:sticky; top:85px; padding:20px; border-radius:16px; background:var(--panel); box-shadow:var(--shadow-soft); }.weapon-details-title { display:flex; align-items:center; gap:12px; margin-bottom:22px; }.weapon-details-title>span { padding:14px; border-radius:12px; color:var(--yellow); background:var(--surface-tint); }.weapon-details-title small { color:var(--subtle); font-size:8px; letter-spacing:1px; }.weapon-details-title h3 { margin-top:7px; color:var(--text); font-size:23px; letter-spacing:-.8px; }.weapon-detail-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px 12px; }.weapon-detail-metrics article { display:flex; flex-direction:column; gap:7px; }.weapon-detail-metrics span { color:var(--muted); font-size:10px; }.weapon-detail-metrics strong { color:var(--text); font-size:23px; font-variant-numeric:tabular-nums; }.weapon-usage { margin-top:22px; }.weapon-usage>div { display:flex; justify-content:space-between; gap:8px; margin-bottom:10px; font-size:10px; color:var(--text); }.weapon-usage p,.weapons-note { margin-top:12px; color:var(--subtle); font-size:10px; line-height:1.7; }.weapons-explorer>.weapons-note { padding:13px 16px; border-radius:10px; background:var(--surface-tint); margin-bottom:15px; }.weapons-no-results { grid-column:1/-1; color:var(--muted); padding:25px; font-size:12px; }
@media(max-width:760px) { .weapons-layout { grid-template-columns:1fr; }.weapon-details { position:static; grid-row:1; }.weapons-catalog { grid-template-columns:repeat(3,minmax(0,1fr)); }.weapons-catalog>button { padding:12px 10px; }.weapons-header h3 { font-size:18px; } }
@media(max-width:360px) { .weapons-catalog { grid-template-columns:repeat(2,minmax(0,1fr)); } }
</style>
