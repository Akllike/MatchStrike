<script setup lang="ts">
import { websiteSettings } from '../websiteSettings'
</script>
<template>
  <span class="brand-mark" aria-hidden="true">
    <img class="brand-symbol-light" :src="websiteSettings.logoLight || '/icons/symbols/black/symbol-192.png'" alt="" width="192" height="192" />
    <img class="brand-symbol-dark" :src="websiteSettings.logoDark || '/icons/symbols/original/symbol-192.png'" alt="" width="192" height="192" />
  </span>
</template>
