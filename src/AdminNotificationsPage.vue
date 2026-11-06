<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BellRing, Megaphone, Send, ShieldCheck } from '@lucide/vue'
import { getCurrentUser, sendAdminBroadcastNotification } from './api'
import type { AdminRole } from './api'
import AdminSubnav from './components/AdminSubnav.vue'
import type { AdminBroadcastResult } from './api'

const sender = ref('')
const title = ref('')
const message = ref('')
const link = ref('')
const sending = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string[]>>({})
const result = ref<AdminBroadcastResult | null>(null)
const adminRole = ref<AdminRole | null>(null)

onMounted(async () => {
  try {
    adminRole.value = (await getCurrentUser())?.adminRole ?? null
  } catch {
    adminRole.value = null
  }
})

const previewSender = computed(() => sender.value.trim() || 'Администрация')

function fieldError(name: string): string {
  return fieldErrors.value[name]?.[0] ?? ''
}

async function sendBroadcast() {
  if (sending.value) return
  error.value = ''
  fieldErrors.value = {}
  result.value = null

  const confirmed = window.confirm(
    `Отправить общее уведомление «${title.value.trim()}» всем пользователям, у которых включены системные сообщения?`,
  )
  if (!confirmed) return

  sending.value = true
  try {
    result.value = await sendAdminBroadcastNotification({
      sender: sender.value.trim(),
      title: title.value.trim(),
      message: message.value.trim(),
      link: link.value.trim(),
    })
    title.value = ''
    message.value = ''
    link.value = ''
  } catch (requestError) {
    if (requestError && typeof requestError === 'object' && 'errors' in requestError) {
      fieldErrors.value = (requestError as { errors: Record<string, string[]> }).errors
    }
    error.value = requestError instanceof Error ? requestError.message : 'Не удалось отправить уведомление.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="welcome-section route-intro" aria-labelledby="admin-notifications-title">
    <div class="welcome-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> MATCHSTRIKE <span class="eyebrow-slash">/</span> ADMINISTRATION</div>
      <h1 id="admin-notifications-title">Общие <span>уведомления</span></h1>
      <p>Отправка объявлений всем пользователям сообщества.</p>
    </div>
    <div class="route-intro-mark"><Megaphone :size="27" :stroke-width="1.5" /></div>
  </section>

  <AdminSubnav :role="adminRole" />

  <section class="content-section route-section admin-notifications-page" aria-labelledby="broadcast-form-title">
    <div class="section-heading">
      <div><div class="section-kicker">COMMUNITY / BROADCAST</div><h2 id="broadcast-form-title">Новое уведомление</h2></div>
      <span class="section-count"><BellRing :size="14" /> РАССЫЛКА</span>
    </div>

    <div class="admin-broadcast-layout">
      <form class="settings-block settings-form admin-broadcast-form" @submit.prevent="sendBroadcast">
        <label class="auth-field">
          <span>Отправитель</span>
          <input v-model="sender" class="auth-input" type="text" maxlength="80" placeholder="Оставьте пустым — Администрация" autocomplete="off" />
          <small class="admin-broadcast-field-note">Будет показан над заголовком уведомления и в push-сообщении.</small>
          <span v-if="fieldError('sender')" class="field-error">{{ fieldError('sender') }}</span>
        </label>
        <label class="auth-field">
          <span>Заголовок</span>
          <input v-model.trim="title" class="auth-input" type="text" maxlength="160" required placeholder="Например, Технические работы" />
          <span v-if="fieldError('title')" class="field-error">{{ fieldError('title') }}</span>
        </label>
        <label class="auth-field">
          <span>Текст уведомления</span>
          <textarea v-model.trim="message" class="auth-input admin-broadcast-message" rows="6" maxlength="3000" required placeholder="Напишите сообщение для пользователей…"></textarea>
          <span class="admin-broadcast-counter">{{ message.length }} / 3000</span>
          <span v-if="fieldError('message')" class="field-error">{{ fieldError('message') }}</span>
        </label>
        <label class="auth-field">
          <span>Ссылка (необязательно)</span>
          <input v-model.trim="link" class="auth-input" type="text" maxlength="512" placeholder="Например, /bans или /matches/mix" />
          <small class="admin-broadcast-field-note">При нажатии на уведомление пользователь перейдёт по этой ссылке. Укажите внутренний путь сайта.</small>
          <span v-if="fieldError('link')" class="field-error">{{ fieldError('link') }}</span>
        </label>

        <p v-if="error" class="auth-message" role="alert">{{ error }}</p>
        <div class="admin-broadcast-submit-row">
          <span>Рассылка будет отправлена всем, у кого включены системные сообщения.</span>
          <button class="dialog-primary" type="submit" :disabled="sending || !title.trim() || !message.trim()"><Send :size="14" /> {{ sending ? 'Отправляем…' : 'Отправить всем' }}</button>
        </div>
      </form>

      <aside class="admin-broadcast-side">
        <div class="admin-broadcast-preview-card">
          <div class="admin-broadcast-preview-heading"><BellRing :size="15" /> ПРЕДПРОСМОТР</div>
          <div class="admin-broadcast-preview-sender">От {{ previewSender }}</div>
          <strong>{{ title.trim() || 'Заголовок уведомления' }}</strong>
          <p>{{ message.trim() || 'Здесь будет отображаться текст общего уведомления.' }}</p>
          <span v-if="link.trim()" class="admin-broadcast-preview-link">{{ link }}</span>
        </div>
        <div class="admin-broadcast-info">
          <strong>Как работает рассылка</strong>
          <p>Уведомление появится в центре уведомлений сайта у всех пользователей, у которых разрешены уведомления аккаунта и категория «Системные сообщения».</p>
          <p>Для пользователей, которые не были активны на сайте последние 2 минуты и имеют push-подписку, дополнительно отправляется push в браузер.</p>
          <p>Настройки получателей находятся в профиле: Настройки → Уведомления → Системные сообщения.</p>
        </div>
      </aside>
    </div>

    <div v-if="result" class="admin-broadcast-result" role="status">
      <div class="admin-broadcast-result-icon"><ShieldCheck :size="18" /></div>
      <div>
        <strong>Уведомление отправлено</strong>
        <p>Получили уведомление: <b>{{ result.sent }}</b> из {{ result.totalUsers }} пользователей.</p>
        <p v-if="result.skippedByPreferences">Пропущено из-за настроек: {{ result.skippedByPreferences }}.</p>
        <p v-if="result.offlineWithPushSubscription">Пользователей вне сайта с push-подпиской: {{ result.offlineWithPushSubscription }}.</p>
        <p v-if="result.failed" class="admin-broadcast-result-warning">Ошибок доставки: {{ result.failed }}.</p>
        <small>Отправитель: {{ result.sender }}</small>
      </div>
    </div>
  </section>
</template>
