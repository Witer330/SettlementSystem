<template>
  <div class="dashboard">
    <el-container class="dashboard-container">
      <el-aside :width="sidebarWidth" class="dashboard-sidebar">
        <div class="sidebar-header">
          <h1 class="logo">结算系统</h1>
        </div>

        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapsed"
          class="sidebar-menu"
          router
        >
          <el-menu-item index="/dashboard">
            <el-icon><House /></el-icon>
            <template #title>首页</template>
          </el-menu-item>

          <el-sub-menu index="salary">
            <template #title>
              <el-icon><Money /></el-icon>
              <span>工资核算</span>
            </template>
            <el-menu-item index="/salary/employees">员工管理</el-menu-item>
            <el-menu-item index="/salary/products">产品管理</el-menu-item>
            <el-menu-item index="/salary/processes">工序管理</el-menu-item>
            <el-menu-item index="/salary/production-records">生产报工</el-menu-item>
            <el-menu-item index="/salary/salary-calculation">工资计算</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="inventory">
            <template #title>
              <el-icon><Box /></el-icon>
              <span>进销存</span>
            </template>
            <el-menu-item index="/inventory/suppliers">供应商管理</el-menu-item>
            <el-menu-item index="/inventory/customers">客户管理</el-menu-item>
            <el-menu-item index="/inventory/materials">物料管理</el-menu-item>
            <el-menu-item index="/inventory/purchase-orders">采购管理</el-menu-item>
            <el-menu-item index="/inventory/sales-orders">销售管理</el-menu-item>
            <el-menu-item index="/inventory/inventory-query">库存查询</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="system">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统设置</span>
            </template>
            <el-menu-item index="/system/users">用户管理</el-menu-item>
            <el-menu-item index="/system/departments">部门管理</el-menu-item>
            <el-menu-item index="/system/settings">系统设置</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-aside>

      <el-container class="dashboard-main">
        <el-header class="dashboard-header">
          <div class="header-left">
            <el-button
              :icon="isCollapsed ? Expand : Fold"
              class="collapse-btn"
              @click="toggleSidebar"
            />
            <h2 class="page-title">{{ currentPageTitle }}</h2>
          </div>

          <div class="header-right">
            <div class="user-info">
              <span class="text-body">管理员</span>
            </div>
            <el-button
              type="primary"
              class="logout-btn"
              @click="handleLogout"
            >
              退出
            </el-button>
          </div>
        </el-header>

        <el-main class="dashboard-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { House, Money, Box, Setting, Fold, Expand } from '@element-plus/icons-vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const isCollapsed = ref(false)
const sidebarWidth = computed(() => isCollapsed.value ? '64px' : '240px')
const activeMenu = computed(() => route.path.path || route.path)

const currentPageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/dashboard': '首页',
    '/salary/employees': '员工管理',
    '/salary/products': '产品管理',
    '/salary/processes': '工序管理',
    '/salary/production-records': '生产报工',
    '/salary/salary-calculation': '工资计算',
    '/inventory/suppliers': '供应商管理',
    '/inventory/customers': '客户管理',
    '/inventory/materials': '物料管理',
    '/inventory/purchase-orders': '采购管理',
    '/inventory/sales-orders': '销售管理',
    '/inventory/inventory-query': '库存查询',
    '/system/users': '用户管理',
    '/system/departments': '部门管理',
    '/system/settings': '系统设置'
  }
  return titles[route.path] || '首页'
})

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleLogout = () => {
  router.push('/login')
}
</script>

<style scoped>
.dashboard {
  height: 100vh;
}

.dashboard-container {
  height: 100%;
}

/* Sidebar */
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
}

.logo {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-700);
  letter-spacing: var(--letter-body);
  margin: 0;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: var(--sidebar-width);
}

/* Main Content */
.dashboard-main {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dashboard-header {
  height: var(--header-height);
  background-color: var(--color-white);
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.collapse-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-circle);
}

.page-title {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-450);
  letter-spacing: var(--letter-body);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background-color: var(--glass-dark);
  border-radius: var(--radius-pill);
}

.logout-btn {
  border-radius: var(--radius-pill);
}

.dashboard-content {
  flex: 1;
  background-color: var(--el-bg-color-page);
  padding: var(--space-6);
  overflow-y: auto;
}

/* Welcome Section */
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.welcome h1 {
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-700);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-display);
  margin-bottom: var(--space-6);
  color: var(--color-black);
}

.welcome p {
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-340);
  line-height: var(--line-subheading);
  letter-spacing: var(--letter-subheading);
  color: var(--el-text-color-secondary);
}

/* Stats Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.stat-card {
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
}

.stat-label {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-340);
  letter-spacing: var(--letter-body);
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  margin-bottom: var(--space-2);
}

.stat-value {
  font-size: var(--font-size-h2);
  font-weight: var(--font-weight-700);
  line-height: var(--line-heading);
  letter-spacing: var(--letter-heading);
  color: var(--color-black);
  margin-bottom: var(--space-2);
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-330);
}

.stat-trend.positive {
  color: var(--color-success);
}

.stat-trend.negative {
  color: var(--color-danger);
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: var(--z-modal);
  }

  .is-collapsed {
    left: calc(-1 * var(--sidebar-width));
  }

  .dashboard-main {
    margin-left: 0;
  }

  .dashboard-header {
    padding: 0 var(--space-4);
  }

  .user-info {
    display: none;
  }

  .logout-btn {
    padding: 8px 12px;
  }
}

@media (max-width: 560px) {
  .page-title {
    font-size: var(--font-size-body);
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
