<script setup lang="ts">
import SiteAlert from '../components/SiteAlert.vue'
import { computed, nextTick, ref } from 'vue'
import { Activity, ArrowDown, ArrowUp, CircleHelp, Database, Gamepad2, Image, Palette, Plus, Save, Settings, Trash2, Upload } from '@lucide/vue'
import { ApiRequestError, resetWebsiteLogo, saveWebsiteSettings, updateAdminStatisticsSource, uploadWebsiteLogo } from '../api'
import type { StatisticsSource, WebsiteSettings } from '../api'
import { applyWebsiteSettings } from '../websiteSettings'

const props = defineProps<{ data: WebsiteSettings; statisticsSource: StatisticsSource }>()
const draft = ref<WebsiteSettings>(JSON.parse(JSON.stringify(props.data)))
const baseline = ref(JSON.stringify(draft.value))
const tab = ref<'brand' | 'home' | 'faq' | 'statistics'>('brand')
const source = ref(props.statisticsSource)
const sourceBusy = ref(false)
const busy = ref(false)
const mediaBusy = ref(false)
const error = ref('')
const success = ref('')
const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value)
const tabs = [{ id:'brand' as const,label:'Оформление',icon:Palette },{ id:'home' as const,label:'Главная и разделы',icon:Gamepad2 },{ id:'faq' as const,label:'Вопросы и ответы',icon:CircleHelp },{ id:'statistics' as const,label:'Статистика',icon:Activity }]
const counts = [{ key:'serversLimit' as const,label:'Игровые серверы',max:50 },{ key:'mixMatchesLimit' as const,label:'Mix-матчи',max:30 },{ key:'warMatchesLimit' as const,label:'War-матчи',max:30 }]
async function save(event: Event) {
  if (busy.value || mediaBusy.value || sourceBusy.value) return
  const invalid = (event.target as HTMLFormElement).querySelector<HTMLInputElement | HTMLTextAreaElement>('input:invalid, textarea:invalid, select:invalid')
  if (invalid) {
    revealInvalid({ target:invalid } as unknown as Event)
    success.value = ''; error.value = invalid.validationMessage || 'Проверьте заполнение полей.'
    await nextTick(); invalid.focus(); return
  }
  busy.value = true; error.value = ''; success.value = ''
  try {
    const settings = await saveWebsiteSettings(draft.value)
    draft.value = JSON.parse(JSON.stringify(settings)); baseline.value = JSON.stringify(draft.value)
    applyWebsiteSettings(settings); success.value = 'Настройки сохранены и применены на сайте.'
  } catch (e) {
    error.value = e instanceof ApiRequestError ? Object.values(e.errors).flat().join(' ') || e.message : e instanceof Error ? e.message : 'Не удалось сохранить настройки.'
    if (e instanceof ApiRequestError) {
      const field = Object.keys(e.errors)[0] || ''
      tab.value = field.startsWith('faq') ? 'faq' : /Limit|lobbyEnabled/.test(field) ? 'home' : 'brand'
    }
  }
  finally { busy.value = false }
}
async function setStatisticsSource(value: StatisticsSource) {
  if (busy.value || mediaBusy.value || sourceBusy.value || source.value === value) return
  sourceBusy.value = true; error.value = ''; success.value = ''
  try {
    source.value = await updateAdminStatisticsSource(value)
    success.value = 'Источник статистики сохранён и применён на сайте.'
  } catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось сохранить источник статистики.' }
  finally { sourceBusy.value = false }
}
async function logo(theme: 'light' | 'dark', file?: File) {
  if (mediaBusy.value || busy.value) return
  error.value = ''; success.value = ''
  if (file && (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) { error.value = 'Выберите PNG, JPG или WebP размером до 2 МБ.'; return }
  mediaBusy.value = true; error.value = ''; success.value = ''
  try {
    const settings = await (file ? uploadWebsiteLogo(theme,file) : resetWebsiteLogo(theme))
    applyWebsiteSettings(settings)
    // Uploading a logo must preserve unsaved text, FAQ and display settings.
    const previous = JSON.parse(baseline.value) as WebsiteSettings
    for (const key of ['logoLight','logoDark'] as const) { draft.value[key] = settings[key]; previous[key] = settings[key] }
    baseline.value = JSON.stringify(previous)
    success.value = 'Логотип обновлён.'
  } catch (e) { error.value = e instanceof Error ? e.message : 'Не удалось обновить логотип.' }
  finally { mediaBusy.value = false }
}
function chooseLogo(event: Event, theme: 'light' | 'dark') {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) void logo(theme,input.files[0])
  input.value = ''
}
function revealInvalid(event: Event) {
  const input = event.target as HTMLElement
  tab.value = input.closest('.admin-settings-faq') ? 'faq' : input.closest('.admin-settings-home') ? 'home' : 'brand'
}
function addFaq() { draft.value.faq.push({ id:crypto.randomUUID(),question:'',answer:'' }); success.value = '' }
function move(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= draft.value.faq.length) return
  const [item] = draft.value.faq.splice(index,1); draft.value.faq.splice(target,0,item!)
}
</script>

<template>
  <SiteAlert :message="error || success" :tone="error ? 'error' : 'success'" @close="error = ''; success = ''" />

  <form class="admin-site-settings" novalidate @submit.prevent="save">
    <div class="admin-settings-intro"><span class="admin-operation-icon"><Settings :size="22" /></span><div><strong>Ваше сообщество — ваши настройки</strong><p>Оформление, содержимое главной и доступность лобби.</p></div><span class="admin-settings-change-state" :class="{ 'is-dirty':dirty }"><i></i>{{ dirty ? 'Есть изменения' : 'Всё сохранено' }}</span></div>
    <nav class="admin-segmented admin-settings-tabs" aria-label="Настройки сайта"><button v-for="item in tabs" :key="item.id" type="button" :aria-pressed="tab===item.id" @click="tab=item.id"><component :is="item.icon" :size="15" />{{ item.label }}</button></nav>
    
    <fieldset :disabled="busy || mediaBusy || sourceBusy" class="admin-settings-fields">
      <section v-show="tab==='brand'" class="admin-settings-brand">
        <article class="admin-board admin-settings-card"><header class="admin-board-heading"><div><span class="section-kicker">БРЕНД СООБЩЕСТВА</span><h2>Название и описание</h2></div><Palette :size="19" /></header><div class="admin-settings-card-body"><label class="auth-field"><span>Название сайта</span><input v-model="draft.name" class="auth-input" required maxlength="50" /><small>В меню, на главной странице и во вкладке браузера.</small></label><label class="auth-field"><span>Подпись под названием</span><input v-model="draft.tagline" class="auth-input" required maxlength="70" placeholder="CS COMMUNITY" /></label><label class="auth-field"><span>Описание сообщества</span><textarea v-model="draft.description" class="auth-input" required maxlength="300" rows="3"></textarea><small>{{ draft.description.length }} / 300</small></label></div></article>
        <article class="admin-board admin-settings-card"><header class="admin-board-heading"><div><span class="section-kicker">ВИЗУАЛЬНЫЙ СТИЛЬ</span><h2>Логотип сайта</h2></div><Image :size="19" /></header><div class="admin-settings-card-body"><p class="admin-muted-note">Отдельные изображения для светлой и тёмной темы. PNG, JPG или WebP до 2 МБ, до 2048 × 2048. Логотип применяется сразу.</p><div class="admin-logo-variants"><div v-for="theme in (['light','dark'] as const)" :key="theme" class="admin-logo-variant"><div class="admin-logo-preview" :class="`is-${theme}`"><img :src="(theme==='light'?draft.logoLight:draft.logoDark) || (theme==='light'?'/icons/symbols/black/symbol-192.png':'/icons/symbols/original/symbol-192.png')" alt="Предпросмотр логотипа" /></div><strong>{{ theme==='light'?'Светлая тема':'Тёмная тема' }}</strong><label class="friend-action admin-logo-upload"><Upload :size="13" />Загрузить<input type="file" accept="image/png,image/jpeg,image/webp" :aria-label="`Логотип: ${theme==='light'?'светлая':'тёмная'} тема`" @change="chooseLogo($event,theme)" /></label><button type="button" class="admin-text-link" :disabled="!(theme==='light'?draft.logoLight:draft.logoDark)" @click="logo(theme)">Стандартный логотип</button></div></div></div></article>
      </section>
      <section v-show="tab==='home'" class="admin-settings-home"><article class="admin-board admin-settings-card"><header class="admin-board-heading"><div><span class="section-kicker">ПЕРВЫЙ ЭКРАН СООБЩЕСТВА</span><h2>Контент главной страницы</h2></div><Gamepad2 :size="19" /></header><div class="admin-settings-card-body"><p class="admin-muted-note">Задайте количество карточек в каждом разделе. Значение 0 скрывает раздел. Счётчики общего онлайна и матчей сохраняют полные значения.</p><div class="admin-settings-counts"><label v-for="item in counts" :key="item.key" class="admin-settings-count"><span>{{ item.label }}</span><input v-model.number="draft[item.key]" type="number" min="0" :max="item.max" required /><small>от 0 до {{ item.max }}</small></label></div></div></article><article class="admin-board admin-settings-card"><header class="admin-board-heading"><div><span class="section-kicker">ДОСТУПНОСТЬ РАЗДЕЛОВ</span><h2>Лобби</h2></div></header><div class="admin-settings-card-body admin-lobby-setting"><div><strong>{{ draft.lobbyEnabled?'Лобби включено':'Лобби отключено' }}</strong><p>Игроки могут создавать комнаты, занимать места и запускать матчи.</p><small>При отключении пункт меню скрывается, новые подключения и запуски запрещаются. Уже запущенные матчи продолжаются, участники сохраняют доступ к своей комнате и выходу из неё.</small></div><label class="admin-settings-switch"><input v-model="draft.lobbyEnabled" type="checkbox" role="switch" aria-label="Включить лобби" /><span></span></label></div></article></section>
      <section v-show="tab==='faq'" class="admin-settings-faq"><div class="admin-section-toolbar"><div><h2>Вопросы и ответы</h2><p class="admin-muted-note">Порядок ниже повторяет порядок на главной. Ответы отображаются обычным текстом.</p></div><button class="friend-action" type="button" :disabled="draft.faq.length>=30" @click="addFaq"><Plus :size="14" />Добавить вопрос</button></div><article v-for="(item,index) in draft.faq" :key="item.id" class="admin-board admin-faq-editor"><header><span>{{ String(index+1).padStart(2,'0') }}</span><strong>{{ item.question || 'Новый вопрос' }}</strong><div><button class="admin-server-icon-button" type="button" :disabled="index===0" aria-label="Переместить вверх" @click="move(index,-1)"><ArrowUp :size="14" /></button><button class="admin-server-icon-button" type="button" :disabled="index===draft.faq.length-1" aria-label="Переместить вниз" @click="move(index,1)"><ArrowDown :size="14" /></button><button class="admin-danger-button" type="button" aria-label="Удалить вопрос" @click="draft.faq.splice(index,1)"><Trash2 :size="14" /></button></div></header><div class="admin-settings-card-body"><label class="auth-field"><span>Вопрос</span><input v-model="item.question" class="auth-input" required maxlength="200" /></label><label class="auth-field"><span>Ответ</span><textarea v-model="item.answer" class="auth-input" required maxlength="3000" rows="3"></textarea></label></div></article><div v-if="!draft.faq.length" class="admin-board admin-board-empty"><CircleHelp :size="25" /><strong>Вопросов пока нет</strong><span>Добавьте первый вопрос. Пустой FAQ скрыт на главной странице.</span><button class="friend-action" type="button" @click="addFaq"><Plus :size="14" />Добавить вопрос</button></div></section>
      <section v-show="tab==='statistics'" class="admin-board admin-settings-card">
        <header class="admin-board-heading"><div><span class="section-kicker">ДАННЫЕ ИГРОКОВ</span><h2>Источник статистики</h2></div><Activity :size="19" /></header>
        <div class="admin-settings-card-body">
          <div class="admin-segmented admin-settings-source" role="group" aria-label="Источник статистики игроков">
            <button type="button" :aria-pressed="source==='own'" @click="setStatisticsSource('own')"><Activity :size="15" />Своя статистика</button>
            <button type="button" :aria-pressed="source==='third_party'" @click="setStatisticsSource('third_party')"><Database :size="15" />Сторонняя статистика</button>
          </div>
          <p class="admin-muted-note">{{ source==='own' ? 'Используются собственная статистика DonutStats и результаты War-матчей.' : 'Статистика игроков загружается из LVL-интеграций игровых серверов.' }}</p>
          <small class="admin-muted-note" role="status">{{ sourceBusy ? 'Сохраняем источник…' : 'Выбранный источник сохраняется и применяется сразу.' }}</small>
        </div>
      </section>
    </fieldset>
    <footer class="admin-settings-save"><span>{{ dirty ? 'Изменения ещё не опубликованы' : 'Настройки применяются после сохранения' }}</span><button class="auth-submit" type="submit" :disabled="busy || mediaBusy || sourceBusy || !dirty"><Save :size="15" />{{ busy?'Сохраняем…':mediaBusy?'Загружаем логотип…':'Сохранить изменения' }}</button></footer>
  </form>
</template>
