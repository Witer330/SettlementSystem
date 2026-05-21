<template>
  <div class="tab-content-wrapper">
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
    <div v-else class="tab-unknown">
      <p>未知的标签类型：{{ tab.type }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tab } from '@/stores/tabs'
import PurchaseOrderForm from '@/components/PurchaseOrderForm.vue'
import SalesOrderForm from '@/components/SalesOrderForm.vue'

defineProps<{
  tab: Tab
}>()

const emit = defineEmits<{
  tabSuccess: [tabId: string, orderNo: string]
  tabCancel: [tabId: string]
  tabDirty: [tabId: string, dirty: boolean]
  tabTitleChange: [tabId: string, title: string]
  tabToolbarAction: [tabId: string, action: string]
}>()
</script>

<style scoped>
.tab-content-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tab-unknown {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-muted);
}
</style>