import { ref, watch } from 'vue'
import { usePrivacyStore } from '@/stores/privacy'

interface MaskAmountOptions {
  decimals?: number
  prefix?: string
  suffix?: string
  fallback?: string
  /** 局部可见性覆写：明细级或单据级揭示时传 true */
  visible?: boolean
}

export function useAmountPrivacy() {
  const privacyStore = usePrivacyStore()

  function formatMoney(value: number, decimals: number = 2): string {
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }

  function maskAmount(
    value: number | null | undefined,
    options: MaskAmountOptions = {}
  ): string {
    const { decimals = 2, prefix = '¥', suffix = '', fallback = '-', visible = false } = options

    if (value == null || isNaN(value)) return fallback
    if (!privacyStore.amountVisible && !visible) return `${prefix}***`

    return `${prefix}${formatMoney(value, decimals)}${suffix}`
  }

  return { maskAmount, formatMoney, amountVisible: privacyStore.amountVisible }
}

/** 创建局部揭示状态（明细级/单据级），全局关闭时自动重置 */
export function useReveal() {
  const store = usePrivacyStore()
  const revealed = ref(false)

  watch(() => store.amountVisible, (on) => {
    if (!on) revealed.value = false
  })

  function toggle() {
    revealed.value = !revealed.value
  }

  return { revealed, toggle }
}
