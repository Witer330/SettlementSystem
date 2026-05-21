<template>
  <div v-if="visible" class="dab-root">
    <!-- 选单 -->
    <el-button v-if="can('new')" size="small" text @click="$emit('action', 'new')">选单</el-button>

    <span v-if="can('new')" class="dab-div" />

    <!-- 保存（下拉） -->
    <el-dropdown v-if="can('save-draft') || can('submit') || can('confirm')" trigger="click" :disabled="status === 'completed'" @command="(k: string) => $emit('action', k)">
      <el-button size="small" text :disabled="status === 'completed'">保存<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="can('save-draft')" command="save-draft">保存草稿</el-dropdown-item>
          <el-dropdown-item v-if="can('submit')" command="submit">内容确认</el-dropdown-item>
          <el-dropdown-item v-if="can('confirm')" command="confirm">提交审核</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <span v-if="can('save-draft') || can('submit') || can('confirm')" class="dab-div" />

    <!-- 删除 -->
    <el-button v-if="can('delete')" size="small" text type="danger" @click="$emit('action', 'delete')">删除</el-button>

    <span v-if="can('delete')" class="dab-div" />

    <!-- 生单（下拉） -->
    <el-dropdown v-if="can('generate')" trigger="click" @command="(k: string) => $emit('action', k)">
      <el-button size="small" text>生单<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="can('create-receivable')" command="create-receivable">生成应收单</el-dropdown-item>
          <el-dropdown-item v-if="can('create-production')" command="create-production">生成生产工单</el-dropdown-item>
          <el-dropdown-item v-if="can('create-return')" command="create-return">退货</el-dropdown-item>
          <el-dropdown-item v-if="can('material-requirements')" command="material-requirements">物料需求</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <span v-if="can('generate')" class="dab-div" />

    <!-- 设置（下拉） -->
    <el-dropdown v-if="can('settings')" trigger="click" @command="(k: string) => $emit('action', k)">
      <el-button size="small" text>设置<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="config-header">表头字段配置</el-dropdown-item>
          <el-dropdown-item disabled>明细字段配置</el-dropdown-item>
          <el-dropdown-item disabled>表尾字段配置</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <span class="dab-div" />

    <!-- 流转记录 -->
    <el-button size="small" text @click="$emit('action', 'flow-log')">流转记录</el-button>

    <span class="dab-div" />

    <!-- 更多（下拉） -->
    <el-dropdown v-if="can('more')" trigger="click" @command="(k: string) => $emit('action', k)">
      <el-button size="small" text>更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="can('unconfirm')" command="unconfirm">反确认</el-dropdown-item>
          <el-dropdown-item v-if="can('complete')" command="complete">完成</el-dropdown-item>
          <el-dropdown-item v-if="can('uncomplete')" command="uncomplete">反完成</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'

const props = defineProps<{
  orderType: 'purchase-order' | 'sales-order'
  status: string
  orderId: number
  isLocked: boolean
  readonly: boolean
}>()

defineEmits<{ action: [key: string] }>()

type VisibilityMap = Record<string, string[]>

// 可见性配置
const vis: Record<string, VisibilityMap> = {
  'sales-order': {
    draft: ['new', 'save-draft', 'submit', 'delete', 'flow-log'],
    pending: ['new', 'save-draft', 'submit', 'delete', 'material-requirements', 'flow-log'],
    confirmed: ['new', 'save-draft', 'unconfirm', 'complete', 'create-receivable', 'create-production', 'create-return', 'material-requirements', 'flow-log'],
    completed: ['new', 'save-draft', 'create-receivable', 'create-return', 'material-requirements', 'flow-log']
  },
  'purchase-order': {
    draft: ['new', 'save-draft', 'submit', 'delete', 'flow-log'],
    pending: ['new', 'save-draft', 'submit', 'delete', 'flow-log'],
    confirmed: ['new', 'save-draft', 'unconfirm', 'complete', 'receive', 'create-payable', 'flow-log'],
    completed: ['new', 'save-draft', 'receive', 'create-payable', 'flow-log']
  }
}

// 锁定覆盖
const lockOverride: Record<string, string[]> = {
  'sales-order': ['new', 'save-draft', 'complete', 'create-return', 'material-requirements', 'flow-log'],
  'purchase-order': ['new', 'save-draft', 'receive', 'flow-log']
}

const visibleKeys = computed(() => {
  if (props.readonly) return ['new', 'flow-log']
  if (props.isLocked) return lockOverride[props.orderType] || ['new', 'flow-log']
  return (vis[props.orderType]?.[props.status]) || ['new', 'flow-log']
})

const allowed = computed(() => new Set(visibleKeys.value))

function can(key: string): boolean {
  // 复合键：生单组
  if (key === 'generate') {
    return ['create-receivable', 'create-production', 'create-return', 'material-requirements', 'create-payable', 'receive'].some(k => allowed.value.has(k))
  }
  // 设置组
  if (key === 'settings') return allowed.value.has('config-header')
  // 更多组
  if (key === 'more') {
    return ['unconfirm', 'complete', 'uncomplete'].some(k => allowed.value.has(k))
  }
  return allowed.value.has(key)
}

const visible = computed(() => visibleKeys.value.length > 0)
</script>

<style scoped>
.dab-root {
  display: flex;
  align-items: center;
  gap: 2px;
}
.dab-div {
  width: 1px;
  height: 18px;
  background: var(--border-color, #d0d5dd);
  margin: 0 4px;
}
</style>
