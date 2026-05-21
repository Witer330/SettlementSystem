<template>
  <div class="dh-root">
    <!-- 行1：状态 + 单号 + 操作按钮 -->
    <div class="dh-topbar">
      <span class="dh-status" :class="`dh-status--${orderId ? status : 'draft'}`">{{ orderId ? statusLabel(status) : '新单据' }}</span>
      <span class="dh-no">{{ orderNo || defaultTitle }}</span>
      <el-tag v-if="locked" type="danger" size="small">已锁定</el-tag>
      <span class="dh-spacer" />
      <slot name="actions" />
    </div>

    <!-- 行2：表头字段区（下划线填写风格） -->
    <div class="dh-fields">
      <slot name="fields" />
    </div>

    <!-- 行3：备注 -->
    <div class="dh-remark">
      <span class="dh-label">备注</span>
      <el-input :model-value="remark" @update:model-value="$emit('update:remark', $event)" placeholder="可选" size="small" style="flex:1" :disabled="readonly || locked" clearable />
      <el-checkbox :model-value="reserveInventory" @update:model-value="$emit('update:reserveInventory', $event)" :disabled="readonly || locked">占用库存</el-checkbox>
      <slot name="remarkExtra" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  orderId: number
  orderNo: string
  status: string
  orderDate: string
  locked?: boolean
  readonly?: boolean
  partnerId: number
  partnerLabel: string
  partners: any[]
  remark: string
  reserveInventory: boolean
  upstreamDoc?: { id: number; orderNo: string } | null
  defaultTitle?: string
}>()

defineEmits<{
  'update:partnerId': [v: number]
  'update:remark': [v: string]
  'update:reserveInventory': [v: boolean]
  partnerChange: []
  openUpstream: [id: number]
}>()

const statusLabel = (s: string) => ({ draft: '草稿', pending: '待确认', confirmed: '已确认', completed: '已完成' }[s] || s)
</script>

<style scoped>
.dh-root {
  flex-shrink: 0;
  background: var(--bg-muted, #f2f3f5);
  border-bottom: 2px solid var(--border-color, #e3e8ee);
  padding: 12px 24px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dh-topbar { display: flex; align-items: center; gap: 10px; }
.dh-spacer { flex: 1; }
.dh-status { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 3px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.dh-status--draft     { background: #e5edf5; color: #64748d; }
.dh-status--pending   { background: #fef3c7; color: #9b6829; }
.dh-status--confirmed { background: rgba(83,58,253,0.08); color: #533afd; }
.dh-status--completed { background: rgba(21,190,83,0.12); color: #108c3d; }
.dh-no { font-family: 'SF Mono','JetBrains Mono',monospace; font-size: 15px; color: #273951; }

/* 字段区容器 */
.dh-fields { display: flex; flex-direction: column; gap: 10px; }

/* 标签 */
.dh-label { font-size: 12px; color: var(--color-text-muted, #8898aa); white-space: nowrap; }

/* 备注行 */
.dh-remark { display: flex; align-items: center; gap: 10px; }
.dh-remark > .dh-label { flex-shrink: 0; }
</style>
