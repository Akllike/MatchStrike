<script setup lang="ts">
import { computed, ref } from 'vue'
import { Activity, CalendarDays, Check, Clock3, Gamepad2, Headphones, Link2, Server, ShieldBan, Swords, UserPlus, Users } from '@lucide/vue'
import type { AdminSiteStatistics } from '../api'
import { handleMapImageError, matchMapImage } from '../matchArtwork'

const props=defineProps<{ data:AdminSiteStatistics }>()
const metric=ref<'registrations'|'tickets'>('registrations')
const days=ref<7|30>(30)
const selectedDate=ref<string|null>(null)
const number=(value:number|null)=>value===null?'—':value.toLocaleString('ru-RU')
const percent=(value:number,total:number)=>total>0?Math.min(100,Math.max(0,value/total*100)):0
const date=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'})
const updated=computed(()=>new Date(props.data.updatedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}))
const periods=[{key:'last24Hours' as const,label:'За сутки',note:'Последние 24 часа'},{key:'last7Days' as const,label:'За неделю',note:'Последние 7 дней'},{key:'last30Days' as const,label:'За месяц',note:'Последние 30 дней'}]
const cards=computed(()=>[
  {label:'Зарегистрировано',value:props.data.users.total,note:`+${number(props.data.users.last24Hours)} за последние сутки`,icon:Users,tone:'cyan'},
  {label:'Онлайн на сайте',value:props.data.users.online,note:'Авторизованные · последние 5 минут',icon:Activity,tone:'green'},
  {label:'На игровых серверах',value:props.data.servers.playersOnline,note:`${props.data.servers.online} из ${props.data.servers.total} серверов доступны`,icon:Server,tone:'violet'},
  {label:'Заблокировано',value:props.data.users.blocked,note:'Аккаунты с блокировкой на сайте',icon:ShieldBan,tone:'amber'},
  {label:'Открытых тикетов',value:props.data.tickets.open,note:`${number(props.data.tickets.closed)} закрыто за всё время`,icon:Headphones,tone:'cyan'},
  {label:'Активных матчей',value:props.data.matches.active,note:'Подготовка, live и овертайм',icon:Swords,tone:'green'},
])
const series=computed(()=>props.data.daily.slice(-days.value))
const max=computed(()=>Math.max(1,...series.value.map(day=>day[metric.value])))
const total=computed(()=>series.value.reduce((sum,day)=>sum+day[metric.value],0))
const selected=computed(()=>series.value.find(day=>day.date===selectedDate.value) ?? series.value.at(-1))
const serverLabels={online:'Онлайн',offline:'Не отвечает',stale:'Данные устарели',unknown:'Нет данных'}
</script>

<template>
  <section class="admin-site-statistics" aria-label="Статистика сайта">
    <div class="admin-health-strip"><span class="admin-live-mark"><Activity :size="14" />Статистика сообщества</span><span><Clock3 :size="12" />Обновлено в {{ updated }} · каждые 30 секунд</span></div>
    <div class="admin-dashboard-metrics admin-site-metrics"><article v-for="card in cards" :key="card.label" class="admin-dashboard-metric" :class="`tone-${card.tone}`"><span class="admin-metric-symbol"><component :is="card.icon" :size="18" /></span><span>{{ card.label }}</span><strong>{{ number(card.value) }}</strong><small>{{ card.note }}</small></article></div>

    <div class="admin-statistics-columns">
      <section class="admin-board admin-statistics-chart"><header class="admin-board-heading"><div><span class="section-kicker">РОСТ И ОБРАЩЕНИЯ</span><h2>Активность по дням</h2></div><div class="admin-segmented admin-statistics-range" role="group" aria-label="Период графика"><button v-for="period in ([7,30] as const)" :key="period" type="button" :aria-pressed="days===period" @click="days=period; selectedDate=null">{{ period }} дней</button></div></header><div class="admin-statistics-chart-body">
        <div class="admin-statistics-chart-toolbar"><div class="admin-segmented" role="group" aria-label="Данные графика"><button type="button" :aria-pressed="metric==='registrations'" @click="metric='registrations'"><UserPlus :size="14" />Регистрации</button><button type="button" :aria-pressed="metric==='tickets'" @click="metric='tickets'"><Headphones :size="14" />Тикеты</button></div><div class="admin-statistics-chart-total"><strong>{{ number(total) }}</strong><span>за {{ days }} дней</span></div></div>
        <div class="admin-statistics-chart-caption" aria-live="polite"><span v-if="selected"><CalendarDays :size="13" />{{ date(selected.date) }}</span><strong v-if="selected">{{ metric==='registrations'?'Регистраций':'Обращений' }}: {{ number(selected[metric]) }}</strong></div>
        <div class="admin-statistics-bars" :class="{'is-tickets':metric==='tickets'}" :style="{'--bar-count':series.length}" role="group" aria-label="Показатели по дням"><button v-for="day in series" :key="day.date" type="button" :aria-label="`${date(day.date)}: ${day[metric]}`" :aria-pressed="selected?.date===day.date" :class="{'is-selected':selected?.date===day.date}" @mouseenter="selectedDate=day.date" @focus="selectedDate=day.date" @click="selectedDate=day.date"><span class="admin-statistics-bar" :style="{height:`${Math.max(2,day[metric]/max*100)}%`}" :class="{'is-zero':!day[metric]}"></span></button></div>
        <div class="admin-statistics-chart-axis"><span v-if="series[0]">{{ date(series[0].date) }}</span><span>{{ total?'Наведите или выберите день':'За этот период событий нет' }}</span><span v-if="series.at(-1)">{{ date(series.at(-1)!.date) }}</span></div><p class="admin-muted-note">Календарные дни по {{ data.timezone }}. Текущий день ещё не завершён.</p>
      </div></section>

      <section class="admin-board admin-statistics-periods"><header class="admin-board-heading"><div><span class="section-kicker">ДИНАМИКА СООБЩЕСТВА</span><h2>Регистрации и тикеты</h2></div><CalendarDays :size="19" /></header><div class="admin-statistics-period-head"><span>Период</span><span>Новые игроки</span><span>Тикеты</span></div><article v-for="period in periods" :key="period.key" class="admin-statistics-period"><div><strong>{{ period.label }}</strong><small>{{ period.note }}</small></div><strong class="admin-statistics-new-users">{{ number(data.users[period.key]) }}</strong><strong>{{ number(data.tickets[period.key]) }}</strong></article><footer class="admin-statistics-total-tickets"><Headphones :size="15" /><span>Всего обращений</span><strong>{{ number(data.tickets.total) }}</strong></footer></section>
    </div>

    <section class="admin-board admin-statistics-servers"><header class="admin-board-heading"><div><span class="section-kicker">ИГРОВОЙ ОНЛАЙН</span><h2>Игроки по серверам</h2></div><span class="admin-state" :class="data.servers.online?'is-online':'is-unknown'"><i></i>{{ data.servers.online }} / {{ data.servers.total }} онлайн</span></header><div v-if="data.servers.items.length" class="admin-statistics-server-list"><article v-for="server in data.servers.items" :key="server.id" class="admin-statistics-server"><span class="admin-health-map"><img v-if="server.map && matchMapImage(server.map)" :src="matchMapImage(server.map)!" alt="" loading="lazy" @error="handleMapImageError" /><Gamepad2 v-else :size="18" /></span><div class="admin-statistics-server-copy"><strong>{{ server.name }}</strong><span>{{ server.map || 'Карта неизвестна' }} · {{ server.lobbyOnly?'Только лобби':'Общедоступный' }}</span></div><span class="admin-state" :class="`is-${server.state}`"><i></i>{{ serverLabels[server.state] }}</span><div class="admin-statistics-server-count"><strong>{{ number(server.players) }} <small>/ {{ number(server.maxPlayers) }}</small></strong><span class="admin-statistics-fill"><i :style="{width:`${percent(server.players??0,server.maxPlayers??0)}%`}"></i></span></div></article></div><div v-else class="admin-board-empty"><Server :size="24" /><strong>Серверов пока нет</strong><span>Подключённые игровые серверы появятся здесь.</span></div><p class="admin-board-note">Включены общедоступные серверы и серверы лобби. В онлайн входят ответы не старше 3 минут; недоступные серверы исключены из суммы.</p></section>

    <div class="admin-statistics-bottom"><section class="admin-board"><header class="admin-board-heading"><div><span class="section-kicker">ПОЛЬЗОВАТЕЛИ</span><h2>Активность аккаунтов</h2></div><Users :size="19" /></header><div class="admin-statistics-account-facts"><div><span><Activity :size="15" />Были на сайте за сутки</span><strong>{{ number(data.users.active24Hours) }}</strong><small>Без заблокированных аккаунтов</small></div><div><span><Link2 :size="15" />Привязали Steam</span><strong>{{ number(data.users.steamLinked) }}</strong><small>{{ Math.round(percent(data.users.steamLinked,data.users.total)) }}% всех пользователей</small></div></div></section><section class="admin-board"><header class="admin-board-heading"><div><span class="section-kicker">ИГРЫ СООБЩЕСТВА</span><h2>Матчи и лобби</h2></div><Swords :size="19" /></header><div class="admin-statistics-game-facts"><div><span><Check :size="14" />Завершено матчей</span><strong>{{ number(data.matches.finished) }}</strong><small>Mix: {{ number(data.matches.mix) }} · War: {{ number(data.matches.war) }}</small></div><div><span>Активных комнат</span><strong>{{ number(data.lobbies.active) }}</strong><small>{{ number(data.lobbies.players) }} участников</small></div><div><span>Отменено матчей</span><strong>{{ number(data.matches.cancelled) }}</strong><small>За всё время</small></div></div></section></div>
  </section>
</template>
