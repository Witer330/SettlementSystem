import { defineStore } from 'pinia'
import { ref, computed, type Component } from 'vue'

export interface Tab {
  id: string
  type: string
  title: string
  icon?: string
  dirty: boolean
  /** 表单未保存内容标记，关闭时提示用户 */
  metadata: {
    orderId?: number
    isEdit?: boolean
    readonly?: boolean
    route?: string
    [key: string]: any
  }
}

/** Tab 类型 → 组件映射。新增可 tab 化的单据类型时在此注册。 */
export interface TabTypeRegistry {
  component: Component
  label: string
}

let tabIdCounter = 0
function nextTabId(type: string): string {
  return `${type}-${++tabIdCounter}-${Date.now()}`
}

export const useTabStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  const activeTab = computed(() =>
    tabs.value.find((t) => t.id === activeTabId.value) ?? null
  )

  const hasTabs = computed(() => tabs.value.length > 0)

  function registerType(_type: string, _registry: TabTypeRegistry) {
    // 占位 — 未来可用于动态注册，当前通过 TabContent.vue 的 v-if 映射
  }

  function addTab(type: string, title: string, metadata: Tab['metadata'] = {}): string {
    // 单据 Tab：相同 orderId 去重
    if (metadata.orderId) {
      const existing = tabs.value.find(
        (t) => t.type === type && t.metadata.orderId === metadata.orderId
      )
      if (existing) { activeTabId.value = existing.id; return existing.id }
    }
    // 页面 Tab：相同 route 或 type 去重（排除新建单据类）
    if (!metadata.isNew && !metadata.orderId) {
      const existing = tabs.value.find((t) => {
        if (t.metadata.isNew || t.metadata.orderId) return false
        if (metadata.route && t.metadata.route === metadata.route) return true
        return t.type === type
      })
      if (existing) { activeTabId.value = existing.id; return existing.id }
    }

    const id = nextTabId(type)
    tabs.value.push({ id, type, title, dirty: false, metadata: { ...metadata } })
    activeTabId.value = id
    return id
  }

  function removeTab(id: string) {
    const idx = tabs.value.findIndex((t) => t.id === id)
    if (idx === -1) return

    tabs.value.splice(idx, 1)

    if (activeTabId.value === id) {
      // 激活相邻 tab，没有则回退到路由视图
      if (tabs.value.length > 0) {
        const next = tabs.value[Math.min(idx, tabs.value.length - 1)]
        activeTabId.value = next.id
      } else {
        activeTabId.value = null
      }
    }
  }

  function setActiveTab(id: string) {
    if (tabs.value.some((t) => t.id === id)) {
      activeTabId.value = id
    }
  }

  /** 取消所有 tab 的激活状态，回到路由视图 */
  function deactivateAll() {
    activeTabId.value = null
  }

  function updateTab(id: string, patch: Partial<Pick<Tab, 'title' | 'dirty' | 'metadata'>>) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) Object.assign(tab, patch)
  }

  function closeAllTabs() {
    tabs.value = []
    activeTabId.value = null
  }

  /** 限制最大 tab 数量，超出时移除最早的 */
  function enforceLimit(max = 10) {
    while (tabs.value.length > max) {
      tabs.value.shift()
    }
    if (activeTabId.value && !tabs.value.some((t) => t.id === activeTabId.value)) {
      activeTabId.value = tabs.value.length > 0 ? tabs.value[tabs.value.length - 1].id : null
    }
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    hasTabs,
    addTab,
    removeTab,
    setActiveTab,
    deactivateAll,
    updateTab,
    closeAllTabs,
    enforceLimit,
    registerType
  }
})