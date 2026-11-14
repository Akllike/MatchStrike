<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Activity, CalendarDays, Check, Film, Flag, LoaderCircle, Share2, Target, Trophy, Upload, UserPlus, UserRound, UserRoundMinus, Users, X } from '@lucide/vue'
import PageLoader from './components/PageLoader.vue'
import ProfileMatchList from './components/ProfileMatchList.vue'
import AdvancedPerformance from './components/AdvancedPerformance.vue'
import PlayerWeapons from './components/PlayerWeapons.vue'
import { socialIdFromValue, socialProfileUrl } from './socialLinks'
import { ApiRequestError, getPlayerMatches, getPlayerProfile, removeFriendFromList, reportPlayer, sendFriendRequest, updateProfileMedia } from './api'
import type { AuthUser, GameMatch, PlayerProfile } from './api'

const emit = defineEmits<{
  accountUpdated: [user: AuthUser]
  authRequested: []
}>()

const route = useRoute()
const profile = ref<PlayerProfile | null>(null)
type StatsSection = 'overview' | 'advanced' | 'weapons' | 'clutches'
const statsSections: { id: StatsSection; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Обзор', icon: Activity },
  { id: 'advanced', label: 'Расширенная', icon: Target },
  { id: 'weapons', label: 'Оружие', icon: Target },
  { id: 'clutches', label: 'Клатчи', icon: Trophy },
]
const activeStatsSection = ref<StatsSection>('overview')
const activeStatsGroup = ref('all')
const formRange = ref<10 | 20 | 50>(10)
const formRanges = [10, 20, 50] as const
const selectedFormMatchId = ref<number | null>(null)
const selectedClutchOpponents = ref(1)
const loading = ref(true)
const loadError = ref('')
const actionMessage = ref('')
const successToast = ref('')
const toastTone = ref<'success' | 'error'>('success')
const toastTicketId = ref<number | null>(null)
const mediaBusy = ref<'avatar' | 'cover' | null>(null)
const mediaDialog = ref<'avatar' | 'cover' | null>(null)
const mediaDragOver = ref(false)
const mediaError = ref('')
const friendBusy = ref(false)
const removeFriendOpen = ref(false)
const reportOpen = ref(false)
const reportBusy = ref(false)
const reportMessage = ref('')
const mediaInput = ref<HTMLInputElement | null>(null)
const reportForm = ref({ reason: 'cheating' as 'cheating' | 'abuse' | 'other', details: '' })
const reportReasons = [
  { value: 'cheating', label: 'Читы или нечестная игра' },
  { value: 'abuse', label: 'Оскорбления или травля' },
  { value: 'other', label: 'Другое нарушение' },
] as const
let successToastTimeout: number | undefined

const mediaSpecs = {
  avatar: { title: 'Изменить аватар', maxWidth: 2048, maxHeight: 2048, recommended: '512 × 512', maxBytes: 5 * 1024 * 1024, maxSize: '5 МБ' },
  cover: { title: 'Изменить шапку', maxWidth: 4096, maxHeight: 1365, recommended: '1920 × 640', maxBytes: 8 * 1024 * 1024, maxSize: '8 МБ' },
} as const
const activeMediaSpec = computed(() => mediaDialog.value ? mediaSpecs[mediaDialog.value] : null)
const profileTabs = [
  { id: 'overview', label: 'Основное', icon: UserRound },
  { id: 'statistics', label: 'Статистика', icon: Activity },
  { id: 'matches', label: 'Матчи', icon: Trophy },
  { id: 'moments', label: 'Моменты', icon: Film },
  { id: 'friends', label: 'Друзья', icon: Users },
] as const
type ProfileTabId = typeof profileTabs[number]['id']
const activeProfileTab = ref<ProfileTabId>('overview')
const profileMatches = ref<GameMatch[]>([])
const profileMatchesPage = ref(1)
const profileMatchesLastPage = ref(1)
const profileMatchesTotal = ref(0)
const profileMatchesLoading = ref(false)
const profileMatchesError = ref('')
let profileMatchesRequest = 0
const profileMatchesLoadingMore = ref(false)
const profileTabElements = ref<HTMLButtonElement[]>([])

function focusProfileTab(index: number) {
  const nextIndex = (index + profileTabs.length) % profileTabs.length
  selectProfileTab(profileTabs[nextIndex].id)
  nextTick(() => profileTabElements.value[nextIndex]?.focus())
}

function dismissSuccessToast() {
  if (successToastTimeout !== undefined) window.clearTimeout(successToastTimeout)
  successToastTimeout = undefined
  successToast.value = ''
  toastTicketId.value = null
}

function showTopToast(message: string, tone: 'success' | 'error' = 'success', ticketId: number | null = null) {
  if (successToastTimeout !== undefined) window.clearTimeout(successToastTimeout)
  successToastTimeout = undefined
  toastTone.value = tone
  toastTicketId.value = ticketId
  successToast.value = message
  if (ticketId === null) successToastTimeout = window.setTimeout(dismissSuccessToast, 5000)
}

function showSuccessToast(message: string) {
  showTopToast(message)
}

function showMediaError(message: string) {
  mediaError.value = message
  showTopToast(message, 'error')
}

window.addEventListener('scroll', onProfileMatchesScroll, { passive: true })
onBeforeUnmount(() => {
  dismissSuccessToast()
  window.removeEventListener('scroll', onProfileMatchesScroll)
})

const nickname = computed(() => String(route.params.nickname ?? ''))
const stats = computed(() => {
  const values = profile.value?.stats
  const matchStats = profile.value?.donutStats
  const war = profile.value?.donutWarProfile
  const totals = matchStats?.totals ?? {}
  const kills = totals.kills ?? values?.kills ?? 0
  const deaths = totals.deaths ?? values?.deaths ?? 0
  const rounds = totals.rounds ?? 0
  const headshots = totals.headshots ?? 0
  const hasMatchStats = Boolean(matchStats)
  const eloLevel = war?.elo != null ? war.level ?? 0 : 0
  return [
    { label: 'ELO', value: war?.elo ?? '—', note: eloLevel > 0 ? `уровень ${eloLevel}` : 'War-рейтинг', icon: Trophy, level: eloLevel },
    { label: 'Матчи', value: matchStats?.matches ?? war?.matches ?? '—', note: 'сыграно матчей', icon: Activity, level: 0 },
    { label: 'K/D', value: hasMatchStats ? (deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)) : values?.kdr.toFixed(2) ?? '—', note: 'убийства / смерти', icon: Target, level: 0 },
    { label: 'HS%', value: hasMatchStats && kills > 0 ? `${(headshots / kills * 100).toFixed(1)}%` : '—', note: 'хедшоты от убийств', icon: Target, level: 0 },
    { label: 'ADR', value: hasMatchStats && rounds > 0 ? (totals.damage / rounds).toFixed(1) : '—', note: 'средний урон за раунд', icon: Activity, level: 0 },
    { label: 'AVG', value: war?.avg_kills_per_match?.toFixed(1) ?? '—', note: 'убийств за War-матч', icon: Activity, level: 0 },
  ]
})
const matchActivityWeeks = computed(() => {
  const days = profile.value?.matchActivity?.days ?? []
  if (!days.length) return []

  const firstDate = new Date(`${days[0].date}T00:00:00Z`)
  const leadingCells = (firstDate.getUTCDay() + 6) % 7
  const cells: { date: string; count: number }[] = [
    ...Array.from({ length: leadingCells }, () => ({ date: '', count: 0 })),
    ...days,
  ]
  while (cells.length % 7 !== 0) cells.push({ date: '', count: 0 })

  const monthLabel = new Intl.DateTimeFormat('ru', { month: 'short', timeZone: 'UTC' })
  return Array.from({ length: cells.length / 7 }, (_, index) => {
    const weekDays = cells.slice(index * 7, index * 7 + 7)
    const firstOfMonth = weekDays.find(day => day.date.endsWith('-01'))
    return {
      days: weekDays,
      month: firstOfMonth ? monthLabel.format(new Date(`${firstOfMonth.date}T00:00:00Z`)).replace('.', '') : '',
    }
  })
})
const mobileMatchActivityWeeks = computed(() => {
  const weeks = matchActivityWeeks.value.slice(-18).map(week => ({ ...week, days: [...week.days] }))
  if (weeks.length && !weeks[0].month) {
    const firstVisibleDay = weeks[0].days.find(day => day.date)
    if (firstVisibleDay) {
      weeks[0].month = new Intl.DateTimeFormat('ru', { month: 'short', timeZone: 'UTC' })
        .format(new Date(`${firstVisibleDay.date}T00:00:00Z`)).replace('.', '')
    }
  }
  return weeks
})
const mobileMatchActivityTotal = computed(() => mobileMatchActivityWeeks.value
  .flatMap(week => week.days)
  .reduce((total, day) => total + day.count, 0))

function activityLevel(count: number) {
  if (count <= 0) return 'level-0'
  if (count === 1) return 'level-1'
  if (count <= 3) return 'level-2'
  if (count <= 5) return 'level-3'
  return 'level-4'
}

function activityDayTitle(day: { date: string; count: number }) {
  if (!day.date) return ''
  const date = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`))
  return `${date} · матчей: ${day.count}`
}

const detailedStats = computed(() => {
  const totals = profile.value?.donutStats?.totals ?? {}
  const matches = profile.value?.donutStats?.matches ?? 0
  const war = profile.value?.donutWarProfile
  const derived = profile.value?.donutStats?.derived ?? {}
  const category = profile.value?.donutStats?.categoryScores ?? {}
  const value = (key: string) => totals[key] ?? 0
  const derivedValue = (key: string) => derived[key] ?? 0
  const rate = (count: number, denominator: number) => denominator > 0 ? `${(count / denominator * 100).toFixed(1)}%` : '—'
  const rounds = value('rounds')
  const kills = value('kills')
  const deaths = value('deaths')
  const openingTime = value('openingTimeSamples') > 0 ? `${(value('openingTimeTotalMs') / value('openingTimeSamples') / 1000).toFixed(2)} с` : '—'
  const rows: [string, string, string][] = [
    ['Убийства', 'kills', 'Суммарно за сохранённые матчи'], ['Смерти', 'deaths', 'Суммарно за сохранённые матчи'],
    ['Ассисты', 'assists', 'Суммарно за сохранённые матчи'], ['Хедшоты', 'headshots', 'Убийства в голову'],
    ['K/D', '', 'Убийства / смерти'], ['HS%', '', 'Доля убийств в голову'], ['ADR', '', 'Средний урон за раунд'], ['DPR', '', 'Смерти за раунд'],
    ['Урон', 'damage', 'Нанесённый урон'], ['Полученный урон', 'damageTaken', 'Урон, полученный от противников'],
    ['Раунды', 'rounds', 'Завершённые раунды участия'], ['Раунды с убийством', 'roundsWithKill', 'Хотя бы одно убийство'],
    ['Раунды с убийством %', '', 'Доля раундов с фрагом'], ['KAST', '', 'Убийство, ассист, выживание или размен'],
    ['Убийства в выигранных раундах', 'killsInWonRounds', 'Фраги в победных раундах'],
    ['Убийств за победный раунд', '', 'Среднее число фрагов в выигранных раундах'],
    ['Убийства в пережитых раундах', 'killsInSurvivedRounds', 'Фраги в раундах, где игрок выжил'],
    ['Вклад в победу раунда', 'roundWinContributionRounds', 'Раунды с личным вкладом'], ['Доля round win shares', '', 'Доля раундов побед команды с личным вкладом'],
    ['Мультикиллы', 'multikills', 'Раунды минимум с двумя убийствами'],
    ['Раунды с мультикиллом %', '', 'Доля раундов с двумя или более фрагами'],
    ['Трипл-киллы', 'tripleKills', 'Раунды с тремя убийствами'], ['Квадро-киллы', 'quadKills', 'Раунды с четырьмя убийствами'], ['Эйсы', 'aceKills', 'Раунды с пятью и более убийствами'],
    ['Победы в раундах', 'roundsWon', 'Раунды, выигранные командой'], ['Поражения в раундах', 'roundsLost', 'Раунды, проигранные командой'],
    ['Entry попытки', 'openingAttempts', 'Первые дуэли раунда'], ['Entry-фраги', 'openingKills', 'Победы в первых дуэлях'],
    ['Entry смерти', 'openingDeaths', 'Поражения в первых дуэлях'], ['Entry смерть разменяна', 'openingDeathsTraded', 'Первые смерти, за которые команда отомстила'],
    ['Успех первых дуэлей', '', 'Доля выигранных первых дуэлей'], ['Среднее время первой дуэли', '', 'Время от начала раунда'],
    ['Размен первых смертей %', '', 'Доля первых смертей, за которые отомстила команда'],
    ['Замеры времени первых дуэлей', 'openingTimeSamples', 'Количество измерений'],
    ['Победы в клатчах', 'clutchWins', 'Выигранные ситуации 1vX'], ['Попытки клатча', 'clutchAttempts', 'Все ситуации 1vX'],
    ['Успех клатчей', '', 'Доля выигранных ситуаций 1vX'],
    ['Клатч-попыток на 24 раунда', '', 'Частота clutch-ситуаций'],
    ['Последний живой', 'lastAliveRounds', 'Раунды, где игрок остался последним'], ['Постплент раунды', 'postPlantRounds', 'Раунды после установки бомбы'],
    ['Выживания после установки', 'alivePostPlantRounds', 'Выжил в постпленте'],
    ['Раунды со снайперской винтовкой', 'roundsWithSniper', 'Любая снайперская винтовка'], ['Раунды с AWP', 'roundsWithAWP', 'Раунды с AWP'],
    ['Убийства со снайперской винтовки', 'sniperKills', 'Все снайперские винтовки'], ['Убийства с AWP', 'awpKills', 'Фраги из AWP'],
    ['Снайперские убийства %', '', 'Доля от всех фрагов'], ['Убийства с AWP %', '', 'Доля от всех фрагов'],
    ['Выстрелы', 'weaponAttacks', 'За все завершённые матчи'], ['Выстрелы за раунд', '', 'Среднее значение'], ['Время жизни за раунд', '', 'Среднее число секунд'],
    ['Дымовые гранаты', 'smokesThrown', 'Брошено'], ['Ослепляющие гранаты', 'flashesThrown', 'Брошено'],
    ['Зажигательные гранаты', 'molotovsThrown', 'Брошено'], ['Осколочные гранаты', 'heGrenadesThrown', 'Брошено'],
    ['Дымовые за раунд', '', 'Среднее значение'], ['Ослепляющие за раунд', '', 'Среднее значение'],
    ['Зажигательные за раунд', '', 'Среднее значение'], ['Осколочные за раунд', '', 'Среднее значение'],
    ['Смерти, доступные для размена', 'tradeableDeaths', 'Погиб, оставив живого тиммейта'], ['Разменянные смерти', 'deathsTraded', 'Смерти, за которые команда отомстила'],
    ['Trade-фраги', 'tradeKills', 'Убийства в ответ на смерть тиммейта'], ['Возможности размена', 'tradeOpportunities', 'Ситуации для размена'],
    ['Tradeable смерти за раунд', '', 'Смерти с возможностью размена'], ['Разменянные смерти %', '', 'От tradeable-смертей'],
    ['Возможности размена за раунд', '', 'Частота ситуаций для trade'], ['Отменённые размены за раунд', '', 'Где размена не произошло'],
    ['Trade-фраги %', '', 'Доля trade-убийств от всех фрагов'],
    ['Отменённые размены', 'tradeDenials', 'Возможности, где размена не произошло'], ['Bait-ассисты', 'baitAssists', 'Ассисты после урона тиммейта'],
    ['Bait-ассисты за раунд', '', 'Частота поддержки тиммейта'], ['Bait-фраги %', '', 'От всех убийств'], ['Assisted kills %', '', 'Фраги с уроном тиммейта'],
    ['Bait-фраги', 'baitKills', 'Фраги после недавнего урона тиммейта'], ['Assisted kills', 'killsAssisted', 'Убийства с уроном тиммейта'],
    ['Время жизни', 'timeAliveSeconds', 'Секунды в раундах'], ['Убийства в пережитых раундах за раунд', '', 'Perfect kills per round'],
    ['Разница убийств за раунд', '', 'K − D на раунд'], ['Разница убийств за 24 раунда', '', 'K − D в пересчёте на 24 раунда'],
    ['Чистый урон за раунд', '', 'Нанесённый минус полученный'], ['Раунды с убийством %', '', 'Доля раундов с фрагом'],
    ['Последний живой %', '', 'Доля раундов'], ['Выживание после установки %', '', 'Успешность постплента'],
    ['Матчи всего', '', 'Матчи с сохранённой статистикой'], ['Ранг первых дуэлей', '', 'Место среди игроков своей команды'],
    ['Последний ELO', '', 'Срез последнего завершённого матча'], ['Последний уровень', '', 'Уровень в последнем матче'],
    ['Матчи профиля', '', 'Накопительный счётчик плагина'], ['Матчи War', '', 'Накопительный счётчик плагина'],
    ['Убийства профиля', '', 'Накопительный счётчик плагина'],
    ['War ELO', '', 'Рейтинг за завершённые War-матчи'], ['War уровень', '', 'Уровень рейтинга'],
    ['War победы / поражения', '', 'Результаты War-матчей'], ['War среднее убийств', '', 'За завершённый матч'],
    ['War убийства / смерти', '', 'Накопительный War-профиль'], ['War хедшоты', '', 'Накопительный War-профиль'],
    ['War ассисты', '', 'Накопительный War-профиль'], ['War урон', '', 'Накопительный War-профиль'],
    ['War раунды', '', 'Накопительный War-профиль'], ['War KAST раунды', '', 'Накопительный War-профиль'],
    ['War мультикиллы', '', 'Накопительный War-профиль'], ['War победы в клатчах', '', 'Накопительный War-профиль'],
    ['War попытки клатча', '', 'Накопительный War-профиль'],
    ['Оценка Firepower', '', 'Модель DonutStats · от 0 до 100'], ['Оценка Entrying', '', 'Модель DonutStats · от 0 до 100'],
    ['Оценка Trading', '', 'Модель DonutStats · от 0 до 100'], ['Оценка Opening', '', 'Модель DonutStats · от 0 до 100'],
    ['Оценка Closing', '', 'Модель DonutStats · от 0 до 100'], ['Оценка Sniping', '', 'Модель DonutStats · от 0 до 100'],
    ['Оценка Utility', '', 'Модель DonutStats · от 0 до 100'],
  ]

  return rows.map(([label, field, note]) => {
    let display: string | number = field ? value(field) : '—'
    if (label === 'K/D') display = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)
    else if (label === 'HS%') display = rate(value('headshots'), kills)
    else if (label === 'ADR') display = rounds > 0 ? (value('damage') / rounds).toFixed(1) : '—'
    else if (label === 'DPR') display = derivedValue('dpr').toFixed(2)
    else if (label === 'Раунды с убийством %') display = rate(value('roundsWithKill'), rounds)
    else if (label === 'KAST') display = rate(value('kastRounds'), rounds)
    else if (label === 'Убийств за победный раунд') display = derivedValue('killsPerRoundWin').toFixed(2)
    else if (label === 'Доля round win shares') display = `${derivedValue('roundWinSharesPercent').toFixed(1)}%`
    else if (label === 'Раунды с мультикиллом %') display = `${derivedValue('multikillRoundsPercent').toFixed(1)}%`
    else if (label === 'Успех первых дуэлей') display = rate(value('openingKills'), value('openingAttempts'))
    else if (label === 'Среднее время первой дуэли') display = openingTime
    else if (label === 'Размен первых смертей %') display = `${derivedValue('openingTradePercent').toFixed(1)}%`
    else if (label === 'Успех клатчей') display = rate(value('clutchWins'), value('clutchAttempts'))
    else if (label === 'Клатч-попыток на 24 раунда') display = derivedValue('clutchesPer24Rounds').toFixed(2)
    else if (label === 'Tradeable смерти за раунд') display = derivedValue('tradeableDeathsPerRound').toFixed(2)
    else if (label === 'Разменянные смерти %') display = `${derivedValue('deathsTradedPercent').toFixed(1)}%`
    else if (label === 'Возможности размена за раунд') display = derivedValue('tradeOpportunitiesPerRound').toFixed(2)
    else if (label === 'Отменённые размены за раунд') display = derivedValue('tradeDenialsPerRound').toFixed(2)
    else if (label === 'Trade-фраги %') display = `${derivedValue('tradeKillsPercent').toFixed(1)}%`
    else if (label === 'Bait-ассисты за раунд') display = derivedValue('baitAssistsPerRound').toFixed(2)
    else if (label === 'Bait-фраги %') display = `${derivedValue('baitKillsPercent').toFixed(1)}%`
    else if (label === 'Assisted kills %') display = `${derivedValue('assistedKillsPercent').toFixed(1)}%`
    else if (label === 'Снайперские убийства %') display = `${derivedValue('sniperKillPercent').toFixed(1)}%`
    else if (label === 'Убийства с AWP %') display = `${derivedValue('awpKillPercent').toFixed(1)}%`
    else if (label === 'Выстрелы за раунд') display = derivedValue('weaponAttacksPerRound').toFixed(1)
    else if (label === 'Время жизни за раунд') display = `${derivedValue('timeAlivePerRound').toFixed(1)} с`
    else if (label === 'Дымовые за раунд') display = derivedValue('smokesPerRound').toFixed(2)
    else if (label === 'Ослепляющие за раунд') display = derivedValue('flashesPerRound').toFixed(2)
    else if (label === 'Зажигательные за раунд') display = derivedValue('molotovsPerRound').toFixed(2)
    else if (label === 'Осколочные за раунд') display = derivedValue('heGrenadesPerRound').toFixed(2)
    else if (label === 'Убийства в пережитых раундах за раунд') display = derivedValue('perfectKillsPerRound').toFixed(2)
    else if (label === 'Разница убийств за раунд') display = derivedValue('netKillsPerRound').toFixed(2)
    else if (label === 'Разница убийств за 24 раунда') display = derivedValue('netKillsPer24Rounds').toFixed(2)
    else if (label === 'Чистый урон за раунд') display = derivedValue('netDamagePerRound').toFixed(1)
    else if (label === 'Последний живой %') display = `${derivedValue('lastAlivePercent').toFixed(1)}%`
    else if (label === 'Выживание после установки %') display = `${derivedValue('postPlantSurvivalPercent').toFixed(1)}%`
    else if (label === 'Ранг первых дуэлей') display = profile.value?.donutStats?.latest.firstDuelRank ?? '—'
    else if (label.startsWith('Оценка ')) display = category[label.slice('Оценка '.length)] ?? '—'
    else if (label === 'Последний ELO') display = profile.value?.donutStats?.latest.elo ?? '—'
    else if (label === 'Последний уровень') display = profile.value?.donutStats?.latest.level ?? '—'
    else if (label === 'Матчи профиля') display = profile.value?.donutStats?.latest.profileMatches ?? '—'
    else if (label === 'Матчи War') display = profile.value?.donutStats?.latest.warMatches ?? '—'
    else if (label === 'Убийства профиля') display = profile.value?.donutStats?.latest.profileKills ?? '—'
    else if (label === 'Матчи всего') display = matches
    else if (label === 'War ELO') display = war?.elo ?? '—'
    else if (label === 'War уровень') display = war?.level ?? '—'
    else if (label === 'War победы / поражения') display = war ? `${war.wins ?? 0} / ${war.losses ?? 0}` : '—'
    else if (label === 'War среднее убийств') display = war?.avg_kills_per_match?.toFixed(1) ?? '—'
    else if (label === 'War убийства / смерти') display = war ? `${war.kills ?? 0} / ${war.deaths ?? 0}` : '—'
    else if (label === 'War хедшоты') display = war?.headshots ?? '—'
    else if (label === 'War ассисты') display = war?.assists ?? '—'
    else if (label === 'War урон') display = war?.damage ?? '—'
    else if (label === 'War раунды') display = war?.rounds ?? '—'
    else if (label === 'War KAST раунды') display = war?.kast_rounds ?? '—'
    else if (label === 'War мультикиллы') display = war?.multikills ?? '—'
    else if (label === 'War победы в клатчах') display = war?.clutch_wins ?? '—'
    else if (label === 'War попытки клатча') display = war?.clutch_attempts ?? '—'
    if (field === 'timeAliveSeconds' && typeof display === 'number') display = display.toFixed(1)
    return { label, value: display, note, field }
  })
})
const statisticsHighlights = computed(() => ['K/D', 'HS%', 'ADR', 'AVG', 'DPR', 'KAST'].map(label => {
  const summary = profile.value?.donutStats
  const hasRounds = (summary?.totals.rounds ?? 0) > 0
  if (label === 'DPR') return { label, value: hasRounds ? (summary?.derived.dpr ?? 0).toFixed(2) : '—', note: 'смертей за раунд' }
  if (label === 'KAST') return { label, value: hasRounds ? `${(summary?.derived.kastPercent ?? 0).toFixed(1)}%` : '—', note: 'убийство, ассист, выживание или размен' }
  const stat = stats.value.find(item => item.label === label)
  return { label, value: stat?.value ?? '—', note: stat?.note ?? '' }
}))
const levelProgress = computed(() => {
  const elo = profile.value?.donutWarProfile?.elo ?? 0
  const level = profile.value?.donutWarProfile?.level ?? 0
  const levels = [
    { level: 1, start: 100, next: 501 }, { level: 2, start: 501, next: 751 },
    { level: 3, start: 751, next: 901 }, { level: 4, start: 901, next: 1051 },
    { level: 5, start: 1051, next: 1201 }, { level: 6, start: 1201, next: 1351 },
    { level: 7, start: 1351, next: 1531 }, { level: 8, start: 1531, next: 1751 },
    { level: 9, start: 1751, next: 2001 }, { level: 10, start: 2001, next: null },
  ]
  const current = levels.find(item => item.level === level)
  if (!current) return { percent: Math.max(0, Math.min(100, elo)), next: 100, remaining: Math.max(0, 100 - elo), maxed: false }
  if (current.next === null) return { percent: 100, next: null, remaining: 0, maxed: true }
  return {
    percent: Math.max(0, Math.min(100, (elo - current.start) / (current.next - current.start) * 100)),
    next: current.next,
    remaining: Math.max(0, current.next - elo),
    maxed: false,
  }
})
const statGroupDefinitions = [
  { title: 'Боевая эффективность', code: '01 / COMBAT', labels: ['Убийства', 'Смерти', 'Ассисты', 'Хедшоты', 'K/D', 'HS%', 'ADR', 'DPR', 'Урон', 'Полученный урон', 'Разница убийств за раунд', 'Разница убийств за 24 раунда', 'Чистый урон за раунд'] },
  { title: 'Влияние на раунд', code: '02 / ROUND IMPACT', labels: ['Раунды', 'Раунды с убийством', 'Раунды с убийством %', 'KAST', 'Убийства в выигранных раундах', 'Убийств за победный раунд', 'Убийства в пережитых раундах', 'Убийства в пережитых раундах за раунд', 'Вклад в победу раунда', 'Доля round win shares', 'Победы в раундах', 'Поражения в раундах', 'Последний живой', 'Последний живой %', 'Постплент раунды', 'Выживания после установки', 'Выживание после установки %', 'Мультикиллы', 'Раунды с мультикиллом %', 'Трипл-киллы', 'Квадро-киллы', 'Эйсы'] },
  { title: 'Первые дуэли', code: '03 / ENTRY', labels: ['Entry попытки', 'Entry-фраги', 'Entry смерти', 'Entry смерть разменяна', 'Успех первых дуэлей', 'Размен первых смертей %', 'Среднее время первой дуэли', 'Замеры времени первых дуэлей', 'Ранг первых дуэлей'] },
  { title: 'Клатчи', code: '04 / CLUTCH', labels: ['Победы в клатчах', 'Попытки клатча', 'Успех клатчей', 'Клатч-попыток на 24 раунда'] },
  { title: 'Размены и поддержка', code: '05 / TRADING', labels: ['Смерти, доступные для размена', 'Tradeable смерти за раунд', 'Разменянные смерти', 'Разменянные смерти %', 'Trade-фраги', 'Trade-фраги %', 'Возможности размена', 'Возможности размена за раунд', 'Отменённые размены', 'Отменённые размены за раунд', 'Bait-ассисты', 'Bait-ассисты за раунд', 'Bait-фраги', 'Bait-фраги %', 'Assisted kills', 'Assisted kills %'] },
  { title: 'Оружие и utility', code: '06 / EQUIPMENT', labels: ['Раунды со снайперской винтовкой', 'Раунды с AWP', 'Убийства со снайперской винтовки', 'Снайперские убийства %', 'Убийства с AWP', 'Убийства с AWP %', 'Выстрелы', 'Выстрелы за раунд', 'Дымовые гранаты', 'Дымовые за раунд', 'Ослепляющие гранаты', 'Ослепляющие за раунд', 'Зажигательные гранаты', 'Зажигательные за раунд', 'Осколочные гранаты', 'Осколочные за раунд', 'Время жизни', 'Время жизни за раунд'] },
  { title: 'Рейтинг и карьера', code: '07 / CAREER', labels: ['Матчи всего', 'Последний ELO', 'Последний уровень', 'Матчи профиля', 'Матчи War', 'Убийства профиля', 'War ELO', 'War уровень', 'War победы / поражения', 'War среднее убийств', 'War убийства / смерти', 'War хедшоты', 'War ассисты', 'War урон', 'War раунды', 'War KAST раунды', 'War мультикиллы', 'War победы в клатчах', 'War попытки клатча'] },
  { title: 'Категории DonutStats', code: '08 / PLAYER MODEL', labels: ['Оценка Firepower', 'Оценка Entrying', 'Оценка Trading', 'Оценка Opening', 'Оценка Closing', 'Оценка Sniping', 'Оценка Utility'] },
] as const
const detailedStatGroups = computed(() => statGroupDefinitions.map(group => ({
  ...group,
  stats: detailedStats.value.filter((stat, index, rows) => (group.labels as readonly string[]).includes(stat.label)
    && rows.findIndex(row => row.label === stat.label) === index),
})))
const formMatches = computed(() => {
  const matches = profile.value?.donutStats?.form ?? []
  return matches.filter(match => typeof match.elo === 'number').slice(-formRange.value)
})
const formChart = computed(() => {
  const points = formMatches.value.map(match => ({ ...match, value: match.elo as number }))
  if (!points.length) return []
  const min = Math.min(...points.map(point => point.value))
  const max = Math.max(...points.map(point => point.value))
  const padding = Math.max(20, (max - min) * .2)
  return points.map(point => ({ ...point, height: (point.value - min + padding) / (max - min + padding * 2) * 100 }))
})
const eloChange = computed(() => {
  const points = formChart.value
  return points.length > 1 ? points[points.length - 1].value - points[0].value : null
})
const selectedFormMatch = computed(() => formChart.value.find(match => match.id === selectedFormMatchId.value) ?? formChart.value.at(-1) ?? null)
const formPlot = computed(() => {
  const points = formChart.value.map((point, index) => `${formChart.value.length === 1 ? 500 : index / (formChart.value.length - 1) * 1000},${160 - point.height * 1.4}`)
  return { line: points.join(' '), area: `0,180 ${points.join(' ')} 1000,180` }
})
function formMetricValue(value: number) {
  return `${Math.round(value)} ELO`
}
const statCategoryCards = computed(() => {
  const scores = profile.value?.donutStats?.categoryScores ?? {}
  const entries = [
    { key: 'Firepower', label: 'Firepower', group: '01 / COMBAT', hint: 'Урон и дуэли' },
    { key: 'Entrying', label: 'Entrying', group: '03 / ENTRY', hint: 'Первые дуэли' },
    { key: 'Trading', label: 'Trading', group: '05 / TRADING', hint: 'Размены' },
    { key: 'Opening', label: 'Opening', group: '03 / ENTRY', hint: 'Начало раунда' },
    { key: 'Closing', label: 'Closing', group: '02 / ROUND IMPACT', hint: 'Завершение раунда' },
    { key: 'Sniping', label: 'Sniping', group: '06 / EQUIPMENT', hint: 'Снайперские винтовки' },
    { key: 'Utility', label: 'Utility', group: '06 / EQUIPMENT', hint: 'Гранаты и поддержка' },
  ]
  return entries.map(entry => ({ ...entry, score: scores[entry.key] ?? null })).filter(entry => entry.score !== null)
})
const selectedClutchStats = computed(() => {
  const opponents = selectedClutchOpponents.value
  const match = profile.value?.donutStats?.clutchesByX.find(item => item.opponents === opponents) ?? { opponents, wins: 0, attempts: 0 }
  const war = profile.value?.donutWarProfile?.clutches_by_x?.find(item => item.opponents === opponents) ?? { opponents, wins: 0, attempts: 0 }
  return { match, war }
})

function openStatsGroup(group: string) {
  activeStatsGroup.value = group
  activeStatsSection.value = 'advanced'
}

const friendshipLabel = computed(() => {
  if (profile.value?.friendshipStatus === 'accepted') return 'Уже в друзьях'
  if (profile.value?.friendshipStatus === 'pending') return 'Заявка отправлена'
  if (profile.value?.friendshipStatus === 'incoming') return 'Есть входящая заявка'
  return 'Добавить в друзья'
})

const joinedLabel = computed(() => {
  if (!profile.value?.joinedAt) return 'Участник MatchStrike'
  return `В MatchStrike с ${new Date(`${profile.value.joinedAt}T00:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`
})

async function loadProfile() {
  if (!nickname.value) return
  loading.value = true
  loadError.value = ''
  actionMessage.value = ''
  profileMatches.value = []
  profileMatchesPage.value = 1
  profileMatchesLastPage.value = 1
  profileMatchesTotal.value = 0
  profileMatchesError.value = ''
  profileMatchesLoading.value = false
  profileMatchesRequest++
  activeProfileTab.value = 'overview'
  dismissSuccessToast()

  try {
    profile.value = await getPlayerProfile(nickname.value)
  } catch (error) {
    profile.value = null
    loadError.value = error instanceof ApiRequestError && error.status === 404
      ? 'Игрок с таким никнеймом не найден.'
      : 'Не удалось загрузить профиль. Попробуйте ещё раз.'
  } finally {
    loading.value = false
  }
}

async function loadProfileMatches(page = 1, append = false) {
  if (!nickname.value || profileMatchesLoading.value || profileMatchesLoadingMore.value) return
  if (append && page > profileMatchesLastPage.value) return
  const requestId = ++profileMatchesRequest
  if (append) profileMatchesLoadingMore.value = true
  else profileMatchesLoading.value = true
  profileMatchesError.value = ''
  try {
    const data = await getPlayerMatches(nickname.value, page)
    if (requestId !== profileMatchesRequest) return
    profileMatches.value = append ? [...profileMatches.value, ...data.matches] : data.matches
    profileMatchesPage.value = data.pagination.currentPage
    profileMatchesLastPage.value = data.pagination.lastPage
    profileMatchesTotal.value = data.pagination.total
  } catch (error) {
    if (requestId === profileMatchesRequest) {
      profileMatchesError.value = error instanceof Error ? error.message : 'Не удалось загрузить матчи.'
    }
  } finally {
    if (requestId === profileMatchesRequest) {
      profileMatchesLoading.value = false
      profileMatchesLoadingMore.value = false
    }
  }
}

function selectProfileTab(tab: ProfileTabId) {
  activeProfileTab.value = tab
  if (tab === 'matches' && !profileMatches.value.length && profileMatchesTotal.value === 0 && !profileMatchesLoading.value) {
    void loadProfileMatches(1)
  }
}

function onProfileMatchesScroll() {
  if (activeProfileTab.value === 'matches' && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 700 && profileMatchesPage.value < profileMatchesLastPage.value) {
    void loadProfileMatches(profileMatchesPage.value + 1, true)
  }
}


function openMediaDialog(field: 'avatar' | 'cover') {
  mediaDialog.value = field
  mediaDragOver.value = false
  mediaError.value = ''
}

function closeMediaDialog() {
  if (mediaBusy.value !== null) return
  mediaDialog.value = null
  mediaDragOver.value = false
  mediaError.value = ''
}

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Не удалось прочитать изображение.'))
    }
    image.src = objectUrl
  })
}

async function uploadMedia(file: File, field: 'avatar' | 'cover') {
  const spec = mediaSpecs[field]
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showMediaError('Выберите изображение в формате JPG, PNG или WebP.')
    return
  }
  if (file.size > spec.maxBytes) {
    showMediaError(`Размер файла не должен превышать ${spec.maxSize}.`)
    return
  }

  let dimensions: { width: number; height: number }
  try {
    dimensions = await imageDimensions(file)
  } catch {
    showMediaError('Не удалось прочитать изображение.')
    return
  }
  if (dimensions.width > spec.maxWidth || dimensions.height > spec.maxHeight) {
    showMediaError(`Максимальное разрешение: ${spec.maxWidth} × ${spec.maxHeight} px.`)
    return
  }

  mediaBusy.value = field
  mediaError.value = ''
  actionMessage.value = ''
  try {
    const user = await updateProfileMedia({ [field]: file })
    emit('accountUpdated', user)
    profile.value = await getPlayerProfile(user.nickname)
    showSuccessToast(field === 'avatar' ? 'Аватар профиля обновлён' : 'Шапка профиля обновлена')
    mediaDialog.value = null
    mediaDragOver.value = false
  } catch (error) {
    showMediaError(error instanceof ApiRequestError
      ? Object.values(error.errors).flat()[0] ?? error.message
      : 'Не удалось загрузить изображение.')
  } finally {
    mediaBusy.value = null
  }
}

function handleMediaInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const field = mediaDialog.value
  input.value = ''
  if (file && field) void uploadMedia(file, field)
}

function handleMediaDrop(event: DragEvent) {
  mediaDragOver.value = false
  if (mediaBusy.value !== null) return
  const file = event.dataTransfer?.files[0]
  const field = mediaDialog.value
  if (file && field) void uploadMedia(file, field)
}

async function addFriend() {
  if (!profile.value || friendBusy.value) return
  friendBusy.value = true
  actionMessage.value = ''
  try {
    const result = await sendFriendRequest(profile.value.nickname)
    profile.value.friendshipStatus = result.status
    if (result.status === 'pending') showSuccessToast('Заявка в друзья отправлена')
  } catch (error) {
    actionMessage.value = error instanceof ApiRequestError && error.status === 401
      ? 'Войдите в аккаунт, чтобы добавить игрока в друзья.'
      : error instanceof ApiRequestError ? error.message : 'Не удалось отправить заявку.'
  } finally {
    friendBusy.value = false
  }
}

async function confirmRemoveFriend() {
  if (!profile.value || friendBusy.value) return
  friendBusy.value = true
  try {
    await removeFriendFromList(profile.value.nickname)
    profile.value = await getPlayerProfile(profile.value.nickname)
    removeFriendOpen.value = false
    showSuccessToast('Пользователь удалён из друзей')
  } catch (error) {
    actionMessage.value = error instanceof ApiRequestError ? error.message : 'Не удалось удалить пользователя из друзей.'
    removeFriendOpen.value = false
  } finally { friendBusy.value = false }
}

const socialPlatforms = [
  { id: 'telegram', label: 'Telegram', icon: 'telegram-svgrepo-com.svg' },
  { id: 'instagram', label: 'Instagram', icon: 'instagram-1-svgrepo-com.svg' },
  { id: 'youtube', label: 'YouTube', icon: 'youtube-svgrepo-com.svg' },
  { id: 'twitch', label: 'Twitch', icon: 'twitch-v2-svgrepo-com.svg' },
  { id: 'trovo', label: 'Trovo', icon: 'trovo.svg' },
  { id: 'boosty', label: 'Boosty', icon: 'boosty.svg' },
] as const
const visibleSocialPlatforms = computed(() => socialPlatforms.filter(({ id }) => profile.value?.socialLinks?.[id]))

function socialUsername(platform: typeof socialPlatforms[number]['id']): string {
  return socialIdFromValue(platform, profile.value?.socialLinks?.[platform])
}

function openReportDialog() {
  if (!profile.value) return
  if (!profile.value.isAuthenticated) {
    emit('authRequested')
    return
  }
  reportMessage.value = ''
  actionMessage.value = ''
  reportOpen.value = true
}

async function submitReport() {
  if (!profile.value || reportBusy.value) return
  reportBusy.value = true
  reportMessage.value = ''
  try {
    const result = await reportPlayer(profile.value.nickname, reportForm.value)
    reportOpen.value = false
    showTopToast('Жалоба отправлена модераторам. Создано обращение.', 'success', result.ticketId)
    reportForm.value.details = ''
  } catch (error) {
    reportMessage.value = error instanceof ApiRequestError && error.status === 401
      ? 'Войдите в аккаунт, чтобы отправить жалобу.'
      : error instanceof ApiRequestError ? error.message : 'Не удалось отправить жалобу.'
  } finally {
    reportBusy.value = false
  }
}

watch(nickname, loadProfile, { immediate: true })
</script>

<template>
  <Transition name="profile-content" mode="out-in">
    <PageLoader v-if="loading" message="Загружаем профиль…" />
    <div v-else-if="loadError" class="empty-state section-empty profile-state-error">
      <span class="empty-icon"><Users :size="21" /></span>
      <div><strong>{{ loadError }}</strong><span>Проверьте ссылку и попробуйте ещё раз.</span></div>
    </div>
    <div v-else-if="profile" class="profile-page">
    <section class="profile-hero" :class="{ 'is-blocked': profile.isBlocked }" aria-label="Профиль игрока">
      <div class="profile-cover" :class="{ 'has-cover': profile.coverUrl, 'is-blocked': profile.isBlocked }" :style="profile.coverUrl ? { backgroundImage: `linear-gradient(90deg, rgba(10,11,12,.76), rgba(10,11,12,.12)), url('${profile.coverUrl}')` } : undefined">
        <div class="profile-cover-code">MATCHSTRIKE <span>/ PLAYER CARD</span></div>
        <template v-if="profile.isOwn">
          <button class="profile-edit-cover" type="button" :disabled="mediaBusy !== null" @click="openMediaDialog('cover')">
            Изменить шапку
          </button>
        </template>
      </div>
      <div class="profile-identity-row">
        <div class="profile-avatar-large-wrap" :class="{ 'is-blocked': profile.isBlocked, 'has-avatar': profile.avatarUrl }">
          <img v-if="profile.avatarUrl" class="profile-avatar-large" :src="profile.avatarUrl" alt="" />
          <span v-else class="profile-avatar-large profile-avatar-fallback">{{ profile.nickname.slice(0, 1).toUpperCase() }}</span>
          <template v-if="profile.isOwn">
            <button class="avatar-edit-button" type="button" aria-label="Изменить аватар" :disabled="mediaBusy !== null" @click="openMediaDialog('avatar')">+</button>
          </template>
        </div>
        <div class="profile-title-group">
          <h1>{{ profile.nickname }}</h1>
          <span v-if="!profile.isBlocked"><CalendarDays :size="13" /> {{ joinedLabel }}</span>
          <strong v-if="profile.isBlocked" class="profile-blocked-notice">Профиль пользователя заблокирован.</strong>
        </div>
        <div v-if="!profile.isOwn && !profile.isBlocked" class="profile-actions">
          <button v-if="profile.isAuthenticated && profile.friendshipStatus === 'accepted'" class="profile-friend-button profile-remove-friend-button" type="button" :disabled="friendBusy" @click="removeFriendOpen = true">
            <UserRoundMinus :size="16" /> Удалить из друзей
          </button>
          <button v-else-if="profile.isAuthenticated" class="profile-friend-button" type="button" :disabled="friendBusy || profile.friendshipStatus !== null" @click="addFriend">
            <UserPlus :size="16" /> {{ friendBusy ? 'Отправляем…' : friendshipLabel }}
          </button>
          <button class="profile-report-button" type="button" @click="openReportDialog"><Flag :size="15" /> Пожаловаться</button>
        </div>
        <RouterLink v-else-if="profile.isOwn && !profile.isBlocked" class="profile-settings-link" to="/settings">Настройки профиля</RouterLink>
      </div>
      <p v-if="actionMessage" class="profile-action-message" role="status">{{ actionMessage }}</p>
    </section>

    <div v-if="!profile.isBlocked" class="profile-tabs" role="tablist" aria-label="Разделы профиля">
      <button
        v-for="(tab, index) in profileTabs"
        :id="`profile-tab-${tab.id}`"
        :key="tab.id"
        ref="profileTabElements"
        class="profile-tab"
        type="button"
        role="tab"
        :aria-selected="activeProfileTab === tab.id"
        :aria-controls="`profile-panel-${tab.id}`"
        :tabindex="activeProfileTab === tab.id ? 0 : -1"
        @click="selectProfileTab(tab.id)"
        @keydown.right.prevent="focusProfileTab(index + 1)"
        @keydown.left.prevent="focusProfileTab(index - 1)"
        @keydown.home.prevent="focusProfileTab(0)"
        @keydown.end.prevent="focusProfileTab(profileTabs.length - 1)"
      >
        <component :is="tab.icon" :size="15" :stroke-width="1.8" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <Transition name="profile-tab-swap" mode="out-in">
    <div
      v-if="!profile.isBlocked && activeProfileTab === 'overview'"
      id="profile-panel-overview"
      class="profile-tab-panel"
      role="tabpanel"
      aria-labelledby="profile-tab-overview"
      tabindex="0"
    >
    <section class="profile-section" aria-labelledby="profile-stats-title">
      <div class="section-heading">
        <div><div class="section-kicker">PLAYER PERFORMANCE</div><h2 id="profile-stats-title">Основная информация</h2></div>
        <span class="section-count">CS <span>STATS</span></span>
      </div>
      <div class="profile-overview-grid">
        <div class="profile-overview-main">
          <div class="profile-stat-grid">
            <article v-for="(stat, index) in stats" :key="stat.label" class="profile-stat-item">
              <div class="profile-stat-label"><component :is="stat.icon" :size="15" /><span>{{ stat.label }}</span><span class="profile-stat-index">0{{ index + 1 }}</span></div>
              <strong :class="{ 'has-level-icon': stat.label === 'ELO' }"><img v-if="stat.label === 'ELO'" class="profile-stat-level-icon" :src="`/icons/levels/level-${stat.level}.svg`" :alt="stat.level > 0 ? `Уровень ${stat.level}` : 'Unknown'" />{{ stat.value }}</strong>
              <small>{{ stat.note }}</small>
            </article>
          </div>
          <div v-if="profile.stats" class="profile-server-stats">
            <article v-for="server in profile.stats.servers" :key="server.serverId" class="profile-server-stat-row">
              <div class="profile-server-stat-name"><strong>{{ server.serverName }}</strong><span>{{ server.rank === null ? 'Ранг не указан' : `Ранг ${server.rank}` }}</span></div>
              <div class="profile-server-stat-values"><span>{{ server.kills }} убийств</span><span>{{ server.deaths }} смертей</span><span>{{ server.points }} очков</span></div>
              <RouterLink class="profile-server-stat-link" :to="{ name: 'stats', query: { server: server.serverId } }">Открыть сервер</RouterLink>
            </article>
          </div>
        </div>
        <div class="profile-overview-aside">
          <section class="profile-aside-card" aria-labelledby="profile-social-title">
            <div class="profile-aside-title"><Share2 :size="15" /><h3 id="profile-social-title">Социальные сети</h3></div>
            <div v-if="visibleSocialPlatforms.length" class="profile-friends-stack profile-social-stack">
              <a
                v-for="platform in visibleSocialPlatforms"
                :key="platform.id"
                class="profile-friends-stack-item profile-social-stack-item"
                :href="socialProfileUrl(platform.id, profile?.socialLinks?.[platform.id]) ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
                v-tooltip="`${platform.label} · ${socialUsername(platform.id)}`"
                :aria-label="`Открыть ${platform.label}: ${socialUsername(platform.id)}`"
              >
                <img :src="`/uploads/icons/${platform.icon}`" alt="" aria-hidden="true" width="38" height="38" loading="lazy" />
              </a>
            </div>
            <p v-else class="profile-aside-note">Пользователь пока не добавил ссылки на социальные сети.</p>
          </section>
          <section class="profile-aside-card" aria-labelledby="profile-friends-mini-title">
            <div class="profile-aside-title"><Users :size="15" /><h3 id="profile-friends-mini-title">Друзья</h3><button v-if="profile.friends.length" class="profile-friends-open" type="button" @click="selectProfileTab('friends')">Все друзья · {{ profile.friends.length }}</button></div>
            <template v-if="profile.friends.length">
              <div class="profile-friends-stack">
                <RouterLink
                  v-for="friend in profile.friends.slice(0, 5)"
                  :key="friend.id"
                  class="profile-friends-stack-item"
                  :to="{ name: 'profile', params: { nickname: friend.nickname } }"
                  v-tooltip="friend.nickname"
                  :aria-label="`Открыть профиль ${friend.nickname}`"
                >
                  <img v-if="friend.avatarUrl" :src="friend.avatarUrl" alt="" />
                  <template v-else>{{ friend.nickname.slice(0, 1).toUpperCase() }}</template>
                </RouterLink>
                <button
                  v-if="profile.friends.length > 5"
                  class="profile-friends-stack-item profile-friends-stack-more"
                  type="button"
                  v-tooltip="`Все друзья: ${profile.friends.length}`"
                  @click="selectProfileTab('friends')"
                >+{{ profile.friends.length - 5 }}</button>
              </div>
            </template>
            <p v-else class="profile-aside-note">Список друзей пока пуст. Принятые друзья игрока появятся здесь.</p>
          </section>
        </div>
      </div>
      <section v-if="profile.matchActivity" class="profile-match-activity" aria-labelledby="profile-match-activity-title">
        <div class="profile-match-activity-heading">
          <div class="profile-match-activity-title-wrap"><span class="profile-match-activity-icon"><Activity :size="15" /></span><div><h3 id="profile-match-activity-title">Активность матчей</h3><span class="profile-activity-year-label">За последние 365 дней</span><span class="profile-activity-mobile-label">За последние 4 месяца</span></div></div>
          <strong class="profile-activity-year-label"><b>{{ profile.matchActivity.total }}</b><span>матчей</span></strong>
          <strong class="profile-activity-mobile-label"><b>{{ mobileMatchActivityTotal }}</b><span>матчей</span></strong>
        </div>
        <div class="profile-activity-scroll" role="group" aria-label="Календарь активности матчей по дням">
          <div class="profile-activity-calendar profile-activity-calendar-desktop" :style="{ '--activity-weeks': matchActivityWeeks.length }">
            <div class="profile-activity-months" aria-hidden="true">
              <span v-for="(week, weekIndex) in matchActivityWeeks" :key="`month-${weekIndex}`">{{ week.month }}</span>
            </div>
            <div class="profile-activity-body">
              <div class="profile-activity-weekdays" aria-hidden="true"><span>Пн</span><span></span><span>Ср</span><span></span><span>Пт</span><span></span><span></span></div>
              <div class="profile-activity-weeks">
                <div v-for="(week, weekIndex) in matchActivityWeeks" :key="`week-${weekIndex}`" class="profile-activity-week">
                  <span
                    v-for="(day, dayIndex) in week.days"
                    :key="day.date || `blank-${weekIndex}-${dayIndex}`"
                    class="profile-activity-day"
                    :class="activityLevel(day.count)"
                    v-tooltip="activityDayTitle(day)"
                    :aria-label="day.date ? activityDayTitle(day) : undefined"
                    :aria-hidden="!day.date"
                  ></span>
                </div>
              </div>
            </div>
            <div class="profile-activity-legend" aria-hidden="true"><span>Меньше</span><i class="level-0"></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i><span>Больше</span></div>
          </div>
          <div class="profile-activity-calendar profile-activity-calendar-mobile" :style="{ '--activity-weeks': mobileMatchActivityWeeks.length }">
            <div class="profile-activity-months" aria-hidden="true">
              <span v-for="(week, weekIndex) in mobileMatchActivityWeeks" :key="`mobile-month-${weekIndex}`">{{ week.month }}</span>
            </div>
            <div class="profile-activity-body">
              <div class="profile-activity-weekdays" aria-hidden="true"><span>Пн</span><span></span><span>Ср</span><span></span><span>Пт</span><span></span><span></span></div>
              <div class="profile-activity-weeks">
                <div v-for="(week, weekIndex) in mobileMatchActivityWeeks" :key="`mobile-week-${weekIndex}`" class="profile-activity-week">
                  <span
                    v-for="(day, dayIndex) in week.days"
                    :key="day.date || `mobile-blank-${weekIndex}-${dayIndex}`"
                    class="profile-activity-day"
                    :class="activityLevel(day.count)"
                    v-tooltip="activityDayTitle(day)"
                    :aria-label="day.date ? activityDayTitle(day) : undefined"
                    :aria-hidden="!day.date"
                  ></span>
                </div>
              </div>
            </div>
            <div class="profile-activity-legend" aria-hidden="true"><span>Меньше</span><i class="level-0"></i><i class="level-1"></i><i class="level-2"></i><i class="level-3"></i><i class="level-4"></i><span>Больше</span></div>
          </div>
        </div>
      </section>
    </section>

    <section class="profile-section" aria-labelledby="profile-matches-title">
      <div class="section-heading">
        <div><div class="section-kicker">RECENT ACTIVITY</div><h2 id="profile-matches-title">Последние матчи</h2></div>
        <div class="profile-matches-heading-actions">
          <button
            v-if="profile.recentMatches.length"
            class="profile-matches-more inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
            type="button"
            @click="selectProfileTab('matches')"
          >Все матчи <ChevronRight :size="14" /></button>
        </div>
      </div>
      <ProfileMatchList :matches="profile.recentMatches.slice(0, 5)" />
    </section>

    <section class="profile-section" aria-labelledby="map-winrate-title">
      <div class="section-heading">
        <div><div class="section-kicker">MAP PERFORMANCE</div><h2 id="map-winrate-title">Винрейт по картам</h2></div>
        <span class="section-count">{{ profile.mapWinRates.length.toString().padStart(2, '0') }} <span>КАРТ</span></span>
      </div>
      <div v-if="profile.mapWinRates.length" class="map-winrate-list">
        <article v-for="map in profile.mapWinRates" :key="map.map" class="map-winrate-row">
          <strong>{{ map.map }}</strong>
          <div class="map-winrate-track"><span :style="{ width: `${map.winRate}%` }"></span></div>
          <span class="map-winrate-value">{{ map.winRate }}%</span>
          <small>{{ map.wins }} / {{ map.matches }} побед</small>
        </article>
      </div>
      <div v-else class="empty-state section-empty map-winrate-empty">
        <span class="empty-icon"><Target :size="21" /></span>
        <div><strong>Нет данных по картам</strong><span>Винрейт появится после завершённых матчей.</span></div>
      </div>
    </section>
    </div>

    <section
      v-else-if="!profile.isBlocked && activeProfileTab === 'statistics'"
      id="profile-panel-statistics"
      class="profile-tab-panel profile-section"
      role="tabpanel"
      aria-labelledby="profile-tab-statistics"
      tabindex="0"
    >
      <div class="profile-statistics-header mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><div class="section-kicker">PLAYER PERFORMANCE</div><h2 class="text-xl font-bold tracking-tight text-slate-100">Статистика игрока</h2><p class="mt-1 text-xs text-slate-400">Форма, игровые привычки и влияние на раунд</p></div>
        <span class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-300"><Activity :size="13" class="text-amber-300" /> {{ profile.donutStats?.matches ?? 0 }} матчей учтено</span>
      </div>

      <nav class="profile-stats-nav" role="group" aria-label="Раздел статистики игрока">
        <button v-for="section in statsSections" :key="section.id" class="profile-stats-nav-button" :class="{ 'is-active': activeStatsSection === section.id }" type="button" :aria-pressed="activeStatsSection === section.id" @click="activeStatsSection = section.id"><component :is="section.icon" :size="14" /><span>{{ section.label }}</span></button>
      </nav>

      <div v-if="activeStatsSection === 'overview'" class="profile-statistics-summary grid grid-cols-1 gap-3 xl:grid-cols-[minmax(250px,0.9fr)_minmax(0,2fr)]">
        <section class="profile-rating-card relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-white shadow-xl" aria-label="War рейтинг">
          <div class="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl"></div>
          <div class="relative flex h-full flex-col justify-between gap-7">
            <div class="flex items-start justify-between gap-3"><div><div class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Competitive rating</div><div class="mt-1 text-sm font-semibold text-slate-200">War ELO</div></div><span class="rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-amber-200"><Trophy :size="17" /></span></div>
            <div class="flex items-center gap-3">
              <img class="h-14 w-14" :class="{ 'drop-shadow-[0_0_16px_rgba(251,191,36,0.25)]': profile.donutWarProfile?.elo != null }" :src="`/icons/levels/level-${profile.donutWarProfile?.elo != null ? profile.donutWarProfile.level ?? 0 : 0}.svg`" :alt="profile.donutWarProfile?.elo != null && profile.donutWarProfile.level ? `Уровень ${profile.donutWarProfile.level}` : 'Unknown'" />
              <div><div class="font-mono text-4xl font-bold leading-none tracking-tight text-white">{{ profile.donutWarProfile?.elo ?? '—' }}</div><div class="mt-2 text-xs text-slate-400">{{ profile.donutWarProfile ? `Уровень ${profile.donutWarProfile.level || '—'} · ${profile.donutWarProfile.matches ?? 0} матчей` : 'Рейтинг появится после War-матчей' }}</div></div>
            </div>
            <div v-if="profile.donutWarProfile" class="space-y-2">
              <div class="flex items-center justify-between text-[10px] font-medium text-slate-400"><span>{{ levelProgress.maxed ? 'Максимальный уровень' : `${levelProgress.remaining} ELO до следующего уровня` }}</span><span>{{ levelProgress.maxed ? 'MAX' : `ур. ${profile.donutWarProfile.level ?? 0} → ${Number(profile.donutWarProfile.level ?? 0) + 1}` }}</span></div>
              <div class="h-1.5 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200 transition-[width] duration-700" :style="{ width: `${levelProgress.percent}%` }"></div></div>
              <div class="flex justify-between font-mono text-[9px] text-slate-500"><span>{{ profile.donutWarProfile.elo ?? 0 }} ELO</span><span>{{ levelProgress.next ? `${levelProgress.next} ELO` : '2001+ ELO' }}</span></div>
            </div>
            <div v-else class="rounded-xl border border-dashed border-slate-700 px-3 py-2 text-[11px] leading-relaxed text-slate-400">Заверши первый матч War, чтобы получить ELO и уровень.</div>
          </div>
        </section>

        <div class="profile-statistics-highlights grid grid-cols-2 gap-3 lg:grid-cols-4">
          <article v-for="(stat, index) in statisticsHighlights" :key="stat.label" class="profile-stat-highlight rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
            <div class="flex items-center justify-between gap-2"><span class="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{{ stat.label }}</span><span class="font-mono text-[9px] text-slate-600">0{{ index + 1 }}</span></div>
            <strong class="mt-5 block font-mono text-2xl font-semibold tracking-tight text-slate-100">{{ stat.value }}</strong>
            <small class="mt-1 block text-[10px] leading-relaxed text-slate-500">{{ stat.note }}</small>
            <div class="mt-4 h-px bg-gradient-to-r from-amber-300/50 via-slate-700 to-transparent"></div>
          </article>
        </div>
      </div>

      <section v-if="activeStatsSection === 'overview' && profile.donutStats" class="profile-form-panel mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70 sm:p-5" aria-labelledby="profile-form-title">
        <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><div class="font-mono text-[9px] font-bold tracking-[0.16em] text-amber-600 dark:text-amber-300">RATING HISTORY</div><h3 id="profile-form-title" class="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">История ELO</h3><p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Сохранённый рейтинг после War-матчей</p></div>
          <div class="profile-stats-controls">
            <span class="profile-stats-mode-badge">Только War</span>
            <div class="profile-stats-control-group" aria-label="Число записей рейтинга">
              <button v-for="count in formRanges" :key="count" type="button" :aria-pressed="formRange === count" @click="formRange = count">{{ count }}</button>
            </div>
          </div>
        </header>
        <div v-if="eloChange !== null" class="mb-2 text-xs font-semibold" :class="eloChange >= 0 ? 'text-emerald-500' : 'text-rose-400'">{{ eloChange > 0 ? '+' : '' }}{{ eloChange }} ELO <span class="font-normal text-slate-500">за выбранный период</span></div>
        <div v-if="formChart.length" class="profile-form-chart" role="group" aria-label="График изменения ELO">
          <svg v-if="formChart.length > 1" class="profile-form-line" viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="profile-form-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".22" /><stop offset="100%" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs>
            <polygon :points="formPlot.area" fill="url(#profile-form-fill)" />
            <polyline :points="formPlot.line" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          </svg>
          <button v-for="(point, index) in formChart" :key="point.id" class="profile-form-point" :class="{ 'is-selected': selectedFormMatch?.id === point.id }" type="button" v-tooltip="`${point.map} · ${point.mode} · ${formMetricValue(point.value)}`" :aria-label="`${point.map}, ${point.mode}: ${formMetricValue(point.value)}`" @mouseenter="selectedFormMatchId = point.id" @focus="selectedFormMatchId = point.id" @click="selectedFormMatchId = point.id">
            <span class="profile-form-bar" :style="{ height: `${point.height}%` }"></span>
            <small v-if="formChart.length <= 10 || index % 5 === 0">{{ point.date.slice(5).split('-').reverse().join('.') }}</small>
          </button>
        </div>
        <div v-if="selectedFormMatch" class="profile-form-selection"><strong>{{ selectedFormMatch.map }}</strong><span>{{ selectedFormMatch.date }} · {{ selectedFormMatch.mode }}</span><b>{{ formMetricValue(selectedFormMatch.value) }}</b></div>
        <p v-else class="profile-stats-empty-note">История появится после War-матчей с сохранённым рейтингом ELO.</p>
      </section>

      <section v-if="activeStatsSection === 'overview' && statCategoryCards.length" class="mt-4" aria-label="Категории игры">
        <div class="mb-3 flex items-end justify-between"><div><div class="section-kicker">PLAYER MODEL</div><h3 class="text-sm font-bold text-slate-100">Сильные стороны</h3></div><span class="text-[9px] text-slate-500">нажмите, чтобы открыть метрики</span></div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          <button v-for="category in statCategoryCards" :key="category.key" class="profile-category-card" type="button" @click="openStatsGroup(category.group)">
            <span>{{ category.label }}</span><strong>{{ category.score }}<small>/100</small></strong><i><b :style="{ width: `${category.score}%` }"></b></i><small>{{ category.hint }}</small>
          </button>
        </div>
      </section>

      <section v-if="activeStatsSection === 'advanced' && profile.donutStats" class="mt-4">
        <AdvancedPerformance v-model:group="activeStatsGroup" :stats="profile.donutStats" :groups="detailedStatGroups" />
      </section>
      <div v-if="activeStatsSection === 'advanced' && !profile.donutStats" class="profile-statistics-empty mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <span class="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-300/10 dark:text-amber-200"><Activity :size="19" /></span>
        <div class="profile-empty-copy">
        <h3 class="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">Матчевой статистики пока нет</h3>
        <p class="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">После завершения игр с подключённым DonutStats здесь появятся показатели по раундам, entry, разменам, оружию и utility.</p>
        </div>
      </div>

      <PlayerWeapons v-if="activeStatsSection === 'weapons'" :catalog="profile.weaponCatalog ?? []" :stats="profile.donutStats?.weaponStats ?? null" />

      <section v-if="activeStatsSection === 'clutches'" class="mt-4" aria-labelledby="profile-clutches-title">
        <div class="mb-3 flex items-end justify-between gap-3"><div><div class="section-kicker">CLUTCH PERFORMANCE</div><h2 id="profile-clutches-title" class="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">Клатчи 1vX</h2></div><span class="font-mono text-[10px] text-slate-400">WINS / ATTEMPTS</span></div>
        <div v-if="profile.donutStats?.clutchesByX.some(item => item.attempts > 0)" class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <button v-for="clutch in profile.donutStats.clutchesByX" :key="clutch.opponents" class="rounded-xl border p-3 text-left shadow-sm transition-colors" :class="selectedClutchOpponents === clutch.opponents ? 'border-amber-400 bg-amber-50 dark:border-amber-300/60 dark:bg-amber-300/10' : 'border-slate-200 bg-white dark:border-slate-700/70 dark:bg-slate-900/70'" type="button" :aria-pressed="selectedClutchOpponents === clutch.opponents" @click="selectedClutchOpponents = clutch.opponents">
            <div class="flex items-center justify-between"><span class="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">1v{{ clutch.opponents }}</span><span class="font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-300">{{ clutch.attempts ? `${(clutch.wins / clutch.attempts * 100).toFixed(1)}%` : '—' }}</span></div>
            <strong class="mt-2 block font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{{ clutch.wins }}<span class="mx-1 text-slate-300 dark:text-slate-600">/</span><span class="text-sm text-slate-500">{{ clutch.attempts }}</span></strong>
            <div class="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-amber-400" :style="{ width: `${clutch.attempts ? clutch.wins / clutch.attempts * 100 : 0}%` }"></div></div>
          </button>
        </div>
        <div v-else class="profile-stats-empty-note">Для этих матчей пока нет данных о клатчах.</div>
        <article class="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70 sm:grid-cols-2">
          <div><span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Матчевые данные · 1v{{ selectedClutchOpponents }}</span><strong class="mt-2 block font-mono text-xl text-slate-900 dark:text-white">{{ selectedClutchStats.match.wins }} <small class="text-sm text-slate-400">побед из {{ selectedClutchStats.match.attempts }}</small></strong></div>
          <div v-if="profile.donutWarProfile"><span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">War-карьера · 1v{{ selectedClutchOpponents }}</span><strong class="mt-2 block font-mono text-xl text-slate-900 dark:text-white">{{ selectedClutchStats.war.wins }} <small class="text-sm text-slate-400">побед из {{ selectedClutchStats.war.attempts }}</small></strong></div>
        </article>
      </section>

      <p v-if="activeStatsSection === 'advanced' && profile.donutStats" class="profile-data-note mt-4">Показатели собраны по завершённым матчам. K/D — убийства к смертям, HS% — доля убийств в голову, ADR — средний урон за раунд.</p>
      <section v-if="activeStatsSection === 'overview' && !profile.donutStats" class="profile-statistics-empty mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <span class="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-300/10 dark:text-amber-200"><Activity :size="19" /></span>
        <h3 class="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">Матчевой статистики пока нет</h3><p class="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">Она появится после завершения матчей с DonutStats.</p>
      </section>

      <section v-if="activeStatsSection === 'overview' && profile.mapWinRates.length" class="profile-section" aria-labelledby="profile-detail-maps-title">
        <div class="section-heading">
          <div><div class="section-kicker">MAP PERFORMANCE</div><h2 id="profile-detail-maps-title">Winrate по картам</h2></div>
          <span class="section-count">{{ profile.mapWinRates.length.toString().padStart(2, '0') }} <span>КАРТ</span></span>
        </div>
        <div v-if="profile.mapWinRates.length" class="map-winrate-list">
          <article v-for="map in profile.mapWinRates" :key="map.map" class="map-winrate-row">
            <strong>{{ map.map }}</strong>
            <div class="map-winrate-track"><span :style="{ width: `${map.winRate}%` }"></span></div>
            <span class="map-winrate-value">{{ map.winRate }}%</span>
            <small>{{ map.wins }} / {{ map.matches }} побед</small>
          </article>
        </div>
        <div v-else class="empty-state section-empty map-winrate-empty">
          <span class="empty-icon"><Target :size="21" /></span>
          <div><strong>Нет данных по картам</strong><span>Винрейт появится после завершённых матчей.</span></div>
        </div>
      </section>
    </section>

    <section
      v-else-if="!profile.isBlocked && activeProfileTab === 'matches'"
      id="profile-panel-matches"
      class="profile-tab-panel profile-section"
      role="tabpanel"
      aria-labelledby="profile-tab-matches"
      tabindex="0"
    >
      <div class="section-heading">
        <div><div class="section-kicker">MATCH HISTORY</div><h2>Все матчи игрока</h2></div>
        <span class="section-count">{{ profileMatchesTotal.toString().padStart(2, '0') }} <span>МАТЧЕЙ</span></span>
      </div>
      <p v-if="profileMatchesError" class="auth-message" role="alert">{{ profileMatchesError }} <button class="auth-inline-link" type="button" @click="loadProfileMatches(profileMatchesPage)">Повторить</button></p>
      <PageLoader v-else-if="profileMatchesLoading && !profileMatches.length" message="Загружаем историю матчей…" />
      <ProfileMatchList v-else :matches="profileMatches" />
      <div v-if="profileMatchesLastPage > 1" class="donut-pagination profile-matches-pagination">
        <span>{{ profileMatchesPage }} / {{ profileMatchesLastPage }}</span>
      </div>
      <div v-if="profileMatchesLoadingMore" class="donut-pagination" role="status"><LoaderCircle class="is-spinning" :size="16" /> Загружаем ещё матчи…</div>
    </section>

    <section
      v-else-if="!profile.isBlocked && activeProfileTab === 'moments'"
      id="profile-panel-moments"
      class="profile-tab-panel profile-section"
      role="tabpanel"
      aria-labelledby="profile-tab-moments"
      tabindex="0"
    >
      <div class="section-heading">
        <div><div class="section-kicker">MATCH HIGHLIGHTS</div><h2>Моменты игрока</h2></div>
        <span class="section-count">MVP</span>
      </div>
      <div class="empty-state section-empty profile-tab-empty">
        <span class="empty-icon"><Film :size="21" /></span>
        <div><strong>MVP-матчи пока недоступны</strong><span>Здесь появятся матчи, где игрок стал MVP, когда подключится источник матчевой статистики.</span></div>
      </div>
    </section>

    <section
      v-else-if="!profile.isBlocked && activeProfileTab === 'friends'"
      id="profile-panel-friends"
      class="profile-tab-panel profile-section"
      role="tabpanel"
      aria-labelledby="profile-tab-friends"
      tabindex="0"
    >
      <div class="section-heading">
        <div><div class="section-kicker">MATCHSTRIKE / SOCIAL</div><h2>Друзья игрока</h2></div>
        <span class="section-count">{{ profile.friends.length.toString().padStart(2, '0') }} <span>ДРУЗЕЙ</span></span>
      </div>
      <div v-if="profile.friends.length" class="friends-list profile-friends-list">
        <article v-for="friend in profile.friends" :key="friend.id" class="friend-row">
          <RouterLink class="friend-request-avatar-link" :to="{ name: 'profile', params: { nickname: friend.nickname } }" :aria-label="`Открыть профиль ${friend.nickname}`">
            <span v-if="friend.avatarUrl" class="friend-avatar-wrap"><img class="friend-avatar" :src="friend.avatarUrl" alt="" /></span>
            <span v-else class="friend-avatar friend-avatar-fallback">{{ friend.nickname.slice(0, 1).toUpperCase() }}</span>
          </RouterLink>
          <div class="friend-details">
            <RouterLink class="friend-request-nickname" :to="{ name: 'profile', params: { nickname: friend.nickname } }">{{ friend.nickname }}</RouterLink>
            <span class="friend-last-seen">Профиль MatchStrike</span>
          </div>
          <div class="friend-actions profile-friend-actions">
            <RouterLink class="friend-action friend-profile-action" :to="{ name: 'profile', params: { nickname: friend.nickname } }">
              <UserRound :size="15" /> Профиль
            </RouterLink>
          </div>
        </article>
      </div>
      <div v-else class="empty-state section-empty friends-empty">
        <span class="empty-icon"><Users :size="21" /></span>
        <div><strong>Список друзей пока пуст</strong><span>Принятые друзья игрока появятся здесь.</span></div>
      </div>
    </section>
    </Transition>

    <Teleport to="body">
      <Transition name="profile-toast">
        <div v-if="successToast" class="profile-toast" :class="{ 'is-error': toastTone === 'error' }" :role="toastTone === 'error' ? 'alert' : 'status'" :aria-live="toastTone === 'error' ? 'assertive' : 'polite'" aria-atomic="true">
          <span class="profile-toast-icon motion-safe:animate-pulse"><X v-if="toastTone === 'error'" :size="15" :stroke-width="2.5" /><Check v-else :size="15" :stroke-width="2.5" /></span>
          <span class="profile-toast-message">{{ successToast }}</span>
          <RouterLink v-if="toastTicketId !== null" class="profile-toast-action dialog-primary" :to="{ name: 'tickets', query: { ticket: String(toastTicketId) } }" @click="dismissSuccessToast">Перейти</RouterLink>
          <button class="profile-toast-close" type="button" aria-label="Закрыть уведомление" @click="dismissSuccessToast"><X :size="15" /></button>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="mediaDialog && activeMediaSpec" class="modal-backdrop" @click.self="closeMediaDialog">
          <section class="info-dialog media-dialog" role="dialog" aria-modal="true" aria-labelledby="media-dialog-title">
          <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="mediaBusy !== null" @click="closeMediaDialog"><X :size="18" /></button>
          <span class="dialog-mark"><Upload :size="20" /></span>
          <div class="section-kicker">PROFILE / IMAGE</div>
          <h2 id="media-dialog-title">{{ activeMediaSpec.title }}</h2>
          <input ref="mediaInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="handleMediaInputChange" />
          <div
            class="media-dropzone"
            :class="{ 'is-dragover': mediaDragOver }"
            :aria-busy="mediaBusy !== null"
            @dragover.prevent="mediaDragOver = true"
            @dragleave.prevent="mediaDragOver = false"
            @drop.prevent="handleMediaDrop"
          >
            <Upload :size="22" />
            <strong>{{ mediaBusy ? 'Загружаем изображение…' : 'Перетащите файл в эту область' }}</strong>
            <span>или</span>
            <button class="dialog-secondary media-select-button" type="button" :disabled="mediaBusy !== null" @click="mediaInput?.click()">Выбрать файл</button>
            <small>JPG, PNG или WebP · до {{ activeMediaSpec.maxSize }}</small>
          </div>
          <div class="media-resolution-grid">
            <div><span>Рекомендуемое</span><strong>{{ activeMediaSpec.recommended }} px</strong></div>
            <div><span>Максимальное</span><strong>{{ activeMediaSpec.maxWidth }} × {{ activeMediaSpec.maxHeight }} px</strong></div>
          </div>
          <div class="dialog-actions">
            <button class="dialog-secondary" type="button" :disabled="mediaBusy !== null" @click="closeMediaDialog">Отмена</button>
          </div>
          </section>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="reportOpen" class="modal-backdrop" @click.self="reportOpen = false">
          <form class="info-dialog report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" @keydown.esc="reportOpen = false" @submit.prevent="submitReport">
          <button class="dialog-close" type="button" aria-label="Закрыть" @click="reportOpen = false"><X :size="18" /></button>
          <div class="report-dialog-heading">
            <span class="dialog-mark"><Flag :size="20" /></span>
            <div><div class="section-kicker">COMMUNITY / MODERATION</div><h2 id="report-dialog-title">Пожаловаться на игрока</h2></div>
          </div>
          <p class="report-dialog-subtitle">Жалоба на <strong>{{ profile.nickname }}</strong></p>
          <fieldset class="report-reasons">
            <legend>Причина жалобы</legend>
            <div class="report-reason-options">
              <label v-for="reason in reportReasons" :key="reason.value" class="report-reason" :class="{ 'is-selected': reportForm.reason === reason.value }">
                <input v-model="reportForm.reason" type="radio" name="report-reason" :value="reason.value" />
                <span>{{ reason.label }}</span>
              </label>
            </div>
          </fieldset>
          <label class="auth-field report-details-field">
            <span class="report-details-heading"><span>Комментарий <small>необязательно</small></span><span class="report-character-count">{{ reportForm.details.length }} / 1000</span></span>
            <textarea v-model="reportForm.details" class="auth-input report-textarea" maxlength="1000" rows="4" placeholder="Расскажите подробнее о ситуации"></textarea>
          </label>
          <p v-if="reportMessage" class="auth-message" role="alert">{{ reportMessage }}</p>
          <div class="dialog-actions">
            <button class="dialog-secondary" type="button" @click="reportOpen = false">Отмена</button>
            <button class="dialog-primary" type="submit" :disabled="reportBusy">{{ reportBusy ? 'Отправляем…' : 'Отправить жалобу' }}</button>
          </div>
          </form>
        </div>
      </Transition>
    </Teleport>
    </div>
  </Transition>
  <Transition name="modal">
    <div v-if="removeFriendOpen" class="modal-backdrop" @click.self="removeFriendOpen = false" @keydown.esc="removeFriendOpen = false">
      <section class="info-dialog profile-remove-friend-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-friend-title">
        <button class="dialog-close" type="button" aria-label="Закрыть" :disabled="friendBusy" @click="removeFriendOpen = false"><X :size="17" /></button>
        <span class="dialog-mark"><Users :size="20" /></span>
        <h2 id="remove-friend-title">Удалить из друзей?</h2>
        <p>Вы уверены, что хотите удалить {{ profile?.nickname }} из списка друзей?</p>
        <div class="dialog-actions"><button class="dialog-secondary" type="button" :disabled="friendBusy" @click="removeFriendOpen = false">Отмена</button><button class="profile-confirm-remove" type="button" :disabled="friendBusy" @click="confirmRemoveFriend">{{ friendBusy ? 'Удаляем…' : 'Удалить из друзей' }}</button></div>
      </section>
    </div>
  </Transition>
</template>
