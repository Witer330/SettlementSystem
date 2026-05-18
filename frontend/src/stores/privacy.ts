import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'settlement-amount-visible'

export const usePrivacyStore = defineStore('privacy', () => {
  const stored = localStorage.getItem(STORAGE_KEY)
  const amountVisible = ref(stored === 'true')

  function toggleAmountVisibility() {
    amountVisible.value = !amountVisible.value
    localStorage.setItem(STORAGE_KEY, String(amountVisible.value))
  }

  return { amountVisible, toggleAmountVisibility }
})
