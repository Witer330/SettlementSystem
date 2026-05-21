<template>
  <div class="dashboard">
    <el-container class="dashboard-container">
      <AppSidebar :is-collapsed="isCollapsed" />

      <el-container class="dashboard-main">
        <AppHeader
          :is-collapsed="isCollapsed"
          @toggle-sidebar="toggleSidebar"
        />

        <!-- Tab Bar -->
        <div v-if="tabStore.hasTabs" class="tab-bar">
          <div class="tab-bar-scroll">
            <div
              v-for="tab in tabStore.tabs"
              :key="tab.id"
              class="tab-item"
              :class="{ active: tab.id === tabStore.activeTabId }"
              @click="tabStore.setActiveTab(tab.id)"
            >
              <span class="tab-dot" :class="{ dirty: tab.dirty }" />
              <span class="tab-title">{{ tab.title }}</span>
              <el-button
                class="tab-close"
                link
                :icon="Close"
                @click.stop="handleTabClose(tab)"
              />
            </div>
          </div>
          <div class="tab-bar-actions">
            <el-button link :icon="Close" @click="handleCloseAllTabs">
              关闭全部
            </el-button>
          </div>
        </div>

        <el-main class="dashboard-content">
          <TabContent
            v-if="tabStore.activeTab"
            :key="tabStore.activeTab.id"
            :tab="tabStore.activeTab"
            @tab-success="onTabSuccess"
            @tab-cancel="onTabCancel"
            @tab-dirty="onTabDirty"
            @tab-title-change="onTabTitleChange"
            @tab-toolbar-action="onTabToolbarAction"
          />
          <router-view v-else />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import AppSidebar from './layout/AppSidebar.vue'
import AppHeader from './layout/AppHeader.vue'
import TabContent from '@/components/TabContent.vue'
import { useTabStore, type Tab } from '@/stores/tabs'

const isCollapsed = ref(false)
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const route = useRoute()
const tabStore = useTabStore()

// 侧边栏导航时取消所有 tab 的激活状态，展示路由页面
watch(
  () => route.path,
  () => {
    if (tabStore.activeTabId) {
      tabStore.deactivateAll()
    }
  }
)

function onTabSuccess(tabId: string, _orderNo: string) {
  tabStore.removeTab(tabId)
}

function onTabCancel(tabId: string) {
  tabStore.removeTab(tabId)
}

function onTabDirty(tabId: string, dirty: boolean) {
  tabStore.updateTab(tabId, { dirty })
}

function onTabTitleChange(tabId: string, title: string) {
  tabStore.updateTab(tabId, { title })
}

function onTabToolbarAction(_tabId: string, action: string) {
  const meta = tabStore.activeTab?.metadata
  const orderId = meta?.orderId
  switch (action) {
    case 'flow-log':
      // 触发列表页显示流转弹窗 - 通过 query 参数传递
      break
    case 'confirm':
    case 'complete':
      // 由表单内部处理，不需要额外动作
      break
    case 'material-requirements':
      if (orderId) window.open(`/dashboard/inventory/material-requirements?orderId=${orderId}`, '_blank')
      break
    default:
      console.log('Toolbar action:', action, 'tabId:', _tabId)
  }
}

async function handleTabClose(tab: Tab) {
  if (tab.dirty) {
    try {
      await ElMessageBox.confirm(
        `"${tab.title}" 尚有未保存的内容，关闭后将丢失。`,
        '确认关闭',
        { confirmButtonText: '关闭', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }
  tabStore.removeTab(tab.id)
}

async function handleCloseAllTabs() {
  const dirtyCount = tabStore.tabs.filter((t) => t.dirty).length
  if (dirtyCount > 0) {
    try {
      await ElMessageBox.confirm(
        `有 ${dirtyCount} 个标签页未保存，关闭后将丢失。确定关闭全部？`,
        '关闭全部标签',
        { confirmButtonText: '全部关闭', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }
  tabStore.closeAllTabs()
}
</script>

<style scoped>
.dashboard {
  height: 100vh;
}

.dashboard-container {
  height: 100%;
}

.dashboard-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
}

/* ── Tab Bar ── */
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}

.tab-bar-scroll {
  display: flex;
  align-items: stretch;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  height: 100%;
}

.tab-bar-scroll::-webkit-scrollbar {
  display: none;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 100%;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  border-right: 1px solid var(--el-border-color-light);
  background: transparent;
  white-space: nowrap;
  user-select: none;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.tab-item:hover {
  background: var(--el-fill-color);
  color: var(--color-text-primary);
}

.tab-item.active {
  background: var(--color-white);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-500);
  border-bottom: 2px solid var(--color-primary);
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
}

.tab-dot.dirty {
  background: var(--color-warning, #e6a23c);
}

.tab-title {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  padding: 2px;
  width: 16px;
  height: 16px;
  font-size: 10px;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.tab-close:hover {
  background: var(--el-fill-color);
  color: var(--color-danger);
}

.tab-bar-actions {
  display: flex;
  align-items: center;
  padding: 0 8px;
  flex-shrink: 0;
  font-size: var(--font-size-xs);
}

/* ── Content ── */
.dashboard-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: var(--el-bg-color-page);
  padding: 0;
  overflow: hidden;
}

@media (max-width: 768px) {
  .dashboard-main {
    margin-left: 0;
  }
}
</style>