<script setup lang="ts">
import { getCurrentInstance, onBeforeUnmount, watch } from 'vue'
import { alertQueue } from '../alerts'
import type { AlertTone } from '../alertQueue.mjs'

const props = withDefaults(defineProps<{ message?: string | null; tone?: AlertTone; title?: string; to?: string; actionLabel?: string }>(), { message:'', tone:'error' })
const emit = defineEmits<{ close: []; action: [] }>()
const key = `site-alert-${getCurrentInstance()!.uid}`
watch(() => [props.message,props.tone,props.title,props.to,props.actionLabel], () => {
  alertQueue.show({ key,message:props.message || '',tone:props.tone,title:props.title,to:props.to,actionLabel:props.actionLabel,
    onDismiss:() => emit('close'), onAction:() => emit('action') })
}, { immediate:true })
onBeforeUnmount(() => alertQueue.dismiss(key,false))
</script>

<template></template>
