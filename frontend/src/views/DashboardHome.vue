<template>
  <div class="dashboard-home">
    <div class="welcome-section">
      <h1 class="text-display">
        欢迎使用结算系统
      </h1>
      <p class="text-h3-light">
        工资核算 · 进销存 · 一体化管理
      </p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">员工总数</span>
          <el-icon class="stat-icon">
            <User />
          </el-icon>
        </div>
        <div class="stat-value">
          {{ stats.employeeCount }}
        </div>
        <div
          class="stat-trend"
          :class="stats.employeeTrend >= 0 ? 'positive' : 'negative'"
        >
          <el-icon><TrendCharts /></el-icon>
          <span>较上月 {{ stats.employeeTrend >= 0 ? '+' : '' }}{{ stats.employeeTrend }}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">本月报工</span>
          <el-icon class="stat-icon">
            <Document />
          </el-icon>
        </div>
        <div class="stat-value">
          {{ stats.pieceRecordCount }}
        </div>
        <div
          class="stat-trend"
          :class="stats.pieceRecordTrend >= 0 ? 'positive' : 'negative'"
        >
          <el-icon><TrendCharts /></el-icon>
          <span>较上月 {{ stats.pieceRecordTrend >= 0 ? '+' : '' }}{{ stats.pieceRecordTrend }}%</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">本月工资</span>
          <el-icon class="stat-icon">
            <Money />
          </el-icon>
        </div>
        <div class="stat-value">
          ¥{{ formatMoney(stats.currentSalary) }}
        </div>
        <div
          class="stat-trend"
          :class="stats.currentSalary >= stats.lastSalary ? 'positive' : 'negative'"
        >
          <el-icon><TrendCharts /></el-icon>
          <span>较上月 {{ formatSalaryTrend() }}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">库存预警</span>
          <el-icon
            class="stat-icon"
            :class="{ warning: stats.lowStockCount > 0 }"
          >
            <Warning />
          </el-icon>
        </div>
        <div class="stat-value">
          {{ stats.lowStockCount }}
        </div>
        <div
          class="stat-trend"
          :class="stats.lowStockCount > 0 ? 'negative' : 'positive'"
        >
          <el-icon><Top /></el-icon>
          <span>{{ stats.lowStockCount > 0 ? '需要及时处理' : '库存充足' }}</span>
        </div>
      </div>
    </div>

    <!-- 操作流程 -->
    <div class="workflow-section">
      <div class="workflow-header">
        <h2 class="text-h3">
          操作流程
        </h2>
        <el-button
          link
          type="primary"
          @click="$router.push('/dashboard/system/settings')"
        >
          自定义流程
        </el-button>
      </div>
      <FlowChart
        :top-row="topRow"
        :left-branch="leftBranch"
        :right-branch="rightBranch"
        :bottom-row="bottomRow"
        :statuses="flowStatus"
      />
    </div>

    <div class="quick-actions">
      <div class="quick-actions-header">
        <h2 class="text-h3">
          快速操作
        </h2>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  User, Document, Money, Warning, TrendCharts, Top,
  Edit, Box, Search, Setting, ShoppingCart, DataAnalysis, List,
  Download, Upload
} from '@element-plus/icons-vue'
import { workflowApi, type QuickAction, type FlowStepStatus } from '@/api/workflow'
import { api } from '@/api/request'
import { FlowChart, type FlowRowNode, type FlowNodeData } from '@/components/flow-chart'

const router = useRouter()
const quickActions = ref<QuickAction[]>([])
const flowStatus = ref<Record<string, FlowStepStatus>>({})

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

const makeRowNode = (id: string): FlowRowNode => {
  const node = flowNodes.find(n => n.id === id)!
  return { node, icon: nodeIconMap[id] }
}

const topRow = computed<FlowRowNode[]>(() =>
  flowNodes.slice(0, 5).map(n => ({ node: n, icon: nodeIconMap[n.id] }))
)

const leftBranch = computed<FlowRowNode[]>(() => [
  makeRowNode('purchaseInbound'),
  makeRowNode('materialOutbound')
])

const rightBranch = computed<FlowRowNode[]>(() => [
  makeRowNode('finishedGoods')
])

const bottomRow = computed<FlowRowNode[]>(() =>
  flowNodes.slice(7, 10).map(n => ({ node: n, icon: nodeIconMap[n.id] }))
)

// ── 统计数据 ──
const stats = reactive({
  employeeCount: 0,
  employeeTrend: 0,
  pieceRecordCount: 0,
  pieceRecordTrend: 0,
  currentSalary: 0,
  lastSalary: 0,
  lowStockCount: 0
})

const formatMoney = (v: number) => {
  if (v === 0) return '0'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const formatSalaryTrend = () => {
  if (stats.lastSalary === 0) return stats.currentSalary > 0 ? '+100%' : '持平'
  const pct = ((stats.currentSalary - stats.lastSalary) / stats.lastSalary * 100).toFixed(0)
  return `${Number(pct) >= 0 ? '+' : ''}${pct}%`
}

// ── 生命周期 ──
onMounted(async () => {
  try { quickActions.value = await workflowApi.getQuickActions() } catch {}
  try { flowStatus.value = await workflowApi.getFlowStatus() } catch {}
  try {
    const data = await api.get<typeof stats>('/dashboard/stats')
    Object.assign(stats, data)
  } catch { /* empty */ }
})
</script>

<style scoped>
.dashboard-home {
  padding: 0;
}

.welcome-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #ff6b6b 100%);
  padding: var(--space-14) var(--space-8);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-8);
  text-align: center;
  color: var(--color-white);
}

.welcome-section h1 {
  font-weight: var(--font-weight-700);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-display);
  margin-bottom: var(--space-4);
}

.welcome-section p {
  font-weight: var(--font-weight-340);
  line-height: var(--line-subheading);
  letter-spacing: var(--letter-subheading);
  opacity: 0.9;
}

/* ── Stats Grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.stat-card {
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.stat-label {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-450);
  letter-spacing: var(--letter-body);
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.stat-icon {
  width: 24px;
  height: 24px;
  color: var(--el-text-color-secondary);
}

.stat-icon.warning {
  color: var(--color-warning);
}

.stat-value {
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-700);
  line-height: var(--line-heading);
  letter-spacing: var(--letter-heading);
  color: var(--color-black);
  margin-bottom: var(--space-3);
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-330);
}

.stat-trend.positive { color: var(--color-success); }
.stat-trend.negative { color: var(--color-warning); }

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
  .welcome-section {
    padding: var(--space-10) var(--space-6);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
