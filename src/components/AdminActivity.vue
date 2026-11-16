<script setup lang="ts">
import { ref } from 'vue'
import { ChevronLeft, ChevronRight, ScrollText } from '@lucide/vue'
import SearchField from './SearchField.vue'
import type { AdminActivityPage } from '../api'
defineProps<{ data: AdminActivityPage }>()
const emit = defineEmits<{ load: [page: number, search: string] }>()
const search = ref('')
const time = (value: string) => new Date(value).toLocaleString('ru-RU')
const resource: Record<string,string> = { user:'Пользователь', server:'Сервер', lobby:'Лобби', ban:'Бан', ticket:'Тикет' }
</script>

<template>
  <section><form class="admin-section-toolbar" role="search" @submit.prevent="emit('load',1,search)"><SearchField v-model="search" label="Администратор, действие или ID объекта" placeholder="Поиск по журналу действий" :maxlength="100" /><button class="friend-action" type="submit">Найти</button></form><p class="admin-muted-note">Записываются успешные изменения. Пароли, токены и содержимое RCON-команд не сохраняются.</p><div v-if="data.entries.length" class="admin-board admin-activity-list"><article v-for="entry in data.entries" :key="entry.id"><span class="admin-activity-dot"></span><div><strong>{{ entry.action }}</strong><span>{{ entry.actor }}<template v-if="entry.resourceId"> · {{ resource[entry.resourceType || ''] || 'Объект' }} #{{ entry.resourceId }}</template></span><p v-if="entry.reason">{{ entry.reason }}</p></div><time>{{ time(entry.createdAt) }}</time></article></div><div v-else class="admin-board admin-board-empty"><ScrollText :size="26" /><strong>{{ search ? 'Действия не найдены' : 'Журнал пока пуст' }}</strong><span>Новые изменения администрации появятся здесь.</span></div><div v-if="data.pagination.lastPage > 1" class="stats-pagination"><button class="stats-page-button" :disabled="data.pagination.page <= 1" aria-label="Предыдущая страница" @click="emit('load',data.pagination.page-1,search)"><ChevronLeft :size="16" /></button><span>{{ data.pagination.page }} / {{ data.pagination.lastPage }} · {{ data.pagination.total }} записей</span><button class="stats-page-button" :disabled="data.pagination.page >= data.pagination.lastPage" aria-label="Следующая страница" @click="emit('load',data.pagination.page+1,search)"><ChevronRight :size="16" /></button></div></section>
</template>
