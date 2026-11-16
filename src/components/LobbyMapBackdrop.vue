<script setup lang="ts">
import { computed } from 'vue'
import type { LobbyRoom } from '../api'
import { matchMapImage } from '../matchArtwork'

const props = withDefaults(defineProps<{ maps: string[]; format: LobbyRoom['format']; surface?: 'panel' | 'page' }>(), { surface: 'panel' })
const coverMaps = computed(() => props.maps.slice(0, props.format === 'BO3' || props.format === 'BO5' ? 3 : 1))
function hideImage(event: Event) { if (event.target instanceof HTMLImageElement) event.target.style.display = 'none' }
</script>

<template>
  <div class="map-backdrop" :class="{ 'is-series': coverMaps.length > 1, 'is-page': surface === 'page' }" :style="{ '--map-backdrop-surface': surface === 'page' ? 'var(--bg)' : 'var(--panel)' }" aria-hidden="true">
    <img v-for="(map, index) in coverMaps" :key="`${index}-${map}`" class="map-backdrop-image" :src="matchMapImage(map) ?? undefined" alt="" loading="lazy" @error="hideImage" />
    <div class="map-backdrop-shade"></div>
  </div>
</template>

<style scoped>
.map-backdrop { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
.map-backdrop-image { position:absolute; inset:0; display:block; width:100%; height:100%; object-fit:cover; object-position:center; -webkit-mask-image:var(--cover-mask,none); mask-image:var(--cover-mask,none); }
.is-series .map-backdrop-image:nth-child(1) { width:45%; right:auto; --cover-mask:linear-gradient(90deg,#000 0%,#000 65%,transparent 100%); }
.is-series .map-backdrop-image:nth-child(2) { width:54%; left:23%; right:auto; --cover-mask:linear-gradient(90deg,transparent 0%,#000 24%,#000 76%,transparent 100%); }
.is-series .map-backdrop-image:nth-child(3) { width:45%; left:55%; --cover-mask:linear-gradient(90deg,transparent 0%,#000 35%,#000 100%); }
.map-backdrop-shade { position:absolute; inset:0; background:linear-gradient(180deg,rgb(7 18 32 / 32%),transparent 45%),linear-gradient(180deg,transparent 20%,color-mix(in srgb,var(--map-backdrop-surface) 25%,transparent) 48%,var(--map-backdrop-surface) 100%); }
.is-page .map-backdrop-shade { background:linear-gradient(90deg,color-mix(in srgb,var(--map-backdrop-surface) 82%,transparent),color-mix(in srgb,var(--map-backdrop-surface) 38%,transparent) 55%,color-mix(in srgb,var(--map-backdrop-surface) 30%,transparent)),linear-gradient(0deg,var(--map-backdrop-surface),transparent 90%); }
</style>
