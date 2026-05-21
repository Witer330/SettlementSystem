<template>
  <!-- 扁平模式：按钮直接排列，无分组框 -->
  <div v-if="mode === 'flat'" class="doc-toolbar-flat">
    <el-button
      v-for="btn in flatButtons"
      :key="btn.key"
      :type="btn.type || 'default'"
      size="small"
      :disabled="btn.disabled"
      @click="handleAction(btn.key)"
    >
      <el-icon v-if="btn.icon" style="margin-right:4px"><component :is="btn.icon" /></el-icon>
      {{ btn.label }}
    </el-button>
  </div>
  <!-- 默认模式：分组卡片 -->
  <div v-else class="doc-toolbar">
    <div
      v-for="group in visibleGroups"
      :key="group.key"
      class="toolbar-group"
    >
      <span class="toolbar-group-label">{{ group.label }}</span>
      <div class="toolbar-group-buttons">
        <el-button
          v-for="btn in group.buttons"
          :key="btn.key"
          :type="btn.type || 'default'"
          size="small"
          :disabled="btn.disabled"
          @click="handleAction(btn.key)"
        >
          <el-icon v-if="btn.icon" style="margin-right:4px"><component :is="btn.icon" /></el-icon>
          {{ btn.label }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Check, Close, Delete, Connection,
  Box, Ticket, Money, Cpu, RefreshLeft
} from '@element-plus/icons-vue'

export interface ToolbarAction {
  key: string
  label: string
  icon?: any
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  group: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  orderType: 'purchase-order' | 'sales-order'
  status: string
  orderId: number
  isLocked: boolean
  readonly: boolean
  mode?: 'toolbar' | 'flat'
}>(), {
  mode: 'toolbar'
})

const emit = defineEmits<{
  action: [key: string]
}>()

function handleAction(key: string) {
  emit('action', key)
}

// ── 采购单操作配置 ──
const purchaseActions: ToolbarAction[] = [
  { key: 'confirm', label: '确认', icon: Check, type: 'warning', group: 'audit' },
  { key: 'unconfirm', label: '反确认', icon: Close, type: 'warning', group: 'audit' },
  { key: 'receive', label: '采购入库', icon: Box, type: 'success', group: 'flow' },
  { key: 'create-payable', label: '生成应付单', icon: Money, type: 'primary', group: 'flow' },
  { key: 'delete', label: '删除', icon: Delete, type: 'danger', group: 'data' },
  { key: 'flow-log', label: '流转记录', icon: Connection, type: 'info', group: 'view' }
]

// ── 销售单操作配置 ──
const salesActions: ToolbarAction[] = [
  { key: 'confirm', label: '确认', icon: Check, type: 'warning', group: 'audit' },
  { key: 'unconfirm', label: '反确认', icon: Close, type: 'warning', group: 'audit' },
  { key: 'complete', label: '完成', icon: Check, type: 'success', group: 'audit' },
  { key: 'uncomplete', label: '反完成', icon: Close, type: 'warning', group: 'audit' },
  { key: 'create-receivable', label: '生成应收单', icon: Money, type: 'primary', group: 'flow' },
  { key: 'create-production', label: '生成生产工单', icon: Cpu, type: 'primary', group: 'flow' },
  { key: 'create-return', label: '退货', icon: RefreshLeft, type: 'danger', group: 'flow' },
  { key: 'material-requirements', label: '物料需求', icon: Ticket, type: 'success', group: 'flow' },
  { key: 'delete', label: '删除', icon: Delete, type: 'danger', group: 'data' },
  { key: 'flow-log', label: '流转记录', icon: Connection, type: 'info', group: 'view' }
]

// ── 状态 → 可见按钮映射 ──
const visibilityMap: Record<string, Record<string, string[]>> = {
  'purchase-order': {
    draft: ['delete', 'flow-log'],
    pending: ['confirm', 'receive', 'delete', 'flow-log'],
    confirmed: ['unconfirm', 'receive', 'create-payable', 'flow-log'],
    completed: ['receive', 'create-payable', 'flow-log']
  },
  'sales-order': {
    draft: ['delete', 'flow-log'],
    pending: ['confirm', 'delete', 'material-requirements', 'flow-log'],
    confirmed: ['unconfirm', 'complete', 'create-receivable', 'create-production', 'create-return', 'material-requirements', 'flow-log'],
    completed: ['create-receivable', 'create-return', 'material-requirements', 'flow-log']
  }
}

// 锁定状态覆盖：只允许查看和特定操作
const lockedOverrides: Record<string, string[]> = {
  'purchase-order': ['receive', 'flow-log'],
  'sales-order': ['complete', 'create-return', 'material-requirements', 'flow-log']
}

interface ButtonGroup {
  key: string
  label: string
  buttons: ToolbarAction[]
}

const groupOrder: Record<string, string> = {
  audit: '审核操作',
  flow: '流转操作',
  data: '数据操作',
  view: '查看'
}

// 扁平模式：所有可见按钮按组顺序排列
const flatButtons = computed<ToolbarAction[]>(() => {
  const btns: ToolbarAction[] = []
  for (const g of visibleGroups.value) btns.push(...g.buttons)
  return btns
})

const visibleGroups = computed<ButtonGroup[]>(() => {
  const allActions = props.orderType === 'purchase-order' ? purchaseActions : salesActions
  const map = visibilityMap[props.orderType] || {}
  const allowedKeys = new Set<string>(map[props.status] || [])

  // 锁定状态覆盖
  if (props.isLocked) {
    const locked = lockedOverrides[props.orderType] || []
    allowedKeys.clear()
    locked.forEach(k => allowedKeys.add(k))
  }

  // 只读时只保留查看组
  if (props.readonly) {
    allowedKeys.clear()
    allowedKeys.add('flow-log')
  }

  const filtered = allActions.filter(a => allowedKeys.has(a.key))

  // 分组
  const groups = new Map<string, ToolbarAction[]>()
  for (const a of filtered) {
    if (!groups.has(a.group)) groups.set(a.group, [])
    groups.get(a.group)!.push(a)
  }

  return [...groups.entries()]
    .filter(([, btns]) => btns.length > 0)
    .map(([key, buttons]) => ({
      key,
      label: groupOrder[key] || key,
      buttons
    }))
})
</script>

<style scoped>
.doc-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--radius-md, 8px);
}

.toolbar-group-label {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-muted);
  white-space: nowrap;
  margin-right: 2px;
  user-select: none;
}

.toolbar-group-buttons {
  display: flex;
  gap: 4px;
}

.doc-toolbar-flat {
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>