<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CheckCircle2, CircleHelp, MessageSquare, Plus, RefreshCw, Send, UserRound, X } from '@lucide/vue'
import { createTicket, getTicket, getTickets, markTicketRead, replyToTicket, setTicketStatus } from '../api'
import type { Ticket, TicketCategory, TicketConversation } from '../api'

const props = withDefaults(defineProps<{ admin?: boolean; ticketId?: number | null; notificationMessage?: string | null }>(), { admin: false, ticketId: null, notificationMessage: null })
const emit = defineEmits<{ ticketSelected: [id: number | null] }>()
const categoryLabels: Record<TicketCategory, string> = {
  general: 'Общие вопросы',
  account_block: 'Блокировка',
  server_ban: 'Бан на игровом сервере',
  technical: 'Технический вопрос',
  other: 'Иное',
  player_report: 'Жалоба на игрока',
}
const createCategories = (Object.keys(categoryLabels) as TicketCategory[]).filter((value) => value !== 'player_report')
const tickets = ref<Ticket[]>([])
const conversation = ref<TicketConversation | null>(null)
const selectedId = ref<number | null>(null)
const loading = ref(true)
const conversationLoading = ref(false)
const busy = ref(false)
const error = ref('')
const composing = ref(false)
const subject = ref('')
const category = ref<TicketCategory | ''>('')
const message = ref('')
const reply = ref('')
const messageList = ref<HTMLElement | null>(null)
const replyInput = ref<HTMLTextAreaElement | null>(null)
const hasOpenTicket = computed(() => tickets.value.some((ticket) => ticket.status === 'open'))
let selectionVersion = 0
let listVersion = 0
let pollTimer: number | undefined

function handleMessageKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  if (event.repeat || busy.value || !(event.currentTarget instanceof HTMLTextAreaElement)) return
  event.currentTarget.form?.requestSubmit()
}

function resizeReply() {
  const input = replyInput.value
  if (!input) return
  input.style.height = '40px'
  input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`
}

watch(reply, resizeReply, { flush: 'post' })
watch(replyInput, (input, _previous, onCleanup) => {
  if (!input) return
  resizeReply()
  let width = input.clientWidth
  const observer = new ResizeObserver(() => {
    if (input.clientWidth === width) return
    width = input.clientWidth
    resizeReply()
  })
  observer.observe(input)
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })

function dateLabel(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

async function scrollToLatest() {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
}

async function loadTickets() {
  const version = ++listVersion
  error.value = ''
  try {
    const result = await getTickets(props.admin)
    if (version === listVersion) tickets.value = result
  } catch (requestError) {
    if (version === listVersion) error.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить тикеты.'
  } finally {
    if (version === listVersion) loading.value = false
  }
}

async function markConversationRead(result: TicketConversation) {
  const lastMessage = result.messages[result.messages.length - 1]
  if (!result.ticket.unread || !lastMessage) return
  await markTicketRead(props.admin, result.ticket.id, lastMessage.id)
  await loadTickets()
}

async function selectTicket(id: number) {
  const version = ++selectionVersion
  selectedId.value = id
  composing.value = false
  conversation.value = null
  reply.value = ''
  error.value = ''
  conversationLoading.value = true
  try {
    const result = await getTicket(props.admin, id)
    if (version !== selectionVersion) return
    conversation.value = result
    await scrollToLatest()
    if (version === selectionVersion) await markConversationRead(result)
  } catch (requestError) {
    if (version === selectionVersion) error.value = requestError instanceof Error ? requestError.message : 'Не удалось загрузить диалог.'
  } finally {
    if (version === selectionVersion) conversationLoading.value = false
  }
}

watch(() => [props.ticketId, props.notificationMessage] as const, ([id, message], previous) => {
  if (!props.admin && id !== null && (id !== selectedId.value || (previous && message !== previous[1]))) void selectTicket(id)
  else if (!props.admin && id === null && selectedId.value !== null) {
    selectionVersion++
    selectedId.value = null
    conversation.value = null
    conversationLoading.value = false
    composing.value = false
    reply.value = ''
    error.value = ''
  }
}, { immediate: true })

function openTicket(id: number) {
  if (!props.admin) emit('ticketSelected', id)
  void selectTicket(id)
}

async function refreshWorkspace() {
  await loadTickets()
  const id = selectedId.value
  if (id === null || composing.value) return
  try {
    const result = await getTicket(props.admin, id)
    if (selectedId.value === id && !composing.value) {
      conversation.value = result
      await markConversationRead(result)
    }
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'Не удалось обновить диалог.'
  }
}

function newTicket() {
  if (loading.value || hasOpenTicket.value) return
  selectionVersion++
  selectedId.value = null
  conversation.value = null
  conversationLoading.value = false
  error.value = ''
  composing.value = true
  emit('ticketSelected', null)
}

async function submitTicket() {
  if (busy.value || !category.value || !subject.value.trim() || !message.value.trim()) return
  busy.value = true
  error.value = ''
  try {
    const result = await createTicket(subject.value.trim(), category.value, message.value.trim())
    subject.value = ''
    category.value = ''
    message.value = ''
    composing.value = false
    selectedId.value = result.ticket.id
    emit('ticketSelected', result.ticket.id)
    conversation.value = result
    await loadTickets()
    await scrollToLatest()
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'Не удалось создать тикет.'
  } finally {
    busy.value = false
  }
}

async function sendReply() {
  if (busy.value || !conversation.value || !reply.value.trim()) return
  const id = conversation.value.ticket.id
  const body = reply.value.trim()
  busy.value = true
  error.value = ''
  try {
    const result = await replyToTicket(props.admin, id, body)
    if (selectedId.value === id) {
      conversation.value = result
      reply.value = ''
      await scrollToLatest()
      if (selectedId.value === id) await markConversationRead(result)
    }
    await loadTickets()
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'Не удалось отправить сообщение.'
  } finally {
    busy.value = false
  }
}

async function changeStatus() {
  if (busy.value || !conversation.value) return
  const id = conversation.value.ticket.id
  busy.value = true
  error.value = ''
  try {
    const result = await setTicketStatus(id, conversation.value.ticket.status === 'open' ? 'closed' : 'open')
    if (selectedId.value === id) {
      conversation.value = result
      await scrollToLatest()
    }
    await loadTickets()
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'Не удалось изменить статус.'
  } finally {
    busy.value = false
  }
}

async function refreshTicketsWhenVisible() {
  if (document.visibilityState !== 'visible' || error.value) return
  await loadTickets()
  const selected = tickets.value.find((ticket) => ticket.id === selectedId.value)
  if (!busy.value && conversation.value && selected && selected.status !== conversation.value.ticket.status) await refreshWorkspace()
}

onMounted(() => {
  void loadTickets()
  document.addEventListener('visibilitychange', refreshTicketsWhenVisible)
  pollTimer = window.setInterval(() => void refreshTicketsWhenVisible(), 10_000)
})
onBeforeUnmount(() => {
  selectionVersion++
  listVersion++
  document.removeEventListener('visibilitychange', refreshTicketsWhenVisible)
  if (pollTimer !== undefined) window.clearInterval(pollTimer)
})
</script>

<template>
  <div class="tickets-heading section-heading">
    <div><div class="section-kicker">MATCHSTRIKE / SUPPORT</div><h2>Тикеты</h2></div>
    <div class="tickets-heading-actions">
      <button class="tickets-icon-button dialog-secondary" type="button" title="Обновить тикеты" aria-label="Обновить тикеты" @click="refreshWorkspace"><RefreshCw :size="15" /></button>
      <span v-if="!admin" class="tickets-create-control" :class="{ 'is-blocked': hasOpenTicket }" :tabindex="hasOpenTicket ? 0 : undefined" :aria-label="hasOpenTicket ? 'Создать тикет недоступно' : undefined" :aria-describedby="hasOpenTicket ? 'tickets-create-reason' : undefined">
        <button class="tickets-primary dialog-primary" type="button" :disabled="loading || hasOpenTicket" @click="newTicket"><Plus :size="15" /> Создать тикет</button>
        <span v-if="hasOpenTicket" id="tickets-create-reason" class="tickets-create-tooltip" role="tooltip">Новый тикет можно создать после закрытия открытого обращения.</span>
      </span>
    </div>
  </div>
  <p v-if="error" class="tickets-error" role="alert">{{ error }} <button type="button" @click="refreshWorkspace">Повторить</button></p>
  <div class="tickets-workspace">
    <section class="tickets-list" aria-label="Список тикетов">
      <div class="tickets-list-heading"><strong>Обращения</strong><span>{{ tickets.length }}</span></div>
      <p v-if="loading" class="tickets-empty-list">Загрузка тикетов…</p>
      <p v-else-if="!tickets.length" class="tickets-empty-list">Тикетов пока нет.</p>
      <div v-if="tickets.length" class="tickets-list-items">
        <button v-for="ticket in tickets" :key="ticket.id" class="ticket-list-item" :class="{ 'is-selected': selectedId === ticket.id }" type="button" :aria-pressed="selectedId === ticket.id" @click="openTicket(ticket.id)">
          <span class="ticket-list-top">
            <span class="ticket-list-title"><span v-if="ticket.unread" class="ticket-unread" aria-hidden="true"></span><span v-if="ticket.unread" class="visually-hidden">Непрочитанный тикет: </span><strong>{{ ticket.subject }}</strong></span>
            <span class="ticket-status ticket-list-status" :class="{ 'is-closed': ticket.status === 'closed' }">{{ ticket.status === 'open' ? 'Открыт' : 'Закрыт' }}</span>
          </span>
          <span class="ticket-list-details"><span class="ticket-list-id">#{{ ticket.id }}</span><span class="ticket-list-category">{{ ticket.category ? categoryLabels[ticket.category] : 'Тема не указана' }}</span></span>
          <span class="ticket-list-meta"><span class="ticket-list-owner"><UserRound :size="13" aria-hidden="true" /><span>{{ ticket.nickname }}</span></span><time v-if="ticket.lastMessage" :datetime="ticket.lastMessage.createdAt">{{ dateLabel(ticket.lastMessage.createdAt) }}</time></span>
          <span v-if="ticket.lastMessage" class="ticket-list-preview"><MessageSquare :size="13" aria-hidden="true" /><span><b>{{ ticket.lastMessage.isAdmin ? 'Администратор' : ticket.lastMessage.authorName }}:</b> {{ ticket.lastMessage.body }}</span></span>
        </button>
      </div>
    </section>
    <section class="ticket-dialog" aria-label="Диалог тикета">
      <Transition name="ticket-chat" mode="out-in" @after-enter="scrollToLatest">
      <form v-if="composing" key="compose" class="ticket-compose" @submit.prevent="submitTicket">
        <div class="ticket-dialog-header"><div><span class="section-kicker">НОВОЕ ОБРАЩЕНИЕ</span><h3>Создать тикет</h3></div><button class="tickets-icon-button dialog-secondary" type="button" aria-label="Отменить" title="Отменить" @click="composing = false"><X :size="16" /></button></div>
        <label>Тема обращения<select v-model="category" required><option disabled value="">Выберите тему</option><option v-for="value in createCategories" :key="value" :value="value">{{ categoryLabels[value] }}</option></select></label>
        <label>Название<input v-model="subject" maxlength="160" required placeholder="Кратко опишите ваш вопрос" /></label>
        <label class="ticket-compose-message">Сообщение<textarea v-model="message" maxlength="5000" required placeholder="Опишите ваш вопрос" title="Enter — отправить, Shift+Enter — новая строка" @keydown="handleMessageKeydown"></textarea></label>
        <button class="tickets-primary dialog-primary" type="submit" :disabled="busy || !category || !subject.trim() || !message.trim()"><Send :size="14" /> {{ busy ? 'Отправляем…' : 'Отправить' }}</button>
      </form>
      <div v-else-if="conversation" :key="`ticket-${conversation.ticket.id}`" class="ticket-conversation">
        <div class="ticket-dialog-header"><div><span class="section-kicker">#{{ conversation.ticket.id }} / {{ conversation.ticket.nickname }}</span><h3>{{ conversation.ticket.subject }}</h3><span class="ticket-category">{{ conversation.ticket.category ? categoryLabels[conversation.ticket.category] : 'Тема не указана' }}</span></div><div class="ticket-dialog-actions"><span class="ticket-status" :class="{ 'is-closed': conversation.ticket.status === 'closed' }">{{ conversation.ticket.status === 'open' ? 'Открыт' : 'Закрыт' }}</span><button v-if="admin" class="ticket-status-action dialog-secondary" type="button" :disabled="busy" @click="changeStatus">{{ conversation.ticket.status === 'open' ? 'Закрыть' : 'Открыть' }}</button></div></div>
        <div ref="messageList" class="ticket-messages" aria-live="polite">
          <template v-for="entry in conversation.messages" :key="entry.id">
            <div v-if="entry.eventType" class="ticket-event">
              <span>{{ entry.body }} · {{ entry.authorName }}</span><time :datetime="entry.createdAt">{{ dateLabel(entry.createdAt) }}</time>
            </div>
            <article v-else class="ticket-message-row" :class="{ 'is-admin': entry.isAdmin }">
              <span class="ticket-message-avatar" :class="{ 'is-admin': entry.isAdmin }" aria-hidden="true">
                <img v-if="!entry.isAdmin && entry.avatarUrl" :src="entry.avatarUrl" alt="" />
                <template v-else>{{ entry.isAdmin ? 'A' : entry.authorName.slice(0, 1).toUpperCase() }}</template>
              </span>
              <div class="ticket-message" :class="{ 'is-admin': entry.isAdmin }">
                <div class="ticket-message-meta"><strong>{{ entry.authorName }}</strong><span v-if="entry.isAdmin" class="ticket-author-role">Администратор</span><time :datetime="entry.createdAt">{{ dateLabel(entry.createdAt) }}</time></div>
                <p>{{ entry.body }}</p>
              </div>
            </article>
          </template>
        </div>
        <form v-if="conversation.ticket.status === 'open'" class="ticket-reply" @submit.prevent="sendReply">
          <textarea ref="replyInput" v-model="reply" maxlength="5000" aria-label="Сообщение" placeholder="Написать сообщение…" title="Enter — отправить, Shift+Enter — новая строка" rows="1" @keydown="handleMessageKeydown"></textarea>
          <button class="tickets-primary dialog-primary" type="submit" :disabled="busy || !reply.trim()"><Send :size="14" /> Отправить</button>
        </form>
        <div v-else class="ticket-closed-note"><CheckCircle2 :size="15" /> Тикет закрыт</div>
      </div>
      <div v-else key="empty" class="ticket-dialog-empty"><CircleHelp :size="23" /><strong>{{ conversationLoading ? 'Загрузка диалога…' : 'Выберите тикет' }}</strong></div>
      </Transition>
    </section>
  </div>
</template>