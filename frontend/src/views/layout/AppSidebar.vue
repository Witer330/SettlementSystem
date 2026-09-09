<template>
  <el-aside
    :width="width"
    class="dashboard-sidebar"
  >
    <div class="sidebar-header">
      <div class="logo-area">
        <h1 class="logo">{{ companyName || systemName }}</h1>
        <span v-if="companyName" class="logo-sub">{{ systemName }}</span>
      </div>
    </div>

    <el-menu
      :default-active="activeMenu"
      :collapse="isCollapsed"
      class="sidebar-menu"
      @select="onMenuSelect"
    >
      <el-menu-item index="/dashboard">
        <el-icon>
          <House />
        </el-icon>
        <template #title>
          首页
        </template>
      </el-menu-item>

      <el-sub-menu v-if="menuVisible('sales')" index="sales">
        <template #title>
          <el-icon><Sell /></el-icon>
          <span>销售</span>
        </template>
        <el-menu-item index="/dashboard/inventory/sales-orders">销售管理</el-menu-item>
        <el-menu-item index="/dashboard/inventory/material-requirements">物料需求</el-menu-item>
      </el-sub-menu>

      <el-sub-menu v-if="menuVisible('purchase')" index="purchase">
        <template #title>
          <el-icon><ShoppingCart /></el-icon>
          <span>采购</span>
        </template>
        <el-menu-item index="/dashboard/inventory/purchase-orders">采购管理</el-menu-item>
      </el-sub-menu>

      <el-sub-menu v-if="menuVisible('inventory')" index="inventory">
        <template #title>
          <el-icon><Box /></el-icon>
          <span>库存</span>
        </template>
        <el-menu-item index="/dashboard/inventory/inbound">入库管理</el-menu-item>
        <el-menu-item index="/dashboard/inventory/outbound">出库管理</el-menu-item>
        <el-menu-item index="/dashboard/inventory/inventory-query">库存查询</el-menu-item>
      </el-sub-menu>

      <el-sub-menu v-if="menuVisible('finance')" index="finance">
        <template #title>
          <el-icon><Wallet /></el-icon>
          <span>应收应付</span>
        </template>
        <el-menu-item index="/dashboard/finance/receivables">
          应收管理
        </el-menu-item>
        <el-menu-item index="/dashboard/finance/payables">
          应付管理
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu v-if="menuVisible('production')" index="production">
        <template #title>
          <el-icon><Tools /></el-icon>
          <span>生产管理</span>
        </template>
        <el-menu-item index="/dashboard/production/orders">
          生产工单
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu v-if="menuVisible('salary')" index="salary">
        <template #title>
          <el-icon><Money /></el-icon>
          <span>工资核算</span>
        </template>
        <el-menu-item index="/dashboard/salary/salary-entry">
          工资录入
        </el-menu-item>
        <el-menu-item index="/dashboard/salary/salary-calculation">
          工资核算
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu v-if="menuVisible('basic-info')" index="basic-info">
        <template #title>
          <el-icon><Briefcase /></el-icon>
          <span>基础信息</span>
        </template>
        <el-menu-item index="/dashboard/inventory/partners">
          往来管理
        </el-menu-item>
        <el-menu-item index="/dashboard/inventory/materials">
          物料管理
        </el-menu-item>
        <el-menu-item index="/dashboard/basic-info/products">
          产品管理
        </el-menu-item>
        <el-menu-item index="/dashboard/basic-info/bom">
          BOM 管理
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu v-if="menuVisible('system')" index="system">
        <template #title>
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </template>
        <el-menu-item index="/dashboard/system/employees">
          员工管理
        </el-menu-item>
        <el-menu-item index="/dashboard/system/job-types">
          工种管理
        </el-menu-item>
        <el-menu-item index="/dashboard/system/departments">
          部门管理
        </el-menu-item>
        <el-menu-item index="/dashboard/system/users">
          用户管理
        </el-menu-item>
        <el-menu-item index="/dashboard/system/settings">
          系统设置
        </el-menu-item>
      </el-sub-menu>
    </el-menu>
  </el-aside>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect, onMounted } from 'vue'
import { House, Money, Box, Setting, Briefcase, Tools, Wallet, Sell, ShoppingCart } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { settingApi } from '@/api/setting'
import { useTabStore } from '@/stores/tabs'
import { useSidebarStore } from '@/stores/sidebar'

const props = defineProps<{
  isCollapsed: boolean
}>()

const emit = defineEmits<{
  navigate: [path: string, title: string]
}>()

const route = useRoute()
const tabStore = useTabStore()
const sidebarStore = useSidebarStore()

const width = computed(() => (props.isCollapsed ? '64px' : '240px'))
// 侧边栏高亮：跟踪 Tab 激活状态或路由
const activeMenu = ref(route.path)
watchEffect(() => {
  const tid = tabStore.activeTabId
  if (tid) {
    const t = tabStore.tabs.find(x => x.id === tid)
    activeMenu.value = t?.metadata?.route || route.path
  } else {
    activeMenu.value = route.path
  }
})

const MENU_TITLES: Record<string, string> = {
  '/dashboard': '首页',
  '/dashboard/inventory/sales-orders': '销售管理',
  '/dashboard/inventory/material-requirements': '物料需求',
  '/dashboard/inventory/purchase-orders': '采购管理',
  '/dashboard/inventory/inbound': '入库管理',
  '/dashboard/inventory/outbound': '出库管理',
  '/dashboard/inventory/inventory-query': '库存查询',
  '/dashboard/inventory/return-orders': '退货管理',
  '/dashboard/production/orders': '生产工单',
  '/dashboard/salary/salary-entry': '工资录入',
  '/dashboard/salary/salary-calculation': '工资核算',
  '/dashboard/finance/receivables': '应收管理',
  '/dashboard/finance/payables': '应付管理',
  '/dashboard/inventory/partners': '往来管理',
  '/dashboard/inventory/materials': '物料管理',
  '/dashboard/basic-info/products': '产品管理',
  '/dashboard/basic-info/bom': 'BOM 管理',
  '/dashboard/system/users': '用户管理',
  '/dashboard/system/job-types': '工种管理',
  '/dashboard/system/employees': '员工管理',
  '/dashboard/system/departments': '部门管理',
  '/dashboard/system/settings': '系统设置'
}

function onMenuSelect(index: string) {
  if (!index.startsWith('/dashboard')) return
  activeMenu.value = index  // 立即高亮，避免闪烁
  const title = MENU_TITLES[index] || index
  emit('navigate', index, title)
}

const systemName = ref('结算系统')
const companyName = ref('')
onMounted(async () => {
  const [name, company, hiddenRaw] = await Promise.all([
    settingApi.getTyped<string>('system.name'),
    settingApi.getTyped<string>('system.companyName'),
    settingApi.getTyped<string>('ui.sidebar.hidden')
  ])
  if (name) systemName.value = name
  if (company) companyName.value = company
  document.title = [company, name].filter(Boolean).join(' - ') || '结算系统'
  try { if (hiddenRaw) { const arr = Array.isArray(hiddenRaw) ? hiddenRaw : JSON.parse(hiddenRaw); sidebarStore.setHidden(arr) } } catch {}
})

function menuVisible(key: string) { return sidebarStore.isVisible(key) }
</script>

<style scoped>
.dashboard-sidebar {
  background-color: var(--color-white);
  border-right: 1px solid var(--el-border-color-light);
  transition: width var(--transition-base);
}

.sidebar-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--el-border-color-light);
  overflow: hidden;
}

.logo-area {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.logo {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-700);
  letter-spacing: var(--letter-body);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logo-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: var(--sidebar-width);
}
</style>
