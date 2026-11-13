<script setup lang="ts">
import { Award, CalendarClock, ChevronRight, MapPin, Server } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import type { GameMatch } from '../api'
import { handleMapImageError, matchMapImage } from '../matchArtwork'
import { formatMatchDuration } from '../matchDuration'

const props = defineProps<{ matches: GameMatch[] }>()

function resultLabel(match: GameMatch): string {
  if (match.status === 'cancelled') return 'Отменён'
  if (match.status === 'live' || match.status === 'preparing') return 'В процессе'
  if (match.playerResult === 'win') return 'Победа'
  if (match.playerResult === 'loss') return 'Поражение'
  if (match.playerResult === 'draw') return 'Ничья'
  return 'Нет результата'
}

function resultClass(match: GameMatch): string {
  if (match.status === 'cancelled') return 'is-cancelled'
  if (match.status === 'live' || match.status === 'preparing') return 'is-live'
  return match.playerResult ? `is-${match.playerResult}` : 'is-unknown'
}

function mapLabel(value: string): string {
  return value
}

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Дата неизвестна'
    : date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div v-if="props.matches.length" class="profile-match-list">
    <RouterLink
      v-for="match in props.matches"
      :key="match.id"
      class="profile-match-card"
      :class="resultClass(match)"
      :to="{ name: 'match-detail', params: { id: match.id } }"
      :aria-label="`${mapLabel(match.map)}, ${resultLabel(match)}, матч ${match.id}`"
    >
      <img
        v-if="matchMapImage(match.map)"
        class="profile-match-card-art"
        :src="matchMapImage(match.map) ?? undefined"
        alt=""
        aria-hidden="true"
        @error="handleMapImageError"
      />
      <span class="profile-match-card-shade" aria-hidden="true"></span>

      <span class="profile-match-card-top">
        <span class="profile-match-card-id"><span class="profile-match-card-mark"><Award :size="13" /></span> MATCH #{{ match.id }} <i></i> {{ match.mode }}<template v-if="match.format"> · {{ match.format }}</template></span>
        <span class="profile-match-card-date"><CalendarClock :size="12" /> {{ dateLabel(match.updatedAt) }}</span>
      </span>

      <span class="profile-match-card-scoreboard">
        <span class="profile-match-team">
          <span class="profile-match-team-side">CT</span>
          <strong>{{ match.teamA.name || 'Команда CT' }}</strong>
        </span>
        <span class="profile-match-card-score">
          <strong>{{ match.teamA.score ?? '—' }} <i>:</i> {{ match.teamB.score ?? '—' }}</strong>
          <small>{{ match.scoreType === 'maps' ? 'СЧЁТ ПО КАРТАМ' : 'СЧЁТ ПО РАУНДАМ' }}</small>
        </span>
        <span class="profile-match-team is-right">
          <span class="profile-match-team-side">T</span>
          <strong>{{ match.teamB.name || 'Команда T' }}</strong>
        </span>
      </span>

      <span class="profile-match-card-bottom">
        <span class="profile-match-card-details">
          <span><MapPin :size="12" /> {{ mapLabel(match.map) }}</span>
          <i></i>
          <span><Server :size="12" /> {{ match.serverName || `Сервер #${match.serverNumber}` }}</span>
          <span><CalendarClock :size="12" /> {{ formatMatchDuration(match.durationSeconds) }}</span>
        </span>
        <span class="profile-match-card-result">{{ resultLabel(match) }} <ChevronRight :size="14" /></span>
      </span>
    </RouterLink>
  </div>
  <div v-else class="empty-state section-empty matches-empty">
    <span class="empty-icon"><Award :size="21" /></span>
    <div><strong>Матчей пока нет</strong><span>Матчи появятся здесь после того, как игрок примет участие в игре с привязанным Steam ID.</span></div>
  </div>
</template>
