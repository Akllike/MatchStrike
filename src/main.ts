import { createApp } from 'vue'
import AppRoot from './AppRoot.vue'
import { router } from './router'
import './home.css'
import './theme.css'

createApp(AppRoot).use(router).mount('#app')
