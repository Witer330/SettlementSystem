import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getAllThemes,
  getTheme,
  applyTheme,
  getDefaultThemeId,
  type ThemeConfig
} from '@/styles/themes'

const STORAGE_KEY = 'settlement-theme'
const API_KEY = 'ui.theme'

export const useThemeStore = defineStore('theme', () => {
  const currentThemeId = ref<string>(getDefaultThemeId())
  const isInitialized = ref(false)

  const currentTheme = computed<ThemeConfig | undefined>(() =>
    getTheme(currentThemeId.value)
  )

  const availableThemes = computed(() => getAllThemes())

  async function init(): Promise<void> {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && getTheme(stored)) {
      currentThemeId.value = stored
      applyTheme(getTheme(stored)!)
    } else {
      applyTheme(getTheme(getDefaultThemeId())!)
    }

    isInitialized.value = true

    try {
      const { settingApi } = await import('@/api/setting')
      const setting = await settingApi.getSetting(API_KEY)
      if (setting?.value && getTheme(setting.value)) {
        if (setting.value !== currentThemeId.value) {
          currentThemeId.value = setting.value
          applyTheme(getTheme(setting.value)!)
        }
      }
    } catch {
      // Backend unavailable — use localStorage value
    }
  }

  async function setTheme(themeId: string): Promise<void> {
    const theme = getTheme(themeId)
    if (!theme) return

    currentThemeId.value = themeId
    applyTheme(theme)

    try {
      const { settingApi } = await import('@/api/setting')
      await settingApi.updateSetting(API_KEY, themeId, 'UI 主题')
    } catch {
      // Non-critical — localStorage already saved
    }
  }

  return {
    currentThemeId,
    currentTheme,
    availableThemes,
    isInitialized,
    init,
    setTheme,
  }
})
