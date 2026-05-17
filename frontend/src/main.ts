import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
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
app.use(ElementPlus, { locale: zhCn })

// 抑制 Vue Flow / Element Plus 在路由切换时内部 DOM 竞态所致的 parentNode null 错误
app.config.errorHandler = (err, _instance, info) => {
  if (err instanceof TypeError && err.message.includes('parentNode')) {
    // Vue Flow 内部 cleanup 在组件卸载后触发 DOM 操作，可安全忽略
    return
  }
  console.error(`[Vue Error] ${info}:`, err)
}

setupElementPlusTheme()

app.mount('#app')

import { useThemeStore } from './stores/theme'
const themeStore = useThemeStore()
themeStore.init()
