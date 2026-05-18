<template>
  <div class="dashboard-home">
    <!-- 1. 问候栏 -->
    <div class="greeting-bar">
      <span class="greeting-text">{{ greeting }}，{{ userName }}</span>
      <span class="greeting-date">{{ todayLabel }}</span>
    </div>

    <!-- 2. KPI 卡片 -->
    <DashboardKpiCards :stats="stats" />

    <!-- 3. 经营分析图表 -->
    <DashboardCharts />

    <!-- 4. 操作流程 -->
    <div class="workflow-section">
      <div class="workflow-header">
        <h2 class="text-h3">操作流程</h2>
        <el-button
          link
          type="primary"
          @click="$router.push('/dashboard/system/settings')"
        >
          自定义流程
        </el-button>
      </div>
      <FlowChart
        :flow-nodes="flowNodes"
        :node-icons="nodeIconMap"
        :statuses="flowStatus"
        :todo-counts="todoCounts"
        @navigate="handleFlowNavigate"
      />
    </div>

    <!-- 5. 快速操作 -->
    <div class="quick-actions">
      <div class="quick-actions-header">
        <h2 class="text-h3">快速操作</h2>
        <el-button
          link
          type="primary"
          @click="$router.push('/dashboard/system/settings')"
        >
          自定义入口
        </el-button>
      </div>
      <div class="actions-grid">
        <el-button
          v-for="action in quickActions"
          :key="action.id"
          class="action-card"
          @click="router.push(action.link)"
        >
          <el-icon class="action-icon">
            <component :is="iconMap[action.icon] || Setting" />
          </el-icon>
          <span>{{ action.title }}</span>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  User, Document, Money, Warning, TrendCharts, Top,
  Edit, Box, Search, Setting, ShoppingCart, DataAnalysis, List,
  Download, Upload
} from '@element-plus/icons-vue'
import { workflowApi, type QuickAction, type FlowStepStatus } from '@/api/workflow'
import { api } from '@/api/request'
import { FlowChart, type FlowNodeData } from '@/components/flow-chart'
import { useUserStore } from '@/stores/user'
import DashboardKpiCards from '@/components/DashboardKpiCards.vue'
import type { DashboardStats } from '@/components/DashboardKpiCards.vue'
import DashboardCharts from '@/components/DashboardCharts.vue'

const router = useRouter()
const userStore = useUserStore()
const quickActions = ref<QuickAction[]>([])
const flowStatus = ref<Record<string, FlowStepStatus>>({})

// ── 问候语 ──
const userName = userStore.userInfo?.name || userStore.userInfo?.username || '管理员'
const hour = new Date().getHours()
const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
const todayLabel = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
})

// ── 待办数量 ──
const todoCounts = ref<Record<string, number>>({})

const nodeQueryParams: Record<string, Record<string, string>> = {
  salesOrder: { status: 'draft' },
  purchaseSuggest: { status: 'pending' },
  purchaseInbound: { status: 'confirmed' },
  materialPickup: { status: 'confirmed' },
  production: {},
  finishedGoods: { status: 'pending' },
  materialOutbound: { type: 'out' },
  bom: {},
  materialReq: {},
  stockCompare: { lowStock: '1' },
  finishedGoodsInbound: {}
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let isMounted = false

const iconMap: Record<string, typeof User> = {
  User, Document, Money, Warning, TrendCharts, Top, Edit, Box, Search,
  Setting, ShoppingCart, DataAnalysis, List, Download, Upload
}

// ── 流程节点定义 ──
const flowNodes: FlowNodeData[] = [
  { id: 'salesOrder', title: '销售下单', link: '/dashboard/inventory/sales-orders', statusKey: 'salesOrders' },
  { id: 'bom', title: 'BOM展开', link: '/dashboard/basic-info/bom', statusKey: 'bom' },
  { id: 'materialReq', title: '物料需求', link: '/dashboard/inventory/material-requirements', statusKey: 'salesOrders' },
  { id: 'stockCompare', title: '库存对比', link: '/dashboard/inventory/inventory-query', statusKey: 'inventory' },
  { id: 'purchaseSuggest', title: '采购建议', link: '/dashboard/inventory/purchase-orders', statusKey: 'purchaseOrders' },
  { id: 'purchaseInbound', title: '采购入库', link: '/dashboard/inventory/purchase-orders', statusKey: 'purchaseOrders' },
  { id: 'materialOutbound', title: '原材料出库', link: '/dashboard/inventory/materials', statusKey: 'inventory' },
  { id: 'materialPickup', title: '生产领料', link: '/dashboard/inventory/materials', statusKey: 'inventory' },
  { id: 'production', title: '加工生产', link: '/dashboard/salary/daily-records', statusKey: 'dailyRecords' },
  { id: 'finishedGoodsInbound', title: '成品入库', link: '/dashboard/inventory/inventory-query', statusKey: 'inventory' },
  { id: 'finishedGoods', title: '成品出库（发货）', link: '/dashboard/inventory/sales-orders', statusKey: 'salesOrders' }
]

const nodeIconMap: Record<string, typeof User> = {
  salesOrder: ShoppingCart,
  bom: Document,
  materialReq: DataAnalysis,
  stockCompare: Search,
  purchaseSuggest: List,
  purchaseInbound: Box,
  materialOutbound: Download,
  materialPickup: Edit,
  production: Setting,
  finishedGoodsInbound: Upload,
  finishedGoods: Top
}

// ── 统计数据 ──
const stats = reactive<DashboardStats>({
  currentMonthSales: 0,
  lastMonthSales: 0,
  currentMonthPurchase: 0,
  lastMonthPurchase: 0,
  receivableAmount: 0,
  payableAmount: 0,
  lowStockCount: 0
})

// ── 流程图导航处理 ──
function handleFlowNavigate(nodeId: string, link: string) {
  const query = nodeQueryParams[nodeId]
  if (query && Object.keys(query).length > 0) {
    router.push({ path: link, query })
  } else {
    router.push(link)
  }
}

// ── 待办轮询 ──
async function pollTodoCounts() {
  if (!isMounted) return
  try {
    const [draftSO, pendingPO, confirmedPO] = await Promise.all([
      api.get<{ total: number }>('/sales-orders', { params: { page: 1, pageSize: 1, status: 'draft' } }),
      api.get<{ total: number }>('/purchase-orders', { params: { page: 1, pageSize: 1, status: 'pending' } }),
      api.get<{ total: number }>('/purchase-orders', { params: { page: 1, pageSize: 1, status: 'confirmed' } })
    ])
    todoCounts.value = {
      salesOrder: draftSO.total,
      purchaseSuggest: pendingPO.total,
      purchaseInbound: confirmedPO.total,
      materialOutbound: 0,
      materialPickup: 0,
      production: 0,
      finishedGoodsInbound: 0,
      finishedGoods: 0,
      bom: 0,
      materialReq: 0,
      stockCompare: 0
    }
  } catch { /* 静默失败 */ }
}

// ── 生命周期 ──
onMounted(async () => {
  isMounted = true
  try { quickActions.value = await workflowApi.getQuickActions() } catch {}
  try { flowStatus.value = await workflowApi.getFlowStatus() } catch {}
  try {
    const data = await api.get<DashboardStats>('/dashboard/stats')
    Object.assign(stats, data)
  } catch { /* empty */ }
  pollTodoCounts()
  pollTimer = setInterval(pollTodoCounts, 5000)
})

onUnmounted(() => {
  isMounted = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.dashboard-home {
  padding: 0;
}

/* ── 问候栏 ── */
.greeting-bar {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-6);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--el-border-color-light);
}

.greeting-text {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-700);
  letter-spacing: var(--letter-body);
}

.greeting-date {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-330);
  color: var(--el-text-color-secondary);
}

/* ── Workflow Section ── */
.workflow-section {
  margin-bottom: var(--space-8);
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.workflow-header h2 {
  font-weight: var(--font-weight-450);
  line-height: var(--line-subheading);
  letter-spacing: var(--letter-subheading);
  margin: 0;
}

/* ── Quick Actions ── */
.quick-actions {
  margin-top: var(--space-8);
}

.quick-actions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.quick-actions-header h2 {
  font-weight: var(--font-weight-450);
  line-height: var(--line-subheading);
  letter-spacing: var(--letter-subheading);
  margin: 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.action-card {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 140px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--el-border-color);
}

.action-card:hover {
  box-shadow: var(--shadow-md);
  background-color: var(--glass-dark);
}

.action-icon {
  width: 40px;
  height: 40px;
  color: var(--el-color-primary);
}

.action-card span {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-330);
  letter-spacing: var(--letter-body);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .greeting-bar {
    flex-direction: column;
    gap: var(--space-2);
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
