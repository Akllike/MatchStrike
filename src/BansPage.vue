<script setup lang="ts">
import { Ban } from '@lucide/vue'
</script>

<template>
  <section class="welcome-section route-intro" aria-labelledby="bans-page-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> БЕЗОПАСНОСТЬ СООБЩЕСТВА <span class="eyebrow-slash">/</span> MODERATION</div>
      <h1 id="bans-page-title">Баны <span>сообщества</span></h1>
      <p>Информация о блокировках и мерах модерации MatchStrike.</p>
    </div>
    <div class="route-intro-mark"><Ban :size="27" :stroke-width="1.5" /></div>
  </section>

  <section class="content-section route-section" aria-labelledby="ban-registry-title">
    <div class="section-heading">
      <div><div class="section-kicker">МОДЕРАЦИЯ</div><h2 id="ban-registry-title">Реестр блокировок</h2></div>
      <span class="bans-status">СКОРО</span>
    </div>
    <div class="empty-state section-empty bans-empty">
      <span class="empty-icon"><Ban :size="22" :stroke-width="1.5" /></span>
      <div><strong>Реестр пока недоступен</strong><span>Список блокировок появится после подключения API модерации.</span></div>
    </div>
  </section>
</template>