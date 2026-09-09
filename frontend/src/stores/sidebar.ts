import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSidebarStore = defineStore('sidebar', () => {
  const hiddenMenus = ref<Set<string>>(new Set())

  function setHidden(keys: string[]) {
    hiddenMenus.value = new Set(keys)
  }

  function isVisible(key: string): boolean {
    return !hiddenMenus.value.has(key)
  }

  return { hiddenMenus, setHidden, isVisible }
})
