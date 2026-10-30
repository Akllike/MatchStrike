<script setup lang="ts">
import { Gamepad2 } from '@lucide/vue'
import MatchList from './components/MatchList.vue'

interface MatchRecord {
  id: string
  map: string
  mode: string
  playedAt: string
  winner: string
  score: string
}

const matches: MatchRecord[] = []
</script>

<template>
  <section class="welcome-section route-intro" aria-labelledby="matches-page-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> ИСТОРИЯ ИГР <span class="eyebrow-slash">/</span> MATCHES</div>
      <h1 id="matches-page-title">Матчи</h1>
      <p>Результаты игр и история матчей сообщества MatchStrike.</p>
    </div>
    <div class="route-intro-mark"><Gamepad2 :size="27" :stroke-width="1.5" /></div>
  </section>

  <section class="content-section route-section" aria-labelledby="matches-list-title">
    <div class="section-heading">
      <div><div class="section-kicker">АРХИВ ИГР</div><h2 id="matches-list-title">Все матчи</h2></div>
      <span class="section-count">{{ matches.length.toString().padStart(2, '0') }} <span>МАТЧЕЙ</span></span>
    </div>
    <MatchList
      :matches="matches"
      empty-title="Матчей пока нет"
      empty-description="Список результатов появится после подключения истории матчей."
    />
  </section>
</template>