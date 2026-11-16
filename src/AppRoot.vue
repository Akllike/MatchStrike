<script setup lang="ts">
import ApiUnavailableDialog from './components/ApiUnavailableDialog.vue'
import SiteAlerts from './components/SiteAlerts.vue'
</script>

<template>
  <RouterView />
  <ApiUnavailableDialog />
  <SiteAlerts />
</template>
