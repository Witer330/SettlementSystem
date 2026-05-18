<template>
  <div class="charts-section">
    <div class="charts-header">
      <h2 class="text-h3">经营分析</h2>
      <el-popover placement="bottom-end" :width="200" trigger="click">
        <template #reference>
          <el-button :icon="Setting" circle size="small" />
        </template>
        <div class="visibility-list">
          <div
            v-for="chart in chartList"
            :key="chart.key"
            class="visibility-item"
          >
            <el-switch
              :model-value="visibility[chart.key]"
              size="small"
              @change="toggleChart(chart.key)"
            />
            <span>{{ chart.title }}</span>
          </div>
        </div>
      </el-popover>
    </div>
    <div class="charts-grid">
      <!-- 销售/采购趋势：双线图 -->
      <div v-if="visibility.salesTrend" class="chart-card">
        <div class="chart-card-header">
          <span class="chart-title">销售/采购趋势</span>
        </div>
        <div class="chart-body">
          <v-chart :option="trendOption" autoresize class="chart-instance" />
        </div>
      </div>

      <!-- 库存状态分布 -->
      <div v-if="visibility.stockStatus" class="chart-card">
        <div class="chart-card-header">
          <span class="chart-title">库存状态分布</span>
        </div>
        <div class="chart-body">
          <ReportCharts
            type="ring"
            :data="stockData"
            :height="220"
            name-field="name"
            value-field="value"
          />
        </div>
      </div>

      <!-- 销售客户 TOP5 -->
      <div v-if="visibility.salesTop5" class="chart-card">
        <div class="chart-card-header">
          <span class="chart-title">销售客户 TOP5</span>
        </div>
        <div class="chart-body">
          <ReportCharts
            type="horizontal-bar"
            :data="salesTop5"
            :height="220"
            x-field="name"
            y-field="value"
          />
        </div>
      </div>

      <!-- 采购供应商 TOP5 -->
      <div v-if="visibility.purchaseTop5" class="chart-card">
        <div class="chart-card-header">
          <span class="chart-title">采购供应商 TOP5</span>
        </div>
        <div class="chart-body">
          <ReportCharts
            type="horizontal-bar"
            :data="purchaseTop5"
            :height="220"
            x-field="name"
            y-field="value"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { Setting } from '@element-plus/icons-vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import ReportCharts from '@/components/ReportCharts.vue'
import { api } from '@/api/request'

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const STORAGE_KEY = 'dashboard_chart_visibility'

interface ChartDef {
  key: string
  title: string
}

const chartList: ChartDef[] = [
  { key: 'salesTrend', title: '销售/采购趋势' },
  { key: 'stockStatus', title: '库存状态分布' },
  { key: 'salesTop5', title: '销售客户 TOP5' },
  { key: 'purchaseTop5', title: '采购供应商 TOP5' }
]

// ── 图表显隐 ──
const defaultVisibility: Record<string, boolean> = {
  salesTrend: true,
  stockStatus: true,
  salesTop5: true,
  purchaseTop5: true
}

function loadVisibility(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...defaultVisibility, ...JSON.parse(saved) }
  } catch { /* ignore */ }
  return { ...defaultVisibility }
}

const visibility = reactive<Record<string, boolean>>(loadVisibility())

function toggleChart(key: string) {
  visibility[key] = !visibility[key]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility))
}

// ── 图表数据 ──
const salesTrendData = ref<{ month: string; total: number }[]>([])
const purchaseTrendData = ref<{ month: string; total: number }[]>([])
const stockData = ref<{ name: string; value: number }[]>([])
const salesTop5 = ref<{ name: string; value: number }[]>([])
const purchaseTop5 = ref<{ name: string; value: number }[]>([])

const COLORS = ['#533afd', '#0cce6b', '#f5a623', '#e25950', '#6366f1', '#14b8a6', '#f97316', '#8b5cf6']

// ── 双线趋势图配置 ──
const trendOption = computed(() => {
  const allMonths = [...new Set([
    ...salesTrendData.value.map(d => d.month),
    ...purchaseTrendData.value.map(d => d.month)
  ])].sort()

  const salesMap = new Map(salesTrendData.value.map(d => [d.month, d.total]))
  const purchaseMap = new Map(purchaseTrendData.value.map(d => [d.month, d.total]))

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售额', '采购额'], bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 60, right: 20, top: 10, bottom: 40 },
    xAxis: {
      type: 'category',
      data: allMonths.map(m => m.slice(5)),
      axisLabel: { fontSize: 11 }
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    color: COLORS,
    series: [
      {
        name: '销售额',
        type: 'line',
        data: allMonths.map(m => salesMap.get(m) || 0),
        smooth: true,
        areaStyle: { opacity: 0.08 },
        symbolSize: 6
      },
      {
        name: '采购额',
        type: 'line',
        data: allMonths.map(m => purchaseMap.get(m) || 0),
        smooth: true,
        areaStyle: { opacity: 0.08 },
        symbolSize: 6
      }
    ]
  }
})

// ── 数据加载 ──
onMounted(async () => {
  try {
    const [sales, purchase, inventory] = await Promise.all([
      api.get<any>('/reports/sales'),
      api.get<any>('/reports/purchase'),
      api.get<any>('/reports/inventory')
    ])

    salesTrendData.value = sales.trend || []
    purchaseTrendData.value = purchase.trend || []
    stockData.value = inventory.statusDistribution || []
    salesTop5.value = (sales.breakdown || []).slice(0, 5)
    purchaseTop5.value = (purchase.breakdown || []).slice(0, 5)
  } catch { /* 静默失败 */ }
})
</script>

<style scoped>
.charts-section {
  margin-bottom: var(--space-8);
}

.charts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.charts-header h2 {
  font-weight: var(--font-weight-450);
  line-height: var(--line-subheading);
  letter-spacing: var(--letter-subheading);
  margin: 0;
}

.visibility-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.visibility-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-body);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6);
}

.chart-card {
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.chart-card:hover {
  box-shadow: var(--shadow-md);
}

.chart-card-header {
  margin-bottom: var(--space-3);
}

.chart-title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-600);
  color: var(--color-text-primary);
}

.chart-body {
  height: 220px;
}

.chart-instance {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
