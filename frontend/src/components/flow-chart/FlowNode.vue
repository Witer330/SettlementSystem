<template>
  <div class="flow-node-wrap">
    <Handle id="left"   type="target" :position="Position.Left"   class="flow-handle" />
    <Handle id="top"    type="target" :position="Position.Top"    class="flow-handle" />
    <Handle id="right"  type="source" :position="Position.Right"  class="flow-handle" />
    <Handle id="bottom" type="source" :position="Position.Bottom" class="flow-handle" />

    <el-popover
      :visible="popoverVisible"
      placement="bottom"
      :width="240"
      trigger="click"
      :popper-options="{ strategy: 'fixed' }"
    >
      <template #reference>
        <el-badge :value="data.todoCount" :hidden="data.todoCount === 0" class="flow-node-badge">
          <a
            class="flow-node"
            :class="[`flow-node--${data.status}`, { 'flow-node--has-todo': data.todoCount > 0 }]"
            @click.prevent="$emit('toggle-popover', nodeId)"
          >
            <span v-if="data.step" class="flow-node__step">{{ data.step }}</span>
            <span v-if="data.icon" class="flow-node__icon">
              <el-icon :size="16"><component :is="data.icon" /></el-icon>
            </span>
            <span class="flow-node__text">{{ data.node.title }}</span>
            <span class="flow-node__dot" />
          </a>
        </el-badge>
      </template>
      <div class="flow-detail">
        <div class="flow-detail__title">{{ data.node.title }}</div>
        <div class="flow-detail__meta">
          <span>待办数：</span><b>{{ data.todoCount }}</b>
        </div>
        <div class="flow-detail__meta">
          <span>数据量：</span><b>{{ data.statusInfo?.count ?? 0 }}</b>
        </div>
        <div v-if="data.statusInfo?.latest" class="flow-detail__meta">
          <span>最近更新：</span>
          <span>{{ formatDate(data.statusInfo.latest) }}</span>
        </div>
        <el-button type="primary" size="small" style="width:100%;margin-top:8px" @click="$emit('navigate', nodeId)">
          {{ data.todoCount > 0 ? `处理 ${data.todoCount} 条待办` : '前往查看' }}
        </el-button>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  nodeId: string
  data: {
    node: { id: string; title: string; link: string }
    step: number
    status: string
    statusInfo?: { count: number; latest?: string }
    icon?: any
    todoCount: number
  }
  popoverVisible?: boolean
  popoverData?: { count: number; latest?: string }
}>()

defineEmits<{
  'toggle-popover': [id: string]
  'navigate': [nodeId: string]
}>()

const formatDate = (val: string): string => {
  if (!val) return '-'
  try { return new Date(val).toLocaleDateString('zh-CN') } catch { return val }
}
</script>

<style scoped>
.flow-node-wrap {
  position: relative;
  width: 180px;
  height: 50px;
}

/* 锚点默认隐藏，hover 节点时显示 */
.flow-handle {
  width: 7px !important;
  height: 7px !important;
  background: var(--color-primary, #6366f1) !important;
  border: 2px solid var(--bg-surface, #fff) !important;
  border-radius: 50% !important;
  opacity: 0;
  transition: opacity 0.15s;
}
.flow-node-wrap:hover .flow-handle {
  opacity: 1;
}

.flow-node-badge {
  display: inline-flex;
  flex-shrink: 0;
  line-height: 1;
}
.flow-node-badge :deep(.el-badge__content) {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 4;
}

.flow-node {
  display: flex;
  align-items: center;
  width: 180px;
  height: 50px;
  padding: 0 var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  text-decoration: none;
  position: relative;
  overflow: visible;
  flex-shrink: 0;
  transition: all var(--transition-base);
  gap: var(--space-1);
  box-sizing: border-box;
}

.flow-node::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity var(--transition-base);
  border-radius: inherit;
  pointer-events: none;
}

.flow-node:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary);
}
.flow-node:hover .flow-node__icon {
  color: var(--color-primary);
  transform: scale(1.1);
}

/* ── 待办态 ── */
.flow-node--has-todo {
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
}
.flow-node--has-todo:hover {
  transform: scale(1.05);
  border-color: var(--color-warning);
}

/* ── 状态 ── */
.flow-node--pending {
  background: var(--bg-muted);
  border-color: var(--border-color);
  opacity: 0.55;
  filter: grayscale(0.4);
}
.flow-node--active {
  background: var(--bg-surface);
  border-color: var(--color-primary);
  border-width: 2px;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.15);
}
.flow-node--active::before {
  background: var(--color-primary);
  opacity: 0.08;
}
.flow-node--completed {
  background: var(--bg-surface);
  border-color: var(--color-success);
  border-width: 2px;
}
.flow-node--completed::before {
  background: var(--color-success);
  opacity: 0.06;
}

/* ── 步骤编号 ── */
.flow-node__step {
  position: absolute;
  top: -1px;
  left: -1px;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
  z-index: 1;
}

.flow-node__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: all var(--transition-base);
  flex-shrink: 0;
}
.flow-node--active .flow-node__icon    { color: var(--color-primary); }
.flow-node--completed .flow-node__icon { color: var(--color-success); }

.flow-node__text {
  font-size: var(--font-size-xs, 12px);
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.flow-node__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: all var(--transition-base);
}
.flow-node--pending .flow-node__dot   { background: var(--border-color); }
.flow-node--active .flow-node__dot    { background: var(--color-primary); }
.flow-node--completed .flow-node__dot { background: var(--color-success); }

.flow-detail__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text-primary);
}
.flow-detail__meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.flow-detail__meta b {
  color: var(--color-text-primary);
  font-weight: 600;
}
</style>
