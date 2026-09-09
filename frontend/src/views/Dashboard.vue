<template>
  <div class="dashboard">
    <el-container class="dashboard-container">
      <AppSidebar :is-collapsed="isCollapsed" @navigate="onNavigate" />

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
          <div v-else class="page-scroll"><router-view /></div>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const router = useRouter()
let navigatingFromSidebar = false

function onNavigate(path: string, title: string) {
  if (path === '/dashboard') { tabStore.deactivateAll(); router.push('/dashboard'); return }
  navigatingFromSidebar = true
  tabStore.addTab(path, title, { route: path })
  router.push(path)
}
const tabStore = useTabStore()

// 侧边栏导航时取消所有 tab 的激活状态，展示路由页面
watch(
  () => route.path,
  () => {
    if (navigatingFromSidebar) { navigatingFromSidebar = false; return }
    if (tabStore.activeTabId) {
      tabStore.deactivateAll()
    }
  }
)

function onTabSuccess(tabId: string, orderNo: string) {
  // 保存成功 → 更新标签标题和单号，保持可编辑，不关闭
  if (orderNo) {
    const tab = tabStore.tabs.find(t => t.id === tabId)
    if (tab) {
      tabStore.updateTab(tabId, {
        title: tab.type === 'purchase-order' ? '采购单 - ' + orderNo : '销货单 - ' + orderNo,
        metadata: { ...tab.metadata, orderId: tab.metadata.orderId || 0 }
      })
    }
  }
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
      if (orderId) router.push(`/dashboard/inventory/material-requirements?orderId=${orderId}`)
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
  height: 34px;
  background: #e8e8e8;
  border-bottom: 1px solid #d9d9d9;
  flex-shrink: 0;
}

.tab-bar-scroll {
  display: flex;
  align-items: flex-end;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  height: 100%;
  padding: 4px 4px 0;
  gap: 0;
}
.tab-bar-scroll::-webkit-scrollbar { display: none; }

.tab-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  height: 28px;
  font-size: 12px;
  color: #999;
  cursor: pointer;
  background: #e0e0e0;
  white-space: nowrap;
  user-select: none;
  border-radius: 6px 6px 0 0;
  margin-right: 1px;
  flex-shrink: 0;
  border: 1px solid transparent;
  transition: background .12s, color .12s, border-color .12s;
}
.tab-item:hover {
  background: #ededed;
  color: #555;
}
.tab-item.active {
  background: #fff;
  color: #111;
  font-weight: 600;
  border-color: #d9d9d9;
  border-bottom-color: #fff;
  position: relative;
  z-index: 1;
}

.tab-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
}
.tab-dot.dirty { background: #e6a23c; }

.tab-title {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
}

.tab-close {
  padding: 0; margin-left: 2px;
  width: 14px; height: 14px;
  font-size: 10px;
  color: #bbb;
  border-radius: 3px;
  flex-shrink: 0;
  transition: opacity .12s, background .12s, color .12s;
}
.tab-item.active .tab-close { opacity: .6; }
.tab-item:hover .tab-close { opacity: 1; }
.tab-close:hover {
  background: #fee;
  color: #e44;
}

.tab-bar-actions {
  display: flex;
  align-items: center;
  padding: 0 8px;
  flex-shrink: 0;
  font-size: 11px;
  color: #999;
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
.page-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .dashboard-main {
    margin-left: 0;
  }
}
</style>