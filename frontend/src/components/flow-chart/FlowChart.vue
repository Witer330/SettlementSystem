<template>
  <div class="flow-chart-wrapper">
    <div class="flow-chart">
      <!-- 顶部水平行 -->
      <div class="flow-chart__row">
        <template v-for="item in topRowItems" :key="item.key">
          <FlowNode
            v-if="item.type === 'node' && item.node"
            :node="item.node"
            :status="getStatus(item.node)"
            :step="getStep(item.node)"
            :icon="item.icon"
            :popover-visible="activePopover === item.node.id"
            :popover-data="getPopoverData(item.node)"
            @toggle-popover="togglePopover"
            @navigate="navigateTo"
          />
          <FlowConnector v-else direction="right" />
        </template>
      </div>

      <!-- 左侧分支 -->
      <div class="flow-chart__branch flow-chart__branch--left">
        <span class="flow-chart__vline" />
        <FlowNode
          :node="leftBranch[0].node"
          :status="getStatus(leftBranch[0].node)"
          :step="getStep(leftBranch[0].node)"
          :icon="leftBranch[0].icon"
          :popover-visible="activePopover === leftBranch[0].node.id"
          :popover-data="getPopoverData(leftBranch[0].node)"
          @toggle-popover="togglePopover"
          @navigate="navigateTo"
        />
        <span class="flow-chart__vline" />
        <FlowNode
          :node="leftBranch[1].node"
          :status="getStatus(leftBranch[1].node)"
          :step="getStep(leftBranch[1].node)"
          :icon="leftBranch[1].icon"
          :popover-visible="activePopover === leftBranch[1].node.id"
          :popover-data="getPopoverData(leftBranch[1].node)"
          @toggle-popover="togglePopover"
          @navigate="navigateTo"
        />
      </div>

      <!-- 右侧分支 -->
      <div class="flow-chart__branch flow-chart__branch--right">
        <span class="flow-chart__vline" />
        <FlowNode
          :node="rightBranch[0].node"
          :status="getStatus(rightBranch[0].node)"
          :step="getStep(rightBranch[0].node)"
          :icon="rightBranch[0].icon"
          :popover-visible="activePopover === rightBranch[0].node.id"
          :popover-data="getPopoverData(rightBranch[0].node)"
          @toggle-popover="togglePopover"
          @navigate="navigateTo"
        />
      </div>

      <!-- 底部水平行 -->
      <div class="flow-chart__row flow-chart__row--bottom">
        <template v-for="item in bottomRowItems" :key="item.key">
          <FlowNode
            v-if="item.type === 'node' && item.node"
            :node="item.node"
            :status="getStatus(item.node)"
            :step="getStep(item.node)"
            :icon="item.icon"
            :popover-visible="activePopover === item.node.id"
            :popover-data="getPopoverData(item.node)"
            @toggle-popover="togglePopover"
            @navigate="navigateTo"
          />
          <FlowConnector v-else direction="right" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import FlowNode from './FlowNode.vue'
import FlowConnector from './FlowConnector.vue'
import type { FlowRowNode, FlowNodeStatusInfo } from './types'

const props = defineProps<{
  topRow: FlowRowNode[]
  leftBranch: FlowRowNode[]
  rightBranch: FlowRowNode[]
  bottomRow: FlowRowNode[]
  statuses: Record<string, FlowNodeStatusInfo>
}>()

const activePopover = ref<string | null>(null)

interface InterleavedNode {
  type: 'node'
  key: string
  node: FlowRowNode['node']
  icon: FlowRowNode['icon']
}

interface InterleavedConnector {
  type: 'connector'
  key: string
}

type InterleavedItem = InterleavedNode | InterleavedConnector

function interleave(nodes: FlowRowNode[], prefix: string): InterleavedItem[] {
  const result: InterleavedItem[] = []
  nodes.forEach((item, i) => {
    result.push({ type: 'node', key: item.node.id, node: item.node, icon: item.icon })
    if (i < nodes.length - 1) {
      result.push({ type: 'connector', key: `${prefix}-c-${i}` })
    }
  })
  return result
}

const topRowItems = computed(() => interleave(props.topRow, 'top'))
const bottomRowItems = computed(() => interleave(props.bottomRow, 'bot'))

// 所有节点按顺序编号
const allNodes = computed(() => [
  ...props.topRow.map(n => n.node),
  ...props.leftBranch.map(n => n.node),
  ...props.rightBranch.map(n => n.node),
  ...props.bottomRow.map(n => n.node)
])

const getStep = (node: { id: string }): number => {
  return allNodes.value.findIndex(n => n.id === node.id) + 1
}

const getStatus = (node: { statusKey: string }): string => {
  return props.statuses[node.statusKey]?.status ?? 'pending'
}

const getPopoverData = (node: { statusKey: string }) => {
  return props.statuses[node.statusKey]
}

const togglePopover = (id: string) => {
  activePopover.value = activePopover.value === id ? null : id
}

const navigateTo = (link: string) => {
  window.location.href = link
}
</script>

<style scoped>
.flow-chart-wrapper {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.flow-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 860px;
}

.flow-chart__row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.flow-chart__row--bottom {
  margin-left: 60px;
}

.flow-chart__branch {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.flow-chart__branch--left {
  margin-left: calc(50% - 310px);
}

.flow-chart__branch--right {
  margin-left: calc(50% + 260px);
}

.flow-chart__vline {
  width: 2px;
  height: 20px;
  background: var(--border-color);
  flex-shrink: 0;
  transition: background var(--transition-base);
}

/* ── 平板适配 ── */
@media (max-width: 1023px) and (min-width: 768px) {
  .flow-chart__branch--left {
    margin-left: calc(50% - 260px);
  }

  .flow-chart__branch--right {
    margin-left: calc(50% + 200px);
  }

  .flow-chart__row--bottom {
    margin-left: 40px;
  }

  .flow-chart__vline {
    height: 16px;
  }
}

/* ── 移动端适配 ── */
@media (max-width: 767px) {
  .flow-chart {
    min-width: 0;
    align-items: stretch;
  }

  .flow-chart__row {
    flex-direction: column;
    gap: 0;
  }

  .flow-chart__row--bottom {
    margin-left: 0;
  }

  .flow-chart__branch--left,
  .flow-chart__branch--right {
    margin-left: 0;
  }
}
</style>
