<template>
  <el-popover
    :visible="popoverVisible"
    placement="bottom"
    :width="240"
    trigger="click"
  >
    <template #reference>
      <a
        class="flow-node"
        :class="`flow-node--${status}`"
        :href="node.link"
        @click.prevent="$emit('toggle-popover', node.id)"
      >
        <span v-if="step" class="flow-node__step">{{ step }}</span>
        <span v-if="icon" class="flow-node__icon">
          <el-icon :size="18"><component :is="icon" /></el-icon>
        </span>
        <span class="flow-node__text">{{ node.title }}</span>
        <span class="flow-node__dot" />
      </a>
    </template>
    <div class="flow-detail">
      <div class="flow-detail__title">{{ node.title }}</div>
      <div class="flow-detail__meta">
        <span>数据量：</span>
        <b>{{ popoverData?.count ?? 0 }}</b>
      </div>
      <div v-if="popoverData?.latest" class="flow-detail__meta">
        <span>最近更新：</span>
        <span>{{ formatDate(popoverData.latest) }}</span>
      </div>
      <el-button
        type="primary"
        size="small"
        style="width: 100%; margin-top: 8px"
        @click="$emit('navigate', node.link)"
      >
        前往处理
      </el-button>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import type { FlowNodeData } from './types'

defineProps<{
  node: FlowNodeData
  status?: string
  step?: number
  icon?: Component
  popoverVisible?: boolean
  popoverData?: { count: number; latest?: string }
}>()

defineEmits<{
  'toggle-popover': [id: string]
  'navigate': [link: string]
}>()

const formatDate = (val: string): string => {
  if (!val) return '-'
  try { return new Date(val).toLocaleDateString('zh-CN') } catch { return val }
}
</script>

<style scoped>
.flow-node {
  display: flex;
  align-items: center;
  width: 180px;
  height: 56px;
  padding: 0 var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  text-decoration: none;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  transition: all var(--transition-base);
  gap: var(--space-2);
}

/* 状态叠加层 */
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

/* ── 状态变体 ── */
.flow-node--pending {
  background: var(--bg-muted);
  border-color: var(--border-color);
}

.flow-node--active {
  background: var(--bg-surface);
  border-color: var(--color-primary);
}

.flow-node--active::before {
  background: var(--color-primary);
  opacity: 0.06;
}

.flow-node--completed {
  background: var(--bg-surface);
  border-color: var(--color-success);
}

.flow-node--completed::before {
  background: var(--color-success);
  opacity: 0.06;
}

/* ── 步骤编号徽章 ── */
.flow-node__step {
  position: absolute;
  top: -1px;
  left: -1px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  background: var(--color-primary);
  color: var(--color-primary-text);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-600);
  line-height: 20px;
  text-align: center;
  z-index: 1;
}

/* ── 图标 ── */
.flow-node__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.flow-node--active .flow-node__icon {
  color: var(--color-primary);
}

.flow-node--completed .flow-node__icon {
  color: var(--color-success);
}

/* ── 文字 ── */
.flow-node__text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-500);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

/* ── 状态圆点 ── */
.flow-node__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-circle);
  flex-shrink: 0;
  transition: all var(--transition-base);
}

.flow-node--pending .flow-node__dot {
  background: var(--border-color);
}

.flow-node--active .flow-node__dot {
  background: var(--color-primary);
  filter: drop-shadow(0 0 4px currentColor);
}

.flow-node--completed .flow-node__dot {
  background: var(--color-success);
  filter: drop-shadow(0 0 4px currentColor);
}

/* ── Popover 内容 ── */
.flow-detail__title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-600);
  margin-bottom: 6px;
  color: var(--color-text-primary);
}

.flow-detail__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.flow-detail__meta b {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-600);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .flow-node {
    width: 100%;
  }
}
</style>
