import { createApp } from 'vue'
import AppRoot from './AppRoot.vue'
import { router } from './router'
import { tooltip } from './tooltip'
import './home.css'
import './theme.css'
import './tooltip.css'

createApp(AppRoot).directive('tooltip', tooltip).use(router).mount('#app')
