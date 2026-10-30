<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Clock3, Gamepad2 } from '@lucide/vue'

interface MatchRecord {
  id: string
  map: string
  mode: string
  playedAt: string
  winner: string
  score: string
}

const props = defineProps<{
  matches: MatchRecord[]
  limit?: number
  emptyTitle: string
  emptyDescription: string
}>()

const visibleMatches = computed(() => props.limit === undefined ? props.matches : props.matches.slice(0, props.limit))
</script>

<template>
  <div v-if="visibleMatches.length" class="match-list">
    <article v-for="(match, index) in visibleMatches" :key="match.id" class="match-row">
      <span class="match-number">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="match-map-mark"><Gamepad2 :size="17" /></span>
      <div class="match-main"><strong>{{ match.map }}</strong><span>{{ match.mode }} · {{ match.playedAt }}</span></div>
      <div class="match-result"><span>ПОБЕДИТЕЛЬ</span><strong>{{ match.winner }}</strong></div>
      <strong class="match-score">{{ match.score }}</strong>
      <ArrowUpRight class="match-arrow" :size="16" />
    </article>
  </div>
  <div v-else class="empty-state section-empty matches-empty">
    <span class="empty-icon"><Clock3 :size="21" :stroke-width="1.5" /></span>
    <div><strong>{{ emptyTitle }}</strong><span>{{ emptyDescription }}</span></div>
  </div>
</template>