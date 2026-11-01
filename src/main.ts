import { createApp } from 'vue'
import AppRoot from './AppRoot.vue'
import { router } from './router'
import './home.css'
import './theme.css'

createApp(AppRoot).use(router).mount('#app')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Не удалось зарегистрировать service worker.', error)
    })
  })
}
