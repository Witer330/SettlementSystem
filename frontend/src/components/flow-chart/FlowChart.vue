<template>
  <div class="flow-chart-wrapper">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :default-viewport="{ x: 0, y: 0, zoom: 1 }"
      :min-zoom="0.3"
      :max-zoom="2"
      :nodes-draggable="false"
      fit-view-on-init
      :fit-view-options="{ padding: 0.12, maxZoom: 1.2 }"
    >
      <template #node-custom="nodeProps">
        <FlowNode
          :node-id="nodeProps.id"
          :data="nodeProps.data"
          :popover-visible="activePopover === nodeProps.id"
          :popover-data="getPopoverData(nodeProps.id)"
          @toggle-popover="togglePopover"
          @navigate="navigateTo"
        />
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw } from 'vue'
import { VueFlow, MarkerType } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import FlowNode from './FlowNode.vue'
import type { FlowNodeData, FlowNodeStatusInfo } from './types'

const props = defineProps<{
  flowNodes: FlowNodeData[]
  nodeIcons: Record<string, any>
  statuses: Record<string, FlowNodeStatusInfo>
  todoCounts: Record<string, number>
}>()

const emit = defineEmits<{
  navigate: [nodeId: string, link: string]
}>()

const activePopover = ref<string | null>(null)
const togglePopover = (id: string) => { activePopover.value = activePopover.value === id ? null : id }
const navigateTo = (nodeId: string) => {
  const node = props.flowNodes.find(n => n.id === nodeId)
  if (node) emit('navigate', nodeId, node.link)
}
const getPopoverData = (nodeId: string) => {
  const fn = props.flowNodes.find(n => n.id === nodeId)
  return fn ? props.statuses[fn.statusKey] : undefined
}

// ── 节点位置 ──
// 卡片 180×50, 列间距 190px(Y=50), 行间距 120px
const X = [20, 260, 500, 740, 980]  // 5列, 240px间距
const Y = [50, 170, 290, 410]       // 4行

// 卡片 4,6,7,10 同列 (col4=X[3]=600)
// 卡片 8,9,10 底行 (col2,col3,col4)
const posMap: Record<string, { x: number; y: number }> = {
  salesOrder:           { x: X[0], y: Y[0] },
  bom:                  { x: X[1], y: Y[0] },
  materialReq:          { x: X[2], y: Y[0] },
  stockCompare:         { x: X[3], y: Y[0] },
  purchaseSuggest:      { x: X[4], y: Y[0] },
  purchaseInbound:      { x: X[3], y: Y[1] },
  materialOutbound:     { x: X[3], y: Y[2] },
  finishedGoods:        { x: X[4], y: Y[1] },
  materialPickup:       { x: X[1], y: Y[3] },
  production:           { x: X[2], y: Y[3] },
  finishedGoodsInbound: { x: X[3], y: Y[3] },
}

const nodeStatus = (id: string): string => {
  const fn = props.flowNodes.find(n => n.id === id)
  if (!fn) return 'pending'
  return props.statuses[fn.statusKey]?.status ?? 'pending'
}

const nodes = computed(() => props.flowNodes.map((fn, i) => ({
  id: fn.id,
  type: 'custom',
  position: posMap[fn.id] || { x: 30, y: i * 120 + 50 },
  style: { width: 180, height: 50 },
  data: {
    node: fn,
    step: i + 1,
    status: props.statuses[fn.statusKey]?.status ?? 'pending',
    statusInfo: props.statuses[fn.statusKey],
    icon: markRaw(props.nodeIcons[fn.id]),
    todoCount: props.todoCounts[fn.id] ?? 0,
  },
})))

const edges = computed(() => {
  const tStatus = (id: string) => nodeStatus(id)
  const edge = (
    id: string, s: string, t: string,
    sh: string, th: string,
    label?: string,
  ) => {
    const ts = tStatus(t)
    const strong = ts !== 'pending'
    const c = ts === 'completed' ? 'var(--color-success, #22c55e)' : 'var(--color-primary, #6366f1)'
    return {
      id,
      source: s,
      target: t,
      sourceHandle: sh,
      targetHandle: th,
      type: 'smoothstep',
      animated: true,
      label,
      style: { stroke: c, strokeWidth: strong ? 1.8 : 0.6, opacity: strong ? 1 : 0.15 },
      labelStyle: { fill: 'var(--color-text-muted, #999)', fontSize: 10, fontWeight: 500 },
      markerEnd: strong ? { type: MarkerType.ArrowClosed, color: c, width: 12, height: 12 } : undefined,
    }
  }

  return [
    // ── 顶行主干：1→2→3→4→5 ──
    edge('e-1-2',  'salesOrder',       'bom',               'right', 'left'),
    edge('e-2-3',  'bom',              'materialReq',       'right', 'left'),
    edge('e-3-4',  'materialReq',      'stockCompare',      'right', 'left'),
    edge('e-4-5',  'stockCompare',     'purchaseSuggest',   'right', 'left'),
    // ── 采购分支：4↓6↓7 ──
    edge('e-4-6',  'stockCompare',     'purchaseInbound',   'bottom', 'top'),
    edge('e-6-7',  'purchaseInbound',  'materialOutbound',  'bottom', 'top'),
    // ── 成品出库分支：5↓11 ──
    edge('e-5-11', 'purchaseSuggest',  'finishedGoods',     'bottom', 'top'),
    // ── 7↓10 原料入库 → 成品入库 ──
    edge('e-7-10', 'materialOutbound', 'finishedGoodsInbound', 'bottom', 'top'),
    // ── 底行车间流水线：8→9→10 ──
    edge('e-8-9',  'materialPickup',   'production',        'right', 'left'),
    edge('e-9-10', 'production',       'finishedGoodsInbound', 'right', 'left'),
    // ── 库存充足直达生产：4左 → 8顶 ──
    edge('e-4-8',  'stockCompare',     'materialPickup',    'left',  'top'),
  ]
})
</script>

<style>
.flow-chart-wrapper {
  background: var(--bg-elevated, #1e1e2e);
  border-radius: var(--radius-lg, 8px);
  height: 470px;
}
.flow-chart-wrapper .vue-flow { border-radius: inherit; }
.flow-chart-wrapper .vue-flow__controls { display: none; }
.flow-chart-wrapper .vue-flow__minimap { display: none; }
.flow-chart-wrapper .vue-flow__background { background: var(--bg-elevated, #1e1e2e); }
.flow-chart-wrapper .vue-flow__node { overflow: visible !important; }

/* 连线流动动画 */
.flow-chart-wrapper .vue-flow__edge-path {
  stroke-dasharray: 6 4;
  animation: flow-dash 0.5s linear infinite;
}
@keyframes flow-dash {
  to { stroke-dashoffset: -10; }
}
</style>
