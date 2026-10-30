<script setup lang="ts">
defineProps<{ message: string }>()
</script>

<template>
  <div class="profile-state page-loader" role="status">
    <span class="page-loader-spinner" aria-hidden="true"></span>
    {{ message }}
  </div>
</template>