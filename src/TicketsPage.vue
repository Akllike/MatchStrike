<script setup lang="ts">
import { CircleHelp } from '@lucide/vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TicketWorkspace from './components/TicketWorkspace.vue'

const route = useRoute()
const router = useRouter()
const ticketId = computed(() => {
  const value = route.query.ticket
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
})

function updateSelectedTicket(id: number | null) {
  const query = { ...route.query }
  if (id === null) delete query.ticket
  else query.ticket = String(id)
  void router.replace({ query })
}
</script>

<template>
  <section class="welcome-section route-intro" aria-labelledby="tickets-page-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> MATCHSTRIKE <span class="eyebrow-slash">/</span> SUPPORT</div>
      <h1 id="tickets-page-title">Мои <span>тикеты</span></h1>
    </div>
    <div class="route-intro-mark"><CircleHelp :size="27" :stroke-width="1.5" /></div>
  </section>
  <TicketWorkspace :ticket-id="ticketId" :notification-message="typeof route.query.message === 'string' ? route.query.message : null" @ticket-selected="updateSelectedTicket" />
</template>