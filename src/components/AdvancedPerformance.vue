<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Activity, Crosshair, Repeat2, HeartPulse, Sparkles, Trophy, Target, Search, Info, ArrowUpRight } from '@lucide/vue'
import type { DonutPlayerStatsSummary } from '../api'

interface Metric { label: string; value: string | number; note: string; field: string }
interface MetricGroup { code: string; title: string; stats: Metric[] }
const props = defineProps<{ stats: DonutPlayerStatsSummary; groups: MetricGroup[] }>()
const group = defineModel<string>('group', { default: 'all' })
const selectedLabel = ref('')
const query = ref('')
const scale = ref<'total' | 'rounds'>('total')
const multi = ref('tripleKills')
const clutch = ref(1)
const storyElement = ref<HTMLElement | null>(null)
const value = (key: string) => Math.max(0, props.stats.totals[key] ?? 0)
const number = (n: number, digits = 0) => n.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const ratio = (n: number, d: number) => d > 0 ? n / d * 100 : 0
const width = (n: number, d: number) => Math.max(0, Math.min(100, ratio(n, d)))
const rate = (n: number, d: number) => d > 0 ? `${number(ratio(n, d), 1)}%` : '—'
const rounds = computed(() => value('rounds'))
const topics = [
  { icon: Crosshair, accent: 'var(--yellow)', short: 'Бой', text: 'Точность, урон и результат каждой перестрелки.' },
  { icon: HeartPulse, accent: 'var(--insight-green)', short: 'Раунды', text: 'Что происходит с раундом, когда вы в игре.' },
  { icon: Target, accent: 'var(--yellow)', short: 'Первые дуэли', text: 'Первый контакт. Первая возможность дать команде преимущество.' },
  { icon: Trophy, accent: 'var(--insight-gold)', short: 'Клатчи', text: 'Когда всё зависит от одного игрока.' },
  { icon: Repeat2, accent: 'var(--insight-purple)', short: 'Команда', text: 'Размены и поддержка, которые превращают личную игру в командную.' },
  { icon: Sparkles, accent: 'var(--insight-gold)', short: 'Арсенал', text: 'Оружие, гранаты и время, проведённое в бою.' },
  { icon: Trophy, accent: 'var(--yellow)', short: 'Карьера', text: 'Сохранённые матчи и накопительный профиль — у каждого свой период учёта.' },
  { icon: Activity, accent: 'var(--insight-purple)', short: 'Стиль игры', text: 'Оценки DonutStats от 0 до 100. Это модель игровых ролей, а не проценты побед.' },
]
const selectedGroup = computed(() => props.groups.find(item => item.code === group.value) ?? props.groups[0])
const topicIndex = computed(() => Math.max(0, props.groups.findIndex(item => item.code === selectedGroup.value?.code)))
const topic = computed(() => topics[topicIndex.value] ?? topics[0])
const allMetrics = computed(() => props.groups.flatMap(item => item.stats.map(stat => ({ ...stat, groupCode: item.code, groupTitle: item.title }))))
const visibleMetrics = computed(() => {
  const search = query.value.trim().toLocaleLowerCase('ru')
  return search ? allMetrics.value.filter(item => `${item.label} ${item.note} ${item.groupTitle}`.toLocaleLowerCase('ru').includes(search))
    : allMetrics.value.filter(item => item.groupCode === selectedGroup.value?.code)
})
const selected = computed(() => allMetrics.value.find(item => item.label === selectedLabel.value && item.groupCode === selectedGroup.value?.code) ?? selectedGroup.value?.stats[0])
function chooseGroup(code: string) { group.value = code; selectedLabel.value = ''; query.value = '' }
function chooseMetric(metric: Metric & { groupCode?: string }) {
  if (metric.groupCode) group.value = metric.groupCode
  selectedLabel.value = metric.label
  if (window.matchMedia('(max-width: 760px)').matches) revealStory()
}
function revealStory() {
  nextTick(() => storyElement.value?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
}
function openUtility(label: string) {
  const code = props.groups[5]?.code
  if (code) { chooseGroup(code); selectedLabel.value = label; revealStory() }
}
watch(() => props.stats, () => { selectedLabel.value = ''; multi.value = 'tripleKills'; clutch.value = 1 })
const pulse = computed(() => [
  { title: 'Первые дуэли', n: value('openingKills'), d: value('openingAttempts'), caption: 'выиграно первых контактов', group: 2, label: 'Успех первых дуэлей', icon: Crosshair, color: 'var(--yellow)' },
  { title: 'Полезные раунды', n: value('kastRounds'), d: rounds.value, caption: 'убийство, ассист, выживание или размен', group: 1, label: 'KAST', icon: HeartPulse, color: 'var(--insight-green)' },
  { title: 'Попадание в голову', n: value('headshots'), d: value('kills'), caption: 'доля хедшотов среди убийств', group: 0, label: 'HS%', icon: Target, color: 'var(--insight-gold)' },
  { title: 'Поддержка команды', n: value('deathsTraded'), d: value('tradeableDeaths'), caption: 'разменяно доступных для размена смертей', group: 4, label: 'Разменянные смерти %', icon: Repeat2, color: 'var(--insight-purple)' },
])
function openPulse(item: typeof pulse.value[number]) { const code = props.groups[item.group]?.code; if (code) { chooseGroup(code); selectedLabel.value = item.label } }
// Real numerator / denominator pairs; no invented benchmarks.
const formulas: Record<string, [string, string, number, string, string]> = {
  'HS%': ['headshots', 'kills', 100, 'хедшотов', 'убийств'],
  'ADR': ['damage', 'rounds', 1, 'урона', 'раундов'],
  'DPR': ['deaths', 'rounds', 1, 'смертей', 'раундов'],
  'KAST': ['kastRounds', 'rounds', 100, 'полезных раундов', 'раундов'],
  'Доля round win shares': ['roundWinContributionRounds', 'roundsWon', 100, 'победных раундов с личным вкладом', 'победных раундов'],
  'Раунды с убийством %': ['roundsWithKill', 'rounds', 100, 'раундов с фрагом', 'раундов'],
  'Убийств за победный раунд': ['killsInWonRounds', 'roundsWon', 1, 'фрагов в победных раундах', 'победных раундов'],
  'Убийства в пережитых раундах за раунд': ['killsInSurvivedRounds', 'rounds', 1, 'фрагов в пережитых раундах', 'раундов'],
  'Раунды с мультикиллом %': ['multikills', 'rounds', 100, 'раундов с 2+ фрагами', 'раундов'],
  'Успех первых дуэлей': ['openingKills', 'openingAttempts', 100, 'выигранных дуэлей', 'первых дуэлей'],
  'Размен первых смертей %': ['openingDeathsTraded', 'openingDeaths', 100, 'разменянных entry-смертей', 'entry-смертей'],
  'Среднее время первой дуэли': ['openingTimeTotalMs', 'openingTimeSamples', .001, 'миллисекунд суммарно', 'замеров'],
  'Успех клатчей': ['clutchWins', 'clutchAttempts', 100, 'побед в клатчах', 'попыток'],
  'Клатч-попыток на 24 раунда': ['clutchAttempts', 'rounds', 24, 'попыток клатча', 'раундов'],
  'Снайперские убийства %': ['sniperKills', 'kills', 100, 'снайперских фрагов', 'убийств'],
  'Убийства с AWP %': ['awpKills', 'kills', 100, 'фрагов с AWP', 'убийств'],
  'Разменянные смерти %': ['deathsTraded', 'tradeableDeaths', 100, 'разменянных смертей', 'доступных для размена смертей'],
  'Trade-фраги %': ['tradeKills', 'kills', 100, 'trade-фрагов', 'убийств'],
  'Bait-фраги %': ['baitKills', 'kills', 100, 'фрагов после урона тиммейта', 'убийств'],
  'Assisted kills %': ['killsAssisted', 'kills', 100, 'убийств с поддержкой', 'убийств'],
  'Последний живой %': ['lastAliveRounds', 'rounds', 100, 'раундов последним в команде', 'раундов'],
  'Выживание после установки %': ['alivePostPlantRounds', 'postPlantRounds', 100, 'выживаний после установки', 'постплент-раундов'],
  'Время жизни за раунд': ['timeAliveSeconds', 'rounds', 1, 'секунд в игре', 'раундов'],
}
const perRoundFields: Record<string, string> = {
  'Дымовые за раунд': 'smokesThrown', 'Ослепляющие за раунд': 'flashesThrown', 'Зажигательные за раунд': 'molotovsThrown',
  'Осколочные за раунд': 'heGrenadesThrown', 'Выстрелы за раунд': 'weaponAttacks', 'Tradeable смерти за раунд': 'tradeableDeaths',
  'Возможности размена за раунд': 'tradeOpportunities', 'Отменённые размены за раунд': 'tradeDenials', 'Bait-ассисты за раунд': 'baitAssists',
}
const explanations: Record<string, string> = {
  'Убийства': 'Каждый устранённый соперник — возможность выиграть раунд. Смотрите на фраги вместе с уроном и разменами: один счётчик не описывает весь вклад.',
  'Смерти': 'Количество смертей за учтённые матчи. Разменянная смерть может помочь команде, поэтому её важно оценивать вместе с поддержкой.',
  'Ассисты': 'Помощь в убийстве соперника. Учитывается по правилам плагина: это вклад, который не попал в личный счёт фрагов.',
  'K/D': 'Сколько убийств приходится на одну смерть. Например, 1,25 означает пять убийств на четыре смерти. При нуле смертей сайт использует делитель 1.',
  'KAST': 'Доля раундов, в которых было хотя бы одно из событий: убийство, ассист, выживание или размен вашей смерти. Один раунд учитывается только один раз.',
  'ADR': 'Средний нанесённый урон за раунд. Помогает увидеть вклад даже в тех раундах, где добить соперника удалось тиммейту.',
  'DPR': 'Среднее число смертей за раунд. Смотрите вместе с первыми дуэлями: активный entry-игрок и осторожный снайпер рискуют по-разному.',
  'HS%': 'Доля убийств в голову среди всех убийств. Это не точность стрельбы: промахи в расчёт не входят.',
  'Entry попытки': 'Первые дуэли раунда с участием игрока. Доля побед показывает результативность, а число попыток — как часто игрок принимает первый контакт.',
  'Успех первых дуэлей': 'Доля первых дуэлей, в которых игрок убил соперника. Победа создаёт численное преимущество в самом начале раунда.',
  'Мультикиллы': 'Раунды с двумя или более убийствами. Триплы, квадро и эйсы уже входят в этот счётчик — складывать их повторно не нужно.',
  'Разменянные смерти %': 'Как часто команда отвечала фрагом после вашей смерти, когда размен был возможен. Показывает взаимодействие с командой, а не только личную стрельбу.',
  'Отменённые размены': 'Возможности размена, после которых ответного убийства не произошло. Счётчик фиксирует ситуацию, но сам по себе не объясняет её причину.',
  'Bait-фраги': 'Убийства соперников, которым незадолго до этого наносил урон тиммейт. Название счётчика не означает оценку поведения игрока.',
  'Разница убийств за раунд': 'Личный баланс убийств и смертей, разделённый на число раундов. Положительное значение — убийств больше, отрицательное — смертей.',
  'Разница убийств за 24 раунда': 'Разница убийств и смертей в пересчёте на 24 раунда. Это средняя частота, а не прогноз результата следующего матча.',
  'Чистый урон за раунд': 'Нанесённый урон минус полученный, в среднем за раунд. Отрицательное значение означает, что полученного урона было больше.',
  'Время жизни': 'Суммарное время жизни в учтённых раундах. Для сравнения темпа игры смотрите среднее время жизни за раунд.',
  'Среднее время первой дуэли': 'Среднее время от начала раунда до первой дуэли с вашим участием. Более ранний контакт не обязательно лучше: всё зависит от роли и тактики.',
}
const roleDescriptions: Record<string, string> = {
  Firepower: 'Огневая мощь: результативность стрельбы и нанесение урона.',
  Entrying: 'Готовность принимать первые контакты и открывать команде путь.',
  Trading: 'Участие в разменах и поддержка тиммейтов.',
  Opening: 'Результативность первых дуэлей раунда.',
  Closing: 'Игра в решающих ситуациях и завершение раундов.',
  Sniping: 'Вклад снайперского оружия в игру.',
  Utility: 'Использование гранат в раундах.',
}
const canNormalize = (metric: Metric) => !!metric.field && !['openingTimeSamples', 'timeAliveSeconds'].includes(metric.field)
const display = (metric: Metric) => scale.value === 'rounds' && canNormalize(metric)
  ? rounds.value ? number(value(metric.field) / rounds.value * 24, 1) : '—'
  : typeof metric.value === 'number' ? number(metric.value) : metric.value
const explanation = computed(() => {
  const metric = selected.value
  if (!metric) return null
  let formula = formulas[metric.label]
  if (perRoundFields[metric.label]) formula = [perRoundFields[metric.label], 'rounds', 1, 'событий', 'раундов']
  if (metric.label.startsWith('Разница убийств')) return { n: value('kills') - value('deaths'), d: rounds.value, factor: metric.label.endsWith('24 раунда') ? 24 : 1, nLabel: 'разница убийств и смертей', dLabel: 'раундов', kind: 'formula' }
  if (metric.label === 'Чистый урон за раунд') return { n: value('damage') - value('damageTaken'), d: rounds.value, factor: 1, nLabel: 'нанесённый минус полученный урон', dLabel: 'раундов', kind: 'formula' }
  if (metric.label === 'K/D') return { n: value('kills'), d: Math.max(1, value('deaths')), factor: 1, nLabel: 'убийств', dLabel: 'смертей (минимум 1)', kind: 'formula' }
  if (formula) return { n: value(formula[0]), d: value(formula[1]), factor: formula[2], nLabel: formula[3], dLabel: formula[4], kind: 'formula' }
  if (metric.field && rounds.value && canNormalize(metric)) return { n: value(metric.field), d: rounds.value, factor: 24, nLabel: metric.label.toLocaleLowerCase('ru'), dLabel: 'учтённых раундов', kind: 'frequency' }
  return null
})
const formulaResult = computed(() => { const f = explanation.value; return !f || !f.d ? '—' : number(f.n / f.d * f.factor, f.factor === 100 || f.factor === 24 ? 1 : 2) + (f.factor === 100 ? '%' : f.factor === .001 ? ' с' : '') })
const storyDescription = computed(() => {
  const metric = selected.value
  if (!metric) return ''
  if (explanations[metric.label]) return explanations[metric.label]
  if (metric.label.startsWith('Оценка ')) return `${roleDescriptions[metric.label.slice(7)] ?? metric.note} Оценка рассчитывается моделью DonutStats по сохранённым матчам; это не сравнение с другими игроками.`
  if (explanation.value?.kind === 'formula') return `${metric.note}. В расчёте используются ${explanation.value.nLabel} и ${explanation.value.dLabel}. Исходные числа и формула приведены ниже.`
  if (metric.field) return `${metric.note}. Суммарный счётчик за сохранённые завершённые War-матчи.${canNormalize(metric) ? ' Переключите масштаб, чтобы увидеть частоту за 24 раунда.' : ''}`
  return `${metric.note}. Это срез профиля; накопительная статистика может включать матчи, которых нет в истории сайта.`
})
const comparisons = computed(() => {
  const sets: [string, string][][] = [
    [['kills', 'Убийства'], ['deaths', 'Смерти'], ['assists', 'Ассисты'], ['headshots', 'Хедшоты']],
    [['roundsWon', 'Победы в раундах'], ['roundsLost', 'Поражения в раундах'], ['roundsWithKill', 'Раунды с убийством'], ['kastRounds', 'KAST']],
    [['openingKills', 'Entry-фраги'], ['openingDeaths', 'Entry смерти'], ['openingDeathsTraded', 'Entry смерть разменяна']],
    [['clutchAttempts', 'Попытки клатча'], ['clutchWins', 'Победы в клатчах']],
    [['tradeKills', 'Trade-фраги'], ['deathsTraded', 'Разменянные смерти'], ['baitKills', 'Bait-фраги'], ['killsAssisted', 'Assisted kills']],
    [['smokesThrown', 'Дымовые гранаты'], ['flashesThrown', 'Ослепляющие гранаты'], ['heGrenadesThrown', 'Осколочные гранаты']],
  ]
  if (topicIndex.value === 7) return Object.entries(props.stats.categoryScores).map(([key, score]) => ({ label: `Оценка ${key}`, count: score, percent: width(score ?? 0, 100) }))
  const set = sets[topicIndex.value] ?? []
  const max = Math.max(1, ...set.map(([key]) => value(key)))
  return set.map(([key, label]) => ({ label, count: value(key), percent: width(value(key), max) }))
})
const multiRows = computed(() => [
  { id: 'double', label: 'Дабл', kills: '2', count: Math.max(0, value('multikills') - value('tripleKills') - value('quadKills') - value('aceKills')) },
  { id: 'tripleKills', label: 'Трипл', kills: '3', count: value('tripleKills') },
  { id: 'quadKills', label: 'Квадро', kills: '4', count: value('quadKills') },
  { id: 'aceKills', label: 'Эйс', kills: '5+', count: value('aceKills') },
])
const selectedMulti = computed(() => multiRows.value.find(item => item.id === multi.value) ?? multiRows.value[0])
const multiMax = computed(() => Math.max(1, ...multiRows.value.map(item => item.count)))
const clutchRows = computed(() => [1, 2, 3, 4, 5].map(opponents => props.stats.clutchesByX.find(item => item.opponents === opponents) ?? { opponents, wins: 0, attempts: 0 }))
const selectedClutch = computed(() => clutchRows.value.find(item => item.opponents === clutch.value) ?? clutchRows.value[0])
const utility = computed(() => [
  { id: 'smokesThrown', label: 'Дымовые', metric: 'Дымовые гранаты', color: 'var(--yellow)' },
  { id: 'flashesThrown', label: 'Световые', metric: 'Ослепляющие гранаты', color: 'var(--insight-gold)' },
  { id: 'heGrenadesThrown', label: 'Осколочные', metric: 'Осколочные гранаты', color: 'var(--insight-purple)' },
].map(item => ({ ...item, count: value(item.id) })))
const utilityTotal = computed(() => utility.value.reduce((sum, item) => sum + item.count, 0))
</script>

<template>
  <div class="insight-dashboard">
    <header class="insight-intro flex flex-wrap items-end justify-between gap-4">
      <div><span class="section-kicker">ЗА ЦИФРАМИ — ВАША ИГРА</span><h3>Узнайте свой стиль</h3><p>Выбирайте показатели и смотрите, из чего складывается результат.</p></div>
      <span class="insight-sample"><Activity :size="14" /> {{ number(rounds) }} раундов <span>·</span> {{ number(stats.matches) }} матчей War</span>
    </header>
    <div class="insight-pulse grid grid-cols-2 gap-3 xl:grid-cols-4">
      <button v-for="item in pulse" :key="item.title" type="button" :style="{ '--accent': item.color }" :aria-pressed="selected?.label === item.label" @click="openPulse(item)">
        <span class="pulse-top"><component :is="item.icon" :size="16" /><ArrowUpRight :size="14" /></span>
        <span class="pulse-ring" :style="{ '--fill': `${width(item.n, item.d)}%` }"><span><strong>{{ rate(item.n, item.d) }}</strong></span></span>
        <strong class="pulse-title">{{ item.title }}</strong><span class="pulse-caption">{{ item.caption }}</span><span class="pulse-fraction">{{ number(item.n) }} <span>из {{ number(item.d) }}</span></span>
      </button>
    </div>
    <section class="insight-explorer" :style="{ '--accent': topic.accent }" aria-label="Исследование показателей игрока">
      <header class="explorer-toolbar flex flex-wrap items-center justify-between gap-3"><div><span class="section-kicker">РАЗБОР ИГРЫ</span><h3>Каждая деталь имеет значение</h3></div><label class="insight-search"><Search :size="15" /><input v-model="query" type="search" placeholder="Найти показатель…" aria-label="Поиск по всем показателям статистики" /></label></header>
      <nav class="insight-topics" aria-label="Категории статистики"><button v-for="(item, index) in groups" :key="item.code" type="button" :aria-pressed="selectedGroup?.code === item.code" @click="chooseGroup(item.code)"><component :is="topics[index]?.icon ?? Activity" :size="16" /><span>{{ topics[index]?.short ?? item.title }}</span></button></nav>
      <div class="explorer-body">
        <div class="explorer-metrics">
          <div class="metrics-heading"><h4>{{ query.trim() ? 'Результаты поиска' : selectedGroup?.title }}</h4><p>{{ query.trim() ? `Найдено показателей: ${visibleMetrics.length}` : topic.text }}</p></div>
          <div class="insight-scale" role="group" aria-label="Масштаб счётчиков"><button type="button" :aria-pressed="scale === 'total'" @click="scale = 'total'">Всего</button><button type="button" :aria-pressed="scale === 'rounds'" @click="scale = 'rounds'">За 24 раунда</button><span v-tooltip="'Пересчёт доступен для счётчиков событий в сохранённых матчах. Проценты, средние, время и показатели карьеры сохраняют свою единицу измерения.'" tabindex="0" aria-label="Как работает пересчёт"><Info :size="14" /></span></div>
          <div v-if="!query.trim() && comparisons.length" class="metric-comparison" role="group" aria-label="Визуальное сравнение показателей"><button v-for="item in comparisons" :key="item.label" type="button" :aria-pressed="selected?.label === item.label" @click="selectedLabel = item.label"><span>{{ item.label.replace('Оценка ', '') }}</span><i><b :style="{ width: `${item.percent}%` }"></b></i><strong>{{ item.count === null ? '—' : number(item.count) }}</strong></button><p>{{ topicIndex === 7 ? 'Шкала модели от 0 до 100' : 'Суммарные значения · показатели могут пересекаться' }}</p></div>
          <div class="metric-picker"><button v-for="metric in visibleMetrics" :key="`${metric.groupCode}-${metric.label}`" type="button" :aria-pressed="selected?.label === metric.label && selectedGroup?.code === metric.groupCode" @click="chooseMetric(metric)"><span>{{ metric.label }}</span><strong>{{ display(metric) }}</strong><small>{{ scale === 'rounds' && canNormalize(metric) ? 'на 24 раунда' : 'разобрать показатель' }} <ArrowUpRight :size="11" /></small></button></div>
          <p v-if="!visibleMetrics.length" class="insight-no-results">Такого показателя нет. Попробуйте «урон», «размен» или «AWP».</p>
        </div>
        <aside v-if="selected" ref="storyElement" class="metric-story" aria-live="polite" aria-atomic="true">
          <span class="story-eyebrow"><component :is="topic.icon" :size="15" /> ПОНЯТЬ ПОКАЗАТЕЛЬ</span><h4>{{ selected.label }}</h4><strong class="story-value">{{ display(selected) }}</strong><span class="story-unit">{{ scale === 'rounds' && canNormalize(selected) ? 'в пересчёте на 24 раунда' : selected.note }}</span>
          <p class="story-description">{{ storyDescription }}</p>
          <template v-if="explanation">
            <div class="story-calculation"><span>{{ explanation.kind === 'frequency' ? 'ЧАСТОТА НА 24 РАУНДА' : 'КАК СЧИТАЕТСЯ' }}</span><div><strong>{{ number(explanation.n, Number.isInteger(explanation.n) ? 0 : 1) }}</strong><b>÷</b><strong>{{ number(explanation.d) }}</strong><template v-if="explanation.factor !== 1"><b>×</b><strong>{{ number(explanation.factor, explanation.factor < 1 ? 3 : 0) }}</strong></template></div><small>{{ explanation.nLabel }} / {{ explanation.dLabel }}</small><strong class="calculation-result">{{ formulaResult }}</strong></div>
            <div v-if="explanation.factor === 100" class="story-proportion"><div class="proportion-track"><span :style="{ width: `${width(explanation.n, explanation.d)}%` }"></span></div><div><span>{{ number(explanation.n) }} {{ explanation.nLabel }}</span><span>{{ number(explanation.d) }} всего</span></div></div>
            <div v-else class="story-frequency"><Activity :size="18" /><p>{{ explanation.d ? 'Частота рассчитана по реальным событиям в сохранённых матчах.' : 'Пока нет достаточных данных для расчёта среднего.' }}</p></div>
          </template>
          <div v-else-if="selected.label.startsWith('Оценка ')" class="story-model"><div class="proportion-track"><span :style="{ width: `${typeof selected.value === 'number' ? width(selected.value, 100) : 0}%` }"></span></div><div><span>0</span><span>Модель DonutStats</span><span>100</span></div></div>
          <div v-else class="story-frequency"><Info :size="18" /><p>Это отдельный срез профиля. Он не суммируется с показателями сохранённых матчей.</p></div>
          <span class="story-hint"><Info :size="13" /> Нажмите на другой показатель, чтобы продолжить разбор</span>
        </aside>
      </div>
    </section>
    <div class="insight-bottom grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section class="insight-panel multi-panel">
        <header><span class="panel-icon"><Crosshair :size="18" /></span><div><span class="section-kicker">СЕРИИ УБИЙСТВ</span><h3>Один раунд. Несколько фрагов.</h3></div><span v-tooltip="'Даблы — ровно 2 убийства, триплы — ровно 3, квадро — ровно 4, эйсы — 5 и более. Столбцы сравниваются между собой; частота считается от всех учтённых раундов.'" tabindex="0" aria-label="Как считаются серии убийств"><Info :size="15" /></span></header>
        <div class="multi-chart" role="group" aria-label="Выберите серию убийств"><button v-for="(item, index) in multiRows" :key="item.id" type="button" :aria-pressed="multi === item.id" @click="multi = item.id"><strong>{{ number(item.count) }}</strong><span class="multi-column"><i :style="{ height: `${width(item.count, multiMax)}%`, opacity: .45 + index * .18 }"></i></span><b>{{ item.kills }}K</b><small>{{ item.label }}</small></button></div>
        <div class="multi-insight" aria-live="polite"><strong>{{ rate(selectedMulti.count, rounds) }}</strong><div><b>{{ selectedMulti.label }} · {{ number(selectedMulti.count) }} раундов</b><span>{{ selectedMulti.count && rounds ? `В среднем один такой раунд на ${number(rounds / selectedMulti.count, 1)}` : 'Таких раундов пока не было' }}</span></div></div>
      </section>
      <section class="insight-panel clutch-panel">
        <header><span class="panel-icon"><Trophy :size="18" /></span><div><span class="section-kicker">ПОСЛЕДНИЙ ГЕРОЙ</span><h3>Когда команда верит в вас</h3></div></header>
        <div class="clutch-lanes" role="group" aria-label="Выберите ситуацию клатча"><button v-for="item in clutchRows" :key="item.opponents" type="button" :aria-pressed="clutch === item.opponents" @click="clutch = item.opponents"><b>1<span>v</span>{{ item.opponents }}</b><span class="clutch-track"><i :style="{ width: `${width(item.wins, item.attempts)}%` }"></i></span><strong>{{ rate(item.wins, item.attempts) }}</strong><small>{{ item.wins }} / {{ item.attempts }}</small></button></div>
        <div class="clutch-insight" aria-live="polite"><span>1v{{ selectedClutch.opponents }}</span><p><strong>{{ selectedClutch.wins }} побед · {{ Math.max(0, selectedClutch.attempts - selectedClutch.wins) }} поражений</strong>{{ selectedClutch.attempts ? 'Доля побед среди попыток остаться одному и выиграть раунд.' : 'Таких ситуаций в сохранённой статистике ещё не было.' }}</p></div>
      </section>
    </div>
    <section class="insight-panel utility-panel">
      <header><span class="panel-icon"><Sparkles :size="18" /></span><div><span class="section-kicker">ПОДГОТОВКА КОНТАКТА</span><h3>Гранаты тоже решают</h3></div><strong class="utility-total">{{ number(utilityTotal) }} <small>бросков</small></strong></header>
      <div class="utility-stack" role="img" :aria-label="utility.map(item => `${item.label}: ${item.count}`).join(', ')"><span v-for="item in utility" :key="item.id" :style="{ width: `${width(item.count, utilityTotal)}%`, background: item.color }"></span></div>
      <div class="utility-options"><button v-for="item in utility" :key="item.id" type="button" :style="{ '--accent': item.color }" @click="openUtility(item.metric)"><span class="utility-dot"></span><span>{{ item.label }}<small>{{ rate(item.count, utilityTotal) }} всех бросков</small></span><strong>{{ scale === 'rounds' ? rounds ? number(item.count / rounds * 24, 1) : '—' : number(item.count) }}</strong><ArrowUpRight :size="15" /></button></div>
      <p class="utility-note">Доля бросков, а не эффективность гранат. {{ scale === 'rounds' ? 'Числа пересчитаны на 24 раунда.' : 'Нажмите на тип гранаты, чтобы разобрать счётчик.' }}</p>
    </section>
  </div>
</template>

<style scoped>
.insight-dashboard { --insight-green:#16836e; --insight-gold:#a26a10; --insight-purple:#7c5cce; display:grid; gap:22px; margin:22px 0; color:var(--text); }
:global(.dark .insight-dashboard) { --insight-green:#45d6ad; --insight-gold:#f3c46c; --insight-purple:#b49aef; }
.insight-dashboard button { font:inherit; cursor:pointer; text-align:left; }
.insight-dashboard button:focus-visible,.insight-dashboard input:focus-visible,[tabindex]:focus-visible { outline:2px solid var(--yellow); outline-offset:4px; }
.insight-dashboard h3,.insight-dashboard h4,.insight-dashboard p { margin:0; }
.insight-intro h3 { margin-top:7px; font-size:25px; font-weight:700; letter-spacing:-.8px; }
.insight-intro p { margin-top:8px; font-size:12px; color:var(--muted); line-height:1.7; }
.insight-sample { display:flex; align-items:center; gap:8px; font-size:10px; color:var(--muted); white-space:nowrap; }.insight-sample svg { color:var(--yellow); }.insight-sample>span { color:var(--subtle); }
.insight-pulse>button { position:relative; display:flex; min-width:0; flex-direction:column; align-items:center; border:0; border-radius:17px; padding:17px; background:var(--panel); box-shadow:var(--shadow-soft); transition:background .18s; }
.insight-pulse>button:hover,.insight-pulse>button[aria-pressed=true] { background:var(--surface-tint); }
.pulse-top { display:flex; width:100%; justify-content:space-between; color:var(--accent); }.pulse-top svg:last-child { color:var(--subtle); }
.pulse-ring { display:grid; place-items:center; width:112px; aspect-ratio:1; padding:6px; border-radius:50%; margin:6px 0 16px; background:conic-gradient(var(--accent) var(--fill),var(--line-soft) 0); }
.pulse-ring>span { display:grid; width:100%; height:100%; place-items:center; border-radius:50%; background:var(--panel); }.pulse-ring strong { color:var(--text); font-size:24px; letter-spacing:-1px; font-variant-numeric:tabular-nums; }
.pulse-title { font-size:12px; text-align:center; }.pulse-caption { max-width:190px; min-height:34px; margin-top:6px; text-align:center; font-size:10px; line-height:1.6; color:var(--muted); }.pulse-fraction { padding-top:10px; font-size:11px; color:var(--accent); }.pulse-fraction>span { color:var(--muted); }
.insight-explorer,.insight-panel { min-width:0; border-radius:18px; background:var(--panel); box-shadow:var(--shadow-soft); overflow:clip; }
.explorer-toolbar { padding:24px 24px 20px; }.explorer-toolbar h3 { font-size:17px; font-weight:700; margin-top:6px; letter-spacing:-.4px; }
.insight-search { display:flex; align-items:center; gap:9px; width:230px; max-width:100%; color:var(--muted); padding:11px 12px; background:var(--line-soft); border-radius:10px; }.insight-search input { width:100%; min-width:0; background:transparent; color:var(--text); font:inherit; font-size:11px; border:0; outline:0; }.insight-search:focus-within { box-shadow:0 0 0 2px var(--yellow); }
.insight-search input[type=search] { padding:0; border:0; box-shadow:none; background:transparent; }
.insight-topics { display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); gap:4px; padding:0 18px 18px; }.insight-topics button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-width:0; border:0; border-radius:10px; padding:13px 4px; color:var(--muted); background:transparent; font-size:10px; }.insight-topics button:hover { background:var(--line-soft); }.insight-topics button[aria-pressed=true] { color:var(--accent); background:var(--surface-tint); }
.explorer-body { display:grid; grid-template-columns:minmax(0,1fr) minmax(240px,.75fr); border-top:1px solid var(--line-soft); align-items:start; }
.explorer-metrics { min-width:0; padding:24px; }.metrics-heading h4 { font-size:16px; font-weight:700; }.metrics-heading p { margin-top:7px; max-width:420px; color:var(--muted); font-size:11px; line-height:1.7; }
.insight-scale { display:flex; align-items:center; gap:4px; margin:18px 0; }.insight-scale button { padding:7px 11px; border:0; border-radius:7px; color:var(--muted); font-size:10px; background:var(--line-soft); }.insight-scale button[aria-pressed=true] { color:var(--accent); background:var(--surface-tint); }.insight-scale>span { color:var(--subtle); padding:7px; }
.metric-comparison { display:grid; gap:6px; margin:0 0 20px; padding:12px; border-radius:11px; background:var(--surface-tint); }.metric-comparison button { display:grid; grid-template-columns:minmax(90px,1.2fr) minmax(20px,1fr) 38px; align-items:center; gap:10px; padding:7px 3px; border:0; border-radius:4px; background:transparent; color:var(--muted); font-size:10px; }.metric-comparison button:hover,.metric-comparison button[aria-pressed=true] { color:var(--accent); }.metric-comparison button>span { overflow-wrap:anywhere; }.metric-comparison i { height:5px; border-radius:6px; background:var(--line); overflow:hidden; }.metric-comparison i b { display:block; height:100%; border-radius:inherit; background:var(--accent); transition:width .25s; }.metric-comparison strong { text-align:right; font-size:11px; color:var(--text); }.metric-comparison p { margin-top:8px; font-size:8px; color:var(--muted); line-height:1.7; }
.metric-picker { max-height:460px; overflow-y:auto; padding:2px 3px 4px; scrollbar-width:thin; }
.metric-picker { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }.metric-picker button { display:flex; min-width:0; flex-direction:column; align-items:flex-start; gap:10px; padding:15px 13px; border:0; border-radius:10px; color:var(--text); background:var(--line-soft); box-shadow:inset 0 0 0 1px transparent; transition:background .15s; }.metric-picker button:hover { background:var(--surface-tint); }.metric-picker button[aria-pressed=true] { background:var(--surface-tint); box-shadow:inset 0 -2px var(--accent); }.metric-picker button>span { font-size:11px; line-height:1.5; overflow-wrap:anywhere; }.metric-picker strong { font-size:22px; line-height:1.2; letter-spacing:-.6px; font-variant-numeric:tabular-nums; }.metric-picker small { display:flex; align-items:center; gap:5px; color:var(--muted); font-size:8px; }
.metric-story { position:sticky; top:86px; scroll-margin-top:90px; min-width:0; margin:24px 24px 24px 0; padding:24px; border-radius:13px; background:linear-gradient(145deg,var(--surface-tint),var(--line-soft)); }.story-eyebrow { display:flex; align-items:center; gap:8px; font-size:8px; font-weight:700; letter-spacing:1.2px; color:var(--accent); }.metric-story h4 { font-size:18px; line-height:1.5; margin-top:20px; font-weight:700; }.story-value { display:block; margin-top:9px; font-size:clamp(30px,3vw,45px); font-weight:700; line-height:1.2; letter-spacing:-1.5px; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }.story-unit { display:block; margin-top:7px; font-size:10px; color:var(--muted); line-height:1.6; }.story-description { margin-top:22px!important; color:var(--muted); font-size:11px; line-height:1.9; }
.story-calculation { padding:18px 0; margin-top:20px; border-top:1px solid var(--line); }.story-calculation>span { color:var(--subtle); font-size:8px; font-weight:700; letter-spacing:1px; }.story-calculation>div { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:12px 0 8px; }.story-calculation>div strong { font-size:17px; font-variant-numeric:tabular-nums; }.story-calculation b { color:var(--subtle); font-size:12px; font-weight:400; }.story-calculation small { display:block; color:var(--muted); font-size:9px; line-height:1.7; }.calculation-result { display:block; margin-top:12px; font-size:25px; color:var(--accent); }
.proportion-track { height:8px; border-radius:9px; background:var(--line); overflow:hidden; }.proportion-track>span { display:block; height:100%; background:var(--accent); border-radius:inherit; transition:width .25s ease; }.story-proportion>div:last-child,.story-model>div:last-child { display:flex; justify-content:space-between; gap:12px; margin-top:10px; color:var(--muted); font-size:9px; line-height:1.6; }.story-model { margin:24px 0; }
.story-frequency { display:flex; gap:10px; align-items:flex-start; padding:16px 0; color:var(--accent); }.story-frequency svg { flex-shrink:0; margin-top:2px; }.story-frequency p { color:var(--muted); font-size:10px; line-height:1.8; }.story-hint { display:flex; align-items:flex-start; gap:7px; margin-top:22px; color:var(--subtle); font-size:9px; line-height:1.7; }.story-hint svg { flex-shrink:0; margin-top:2px; }.insight-no-results { padding:20px 0; color:var(--muted); font-size:12px; line-height:1.7; }
.insight-panel { padding:24px; }.insight-panel>header { display:flex; align-items:center; gap:12px; }.panel-icon { display:grid; place-items:center; flex-shrink:0; width:36px; height:36px; border-radius:11px; color:var(--yellow); background:var(--surface-tint); }.insight-panel h3 { margin-top:6px; font-size:15px; font-weight:700; line-height:1.4; letter-spacing:-.3px; }.insight-panel>header>[tabindex] { margin-left:auto; color:var(--subtle); }
.multi-chart { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; padding-top:26px; }.multi-chart button { display:flex; flex-direction:column; align-items:center; gap:7px; min-width:0; padding:10px 5px; background:transparent; border:0; border-radius:9px; color:var(--muted); }.multi-chart button:hover,.multi-chart button[aria-pressed=true] { background:var(--surface-tint); color:var(--yellow); }.multi-chart strong { color:var(--text); font-size:18px; }.multi-column { display:flex; align-items:flex-end; justify-content:center; height:105px; width:100%; background:linear-gradient(to top,var(--line-soft) 1px,transparent 1px); background-size:100% 35px; }.multi-column i { display:block; width:min(70%,45px); border-radius:5px 5px 0 0; background:var(--yellow); transition:height .25s; }.multi-chart b { font-size:12px; }.multi-chart small { font-size:9px; }
.multi-insight { display:flex; align-items:center; gap:17px; margin-top:21px; padding:17px; border-radius:11px; background:var(--surface-tint); }.multi-insight>strong { color:var(--yellow); font-size:26px; letter-spacing:-1px; }.multi-insight>div { display:flex; flex-direction:column; gap:5px; }.multi-insight b { font-size:10px; }.multi-insight span { color:var(--muted); font-size:9px; line-height:1.6; }
.clutch-panel .panel-icon { color:var(--insight-gold); }.clutch-lanes { display:grid; gap:5px; margin-top:23px; }.clutch-lanes button { display:grid; grid-template-columns:33px minmax(15px,1fr) 51px 38px; align-items:center; gap:10px; padding:12px 8px; border:0; border-radius:8px; background:transparent; color:var(--muted); }.clutch-lanes button:hover,.clutch-lanes button[aria-pressed=true] { background:var(--surface-tint); }.clutch-lanes b { font-size:13px; color:var(--text); }.clutch-lanes b span { font-size:10px; color:var(--subtle); padding:0 2px; }.clutch-track { height:6px; border-radius:5px; background:var(--line-soft); overflow:hidden; }.clutch-track i { display:block; height:100%; background:var(--insight-gold); border-radius:inherit; }.clutch-lanes strong { text-align:right; color:var(--text); font-size:11px; }.clutch-lanes small { text-align:right; font-size:9px; color:var(--subtle); }
.clutch-insight { display:flex; gap:15px; align-items:center; margin-top:18px; padding:14px; border-radius:11px; background:var(--surface-tint); }.clutch-insight>span { color:var(--insight-gold); font-size:27px; font-weight:700; letter-spacing:-1px; }.clutch-insight p { display:flex; flex-direction:column; gap:5px; font-size:10px; line-height:1.7; color:var(--muted); }.clutch-insight strong { color:var(--text); }
.utility-total { margin-left:auto; color:var(--text); font-size:22px; white-space:nowrap; }.utility-total small { font-weight:400; color:var(--muted); font-size:10px; }.utility-stack { display:flex; height:12px; margin-top:25px; border-radius:6px; overflow:hidden; background:var(--line-soft); gap:3px; }.utility-stack>span { height:100%; }.utility-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:15px; }.utility-options button { display:flex; align-items:center; gap:10px; padding:14px 12px; min-width:0; border:0; border-radius:10px; background:var(--line-soft); color:var(--text); }.utility-options button:hover { background:var(--surface-tint); }.utility-dot { flex:0 0 7px; height:7px; border-radius:50%; background:var(--accent); }.utility-options button>span:nth-child(2) { display:flex; flex-direction:column; gap:5px; font-size:11px; }.utility-options small { color:var(--muted); font-size:9px; }.utility-options strong { margin-left:auto; font-size:21px; }.utility-options svg { flex-shrink:0; color:var(--subtle); }.utility-note { margin-top:13px!important; font-size:10px; line-height:1.7; color:var(--muted); }
@media(max-width:760px) { .insight-dashboard { gap:16px; }.insight-intro h3 { font-size:22px; }.explorer-toolbar { padding:20px; }.insight-search { width:100%; }.insight-topics { grid-template-columns:repeat(4,minmax(0,1fr)); padding:0 12px 15px; }.insight-topics button { font-size:9px; }.explorer-body { grid-template-columns:1fr; }.explorer-metrics { padding:20px; }.metric-story { position:static; margin:0 16px 16px; padding:22px; }.metric-picker { max-height:340px; overflow-y:auto; padding:2px 3px 4px; scrollbar-width:thin; }.insight-panel { padding:20px; }.utility-options { grid-template-columns:1fr; gap:7px; }.utility-total small { display:block; text-align:right; }.story-value { font-size:38px; } }
@media(max-width:380px) { .insight-pulse>button { padding:13px 9px; }.pulse-title { font-size:11px; }.pulse-ring { width:100px; }.pulse-ring strong { font-size:21px; }.pulse-caption { font-size:9px; }.metric-picker button { padding:12px 10px; }.metric-picker strong { font-size:20px; }.clutch-lanes button { gap:7px; }.insight-panel h3 { font-size:13px; } }
@media(prefers-reduced-motion:reduce) { .insight-dashboard * { transition:none!important; } }
</style>
