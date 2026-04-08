import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import setupElementPlusTheme from './styles/element-plus-theme'
import './styles/design-system.css'
import './styles/page-common.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// Setup Element Plus theme
setupElementPlusTheme(app)

app.mount('#app')
