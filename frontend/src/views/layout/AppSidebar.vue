<template>
  <el-aside
    :width="width"
    class="dashboard-sidebar"
  >
    <div class="sidebar-header">
      <h1 class="logo">
        结算系统
      </h1>
    </div>

    <el-menu
      :default-active="activeMenu"
      :collapse="isCollapsed"
      class="sidebar-menu"
      router
    >
      <el-menu-item index="/dashboard">
        <el-icon>
          <House />
        </el-icon>
        <template #title>
          首页
        </template>
      </el-menu-item>

      <el-sub-menu index="inventory">
        <template #title>
          <el-icon>
            <Box />
          </el-icon>
          <span>进销存</span>
        </template>

        <el-menu-item index="/dashboard/inventory/sales-orders">
          销售管理
        </el-menu-item>
        <el-menu-item index="/dashboard/inventory/material-requirements">
          物料需求
        </el-menu-item>
        <el-menu-item index="/dashboard/inventory/purchase-orders">
          采购管理
        </el-menu-item>
        <el-menu-item index="/dashboard/inventory/inventory-query">
          库存查询
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="production">
        <template #title>
          <el-icon>
            <Tools />
          </el-icon>
          <span>生产管理</span>
        </template>
        <el-menu-item index="/dashboard/production/orders">
          生产工单
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="salary">
        <template #title>
          <el-icon>
            <Money />
          </el-icon>
          <span>工资核算</span>
        </template>
        <el-menu-item index="/dashboard/salary/daily-records">
          计件录入
        </el-menu-item>
        <el-menu-item index="/dashboard/salary/work-logs">
          工时录入
        </el-menu-item>
        <el-menu-item index="/dashboard/salary/other-salaries">
          其他工资
        </el-menu-item>
        <el-menu-item index="/dashboard/salary/salary-calculation">
          工资计算
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="basic-info">
        <template #title>
          <el-icon>
            <Briefcase />
          </el-icon>
          <span>基础信息</span>
        </template>
        <el-menu-item index="/dashboard/inventory/suppliers">
          供应商管理
        </el-menu-item>
        <el-menu-item index="/dashboard/inventory/customers">
          客户管理
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

      <el-sub-menu index="system">
        <template #title>
          <el-icon>
            <Setting />
          </el-icon>
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
import { computed } from 'vue'
import { House, Money, Box, Setting, Briefcase, Tools } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  isCollapsed: boolean
}>()

const route = useRoute()

const width = computed(() => (props.isCollapsed ? '64px' : '240px'))
const activeMenu = computed(() => route.path)
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
</style>
