<template>
  <div v-if="visible" class="dab-root">
    <!-- ═══ 基础控制 ═══ -->
    <span class="dab-label">基础控制</span>
    <el-button size="small" type="primary" :disabled="!baseEnabled.submit" @click="$emit('action', 'submit')">保存</el-button>

    <span class="dab-sep" />

    <!-- ═══ 状态流转 ═══ -->
    <span class="dab-label">状态流转</span>
    <el-button
      v-if="canDo('confirm')"
      size="small"
      type="warning"
      @click="$emit('action', 'confirm')"
    >提交审核</el-button>
    <el-button
      v-if="canDo('complete')"
      size="small"
      type="success"
      @click="$emit('action', 'complete')"
    >完成</el-button>
    <el-button
      v-if="canDo('unconfirm')"
      size="small"
      @click="$emit('action', 'unconfirm')"
    >反确认</el-button>
    <el-button
      v-if="canDo('uncomplete')"
      size="small"
      @click="$emit('action', 'uncomplete')"
    >反完成</el-button>

    <span v-if="hasGen" class="dab-sep" />

    <!-- ═══ 下游生单 ═══ -->
    <template v-if="hasGen">
      <span class="dab-label">下游生单</span>
      <el-button v-if="has('ship')" size="small" type="success" :disabled="!canDo('ship')" @click="$emit('action', 'ship')">发货</el-button>
      <el-button v-if="has('receive')" size="small" type="success" :disabled="!canDo('receive')" @click="$emit('action', 'receive')">收货入库</el-button>
      <el-button v-if="has('create-receivable')" size="small" :disabled="!canDo('create-receivable')" @click="$emit('action', 'create-receivable')">应收</el-button>
      <el-button v-if="has('create-payable')" size="small" :disabled="!canDo('create-payable')" @click="$emit('action', 'create-payable')">应付</el-button>
      <el-button v-if="has('create-production')" size="small" :disabled="!canDo('create-production')" @click="$emit('action', 'create-production')">生产</el-button>
      <el-button v-if="has('create-return')" size="small" :disabled="!canDo('create-return')" @click="$emit('action', 'create-return')">退货</el-button>
    </template>

    <span v-if="hasDataView" class="dab-sep" />

    <!-- ═══ 数据查看 ═══ -->
    <template v-if="hasDataView">
      <span class="dab-label">数据查看</span>
      <el-button v-if="has('material-requirements')" size="small" :disabled="!canDo('material-requirements')" @click="$emit('action', 'material-requirements')">物料</el-button>
      <el-button size="small" @click="$emit('action', 'config-header')">表头</el-button>
      <el-button size="small" @click="$emit('action', 'flow-log')">流程图</el-button>
    </template>

    <span class="dab-spacer" />

    <!-- ═══ 危险操作 ═══ -->
    <span class="dab-sep" />
    <span class="dab-label dab-label--danger">危险操作</span>
    <el-button v-if="has('delete')" size="small" type="danger" :disabled="!canDo('delete')" @click="$emit('action', 'delete')">作废</el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type VisibilityMap = Record<string, string[]>

const props = defineProps<{
  orderType: 'purchase-order' | 'sales-order'
  status: string
  orderId: number
  isLocked: boolean
  readonly: boolean
}>()

defineEmits<{ action: [key: string] }>()

// 按单据类型区分可用的操作键
const ORDER_KEYS: Record<string, string[]> = {
  'sales-order': ['ship', 'create-receivable', 'create-production', 'create-return', 'material-requirements', 'delete'],
  'purchase-order': ['receive', 'create-payable', 'delete']
}

// save-draft 仅在草稿/待确认时可用；已确认/已完成只能通过编辑保存
const vis: Record<string, VisibilityMap> = {
  'sales-order': {
    draft: ['delete'],
    pending: ['confirm', 'material-requirements', 'delete'],
    confirmed: ['complete', 'unconfirm', 'ship', 'create-receivable', 'create-production', 'create-return', 'material-requirements', 'delete'],
    completed: ['uncomplete', 'create-receivable', 'create-return', 'material-requirements']
  },
  'purchase-order': {
    draft: ['delete'],
    pending: ['confirm', 'delete'],
    confirmed: ['complete', 'unconfirm', 'receive', 'create-payable', 'delete'],
    completed: ['uncomplete', 'receive', 'create-payable']
  }
}

const baseEnabled = computed(() => {
  if (props.readonly || props.isLocked) return { submit: false }
  return { submit: props.status !== 'completed' }
})

const lockEnabled: Record<string, string[]> = {
  'sales-order': ['complete', 'ship', 'create-return', 'material-requirements'],
  'purchase-order': ['receive']
}

const enabledKeys = computed(() => {
  if (props.readonly) return [] as string[]
  if (props.isLocked) return lockEnabled[props.orderType] || []
  return (vis[props.orderType]?.[props.status]) || []
})

const enabledSet = computed(() => new Set(enabledKeys.value))

function canDo(key: string): boolean { return enabledSet.value.has(key) }
function has(key: string): boolean { return (ORDER_KEYS[props.orderType] || []).includes(key) }

const hasGen = computed(() => {
  const genKeys = props.orderType === 'sales-order'
    ? ['ship', 'create-receivable', 'create-production', 'create-return']
    : ['receive', 'create-payable']
  return genKeys.some(k => has(k))
})
const hasDataView = computed(() => props.orderType === 'sales-order' && has('material-requirements'))

const visible = computed(() => {
  if (props.readonly && !props.orderId) return false
  return true
})
</script>

<style scoped>
.dab-root {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  flex-wrap: nowrap;
  overflow-x: auto;
}
.dab-label {
  font-size: 12px;
  font-weight: 600;
  color: #999;
  user-select: none;
  white-space: nowrap;
  letter-spacing: 0.3px;
}
.dab-label--danger {
  color: #e09090;
}
.dab-sep {
  width: 1px;
  height: 22px;
  background: #d9d9d9;
  margin: 0 6px;
  flex-shrink: 0;
}
.dab-spacer {
  flex: 1;
  min-width: 16px;
}
</style>
