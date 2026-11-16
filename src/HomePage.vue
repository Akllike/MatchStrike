<script setup lang="ts">
import DashboardPage from './DashboardPage.vue'
import LandingPage from './LandingPage.vue'
import PageLoader from './components/PageLoader.vue'

defineProps<{ authReady:boolean; authenticated:boolean; darkTheme:boolean }>()
const emit=defineEmits<{ authRequested:[mode:'login'|'register']; themeRequested:[] }>()
</script>

<template>
  <Transition name="profile-content" mode="out-in">
    <PageLoader v-if="!authReady" key="session" message="Открываем площадку…" />
    <DashboardPage v-else-if="authenticated" key="dashboard" />
    <LandingPage v-else key="landing" :dark-theme="darkTheme" @auth-requested="emit('authRequested',$event)" @theme-requested="emit('themeRequested')" />
  </Transition>
</template>
