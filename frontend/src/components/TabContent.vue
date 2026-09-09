<template>
  <div class="tab-content-wrapper">
    <!-- 单据类 Tab -->
    <PurchaseOrderForm
      v-if="tab.type === 'purchase-order'"
      :key="tab.id"
      :inline="true"
      :is-edit="tab.metadata.isEdit ?? false"
      :edit-id="tab.metadata.orderId ?? 0"
      :row="null"
      :readonly="tab.metadata.readonly ?? false"
      @success="(orderNo) => emit('tabSuccess', tab.id, orderNo)"
      @cancel="emit('tabCancel', tab.id)"
      @dirty="(val) => emit('tabDirty', tab.id, val)"
      @title-change="(title) => emit('tabTitleChange', tab.id, title)"
      @toolbar-action="(action) => emit('tabToolbarAction', tab.id, action)"
    />
    <SalesOrderForm
      v-else-if="tab.type === 'sales-order'"
      :key="tab.id"
      :inline="true"
      :is-edit="tab.metadata.isEdit ?? false"
      :edit-id="tab.metadata.orderId ?? 0"
      :row="null"
      :readonly="tab.metadata.readonly ?? false"
      @success="(orderNo) => emit('tabSuccess', tab.id, orderNo)"
      @cancel="emit('tabCancel', tab.id)"
      @dirty="(val) => emit('tabDirty', tab.id, val)"
      @title-change="(title) => emit('tabTitleChange', tab.id, title)"
      @toolbar-action="(action) => emit('tabToolbarAction', tab.id, action)"
    />
    <!-- 工资明细单 Tab -->
    <SalaryDetailForm
      v-else-if="tab.type === 'salary-detail'"
      :key="tab.id"
      :sheet-id="tab.metadata.sheetId"
      :is-new="tab.metadata.isNew"
      :readonly="tab.metadata.readonly"
      @success="(sheetNo) => emit('tabSuccess', tab.id, sheetNo)"
      @cancel="emit('tabCancel', tab.id)"
    />
    <!-- 出入库表单 Tab -->
    <InventorySheetForm
      v-else-if="tab.type === 'inventory-in' || tab.type === 'inventory-out'"
      :key="tab.id"
      :sheet-id="tab.metadata.sheetId"
      :is-new="tab.metadata.isNew"
      :sheet-type="tab.metadata.sheetType"
      :readonly="tab.metadata.readonly"
      @success="(batchNo) => emit('tabSuccess', tab.id, batchNo)"
      @cancel="emit('tabCancel', tab.id)"
    />
    <!-- 通用页面 Tab -->
    <component
      v-else-if="tabComponent"
      :is="tabComponent"
      :key="tab.id"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { Tab } from '@/stores/tabs'
import PurchaseOrderForm from '@/components/PurchaseOrderForm.vue'
import SalesOrderForm from '@/components/SalesOrderForm.vue'
import SalaryDetailForm from '@/views/salary/SalaryDetailForm.vue'
import InventorySheetForm from '@/views/inventory/InventorySheetForm.vue'

const props = defineProps<{ tab: Tab }>()

const emit = defineEmits<{
  tabSuccess: [tabId: string, orderNo: string]
  tabCancel: [tabId: string]
  tabDirty: [tabId: string, dirty: boolean]
  tabTitleChange: [tabId: string, title: string]
  tabToolbarAction: [tabId: string, action: string]
}>()

// 通用页面组件映射
const PAGE_COMPONENTS: Record<string, any> = {
  '/dashboard/inventory/sales-orders': defineAsyncComponent(() => import('@/views/inventory/SalesOrder.vue')),
  '/dashboard/inventory/purchase-orders': defineAsyncComponent(() => import('@/views/inventory/PurchaseOrder.vue')),
  '/dashboard/inventory/inbound': defineAsyncComponent(() => import('@/views/inventory/InventorySheets.vue')),
  '/dashboard/inventory/outbound': defineAsyncComponent(() => import('@/views/inventory/InventorySheets.vue')),
  '/dashboard/inventory/inventory-query': defineAsyncComponent(() => import('@/views/inventory/InventoryQuery.vue')),
  '/dashboard/inventory/material-requirements': defineAsyncComponent(() => import('@/views/inventory/MaterialRequirement.vue')),
  '/dashboard/inventory/return-orders': defineAsyncComponent(() => import('@/views/inventory/ReturnOrder.vue')),
  '/dashboard/inventory/partners': defineAsyncComponent(() => import('@/views/inventory/PartnerList.vue')),
  '/dashboard/inventory/materials': defineAsyncComponent(() => import('@/views/inventory/MaterialList.vue')),
  '/dashboard/salary/salary-entry': defineAsyncComponent(() => import('@/views/salary/SalaryEntry.vue')),
  '/dashboard/salary/salary-calculation': defineAsyncComponent(() => import('@/views/salary/SalaryCalculation.vue')),
  '/dashboard/production/orders': defineAsyncComponent(() => import('@/views/production/ProductionOrder.vue')),
  '/dashboard/finance/receivables': defineAsyncComponent(() => import('@/views/finance/ReceivableList.vue')),
  '/dashboard/finance/payables': defineAsyncComponent(() => import('@/views/finance/PayableList.vue')),
  '/dashboard/basic-info/products': defineAsyncComponent(() => import('@/views/salary/ProductList.vue')),
  '/dashboard/basic-info/bom': defineAsyncComponent(() => import('@/views/inventory/BomManage.vue')),
  '/dashboard/system/users': defineAsyncComponent(() => import('@/views/system/UserManagement.vue')),
  '/dashboard/system/job-types': defineAsyncComponent(() => import('@/views/system/JobTypeList.vue')),
  '/dashboard/system/employees': defineAsyncComponent(() => import('@/views/salary/EmployeeList.vue')),
  '/dashboard/system/departments': defineAsyncComponent(() => import('@/views/system/DepartmentList.vue')),
  '/dashboard/system/settings': defineAsyncComponent(() => import('@/views/system/SystemSettings.vue'))
}

const tabComponent = computed(() => {
  const route = props.tab.metadata?.route || props.tab.type
  return PAGE_COMPONENTS[route] || null
})
</script>

<style scoped>
.tab-content-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
