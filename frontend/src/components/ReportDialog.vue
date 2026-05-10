<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="title"
    width="960px"
    top="5vh"
    destroy-on-close
  >
    <div v-loading="loading" class="report-body">
      <!-- 日期范围筛选 -->
      <div class="report-filter" v-if="reportType !== 'inventory'">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 320px"
          @change="loadData"
        />
      </div>

      <!-- 汇总卡片 -->
      <div class="summary-row" v-if="summary">
        <div class="summary-item" v-if="summary.totalAmount !== undefined">
          <span class="summary-label">总金额</span>
          <span class="summary-value">¥{{ formatNum(summary.totalAmount) }}</span>
        </div>
        <div class="summary-item" v-if="summary.totalOrders !== undefined">
          <span class="summary-label">订单数</span>
          <span class="summary-value">{{ summary.totalOrders }}</span>
        </div>
        <div class="summary-item" v-if="summary.totalMaterials !== undefined">
          <span class="summary-label">物料总数</span>
          <span class="summary-value">{{ summary.totalMaterials }}</span>
        </div>
        <div class="summary-item" v-if="summary.normalCount !== undefined">
          <span class="summary-label">正常</span>
          <span class="summary-value" style="color: var(--color-success)">{{ summary.normalCount }}</span>
        </div>
        <div class="summary-item" v-if="summary.lowStockCount !== undefined">
          <span class="summary-label">偏低</span>
          <span class="summary-value" style="color: var(--color-warning)">{{ summary.lowStockCount }}</span>
        </div>
        <div class="summary-item" v-if="summary.emptyStockCount !== undefined">
          <span class="summary-label">缺货</span>
          <span class="summary-value" style="color: var(--color-danger)">{{ summary.emptyStockCount }}</span>
        </div>
        <div class="summary-item" v-if="summary.totalHourly !== undefined">
          <span class="summary-label">计时工资</span>
          <span class="summary-value">¥{{ formatNum(summary.totalHourly) }}</span>
        </div>
        <div class="summary-item" v-if="summary.totalPiece !== undefined">
          <span class="summary-label">计件工资</span>
          <span class="summary-value">¥{{ formatNum(summary.totalPiece) }}</span>
        </div>
      </div>

      <!-- 图表区域 -->
      <div class="chart-grid" v-if="hasData">
        <!-- 采购报表 -->
        <template v-if="reportType === 'purchase'">
          <div class="chart-cell">
            <ReportCharts type="line" :data="trend" title="月度采购趋势" x-field="month" y-field="total" />
          </div>
          <div class="chart-cell">
            <ReportCharts type="pie" :data="breakdown" title="供应商采购占比" />
          </div>
          <div class="chart-cell">
            <ReportCharts type="ring" :data="statusDistribution" title="采购状态分布" />
          </div>
        </template>

        <!-- 销售报表 -->
        <template v-if="reportType === 'sales'">
          <div class="chart-cell">
            <ReportCharts type="line" :data="trend" title="月度销售趋势" x-field="month" y-field="total" />
          </div>
          <div class="chart-cell">
            <ReportCharts type="pie" :data="breakdown" title="客户销售占比" />
          </div>
          <div class="chart-cell" style="grid-column: 1 / -1">
            <ReportCharts type="horizontal-bar" :data="productRanking" title="产品销售排行" x-field="name" y-field="amount" :height="300" />
          </div>
        </template>

        <!-- 库存报表 -->
        <template v-if="reportType === 'inventory'">
          <div class="chart-cell">
            <ReportCharts type="bar" :data="categoryOverview" title="各分类库存总览" x-field="name" y-field="totalQuantity" />
          </div>
          <div class="chart-cell">
            <ReportCharts type="ring" :data="statusDistribution" title="库存状态分布" />
          </div>
          <div class="chart-cell" style="grid-column: 1 / -1">
            <ReportCharts type="line" :data="movementTrend" title="出入库趋势" x-field="month" y-field="inflow" :height="260" />
          </div>
        </template>

        <!-- 工资报表 -->
        <template v-if="reportType === 'salary'">
          <div class="chart-cell">
            <ReportCharts type="line" :data="trend" title="月度工资趋势" x-field="period" y-field="total" />
          </div>
          <div class="chart-cell">
            <ReportCharts type="pie" :data="breakdown" title="部门工资占比" />
          </div>
          <div class="chart-cell" style="grid-column: 1 / -1">
            <ReportCharts type="bar" :data="trend" title="计时/计件构成" x-field="period" :height="260" />
          </div>
        </template>
      </div>

      <el-empty v-else-if="!loading" description="暂无数据" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ReportCharts from './ReportCharts.vue'
import { reportApi, type ReportSummary } from '@/api/report'

const props = defineProps<{
  modelValue: boolean
  reportType: 'purchase' | 'sales' | 'inventory' | 'salary'
  title: string
}>()

defineEmits<{ 'update:modelValue': [val: boolean] }>()

const loading = ref(false)
const dateRange = ref<[string, string] | null>(null)

const trend = ref<any[]>([])
const breakdown = ref<any[]>([])
const statusDistribution = ref<any[]>([])
const productRanking = ref<any[]>([])
const categoryOverview = ref<any[]>([])
const movementTrend = ref<any[]>([])
const summary = ref<ReportSummary>({})

const hasData = computed(() => {
  return trend.value.length > 0 || breakdown.value.length > 0 ||
    categoryOverview.value.length > 0 || statusDistribution.value.length > 0
})

const formatNum = (v: number) => v?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'

const resetData = () => {
  trend.value = []
  breakdown.value = []
  statusDistribution.value = []
  productRanking.value = []
  categoryOverview.value = []
  movementTrend.value = []
  summary.value = {}
}

const loadData = async () => {
  loading.value = true
  resetData()
  try {
    const params = dateRange.value
      ? { startDate: dateRange.value[0], endDate: dateRange.value[1] }
      : undefined

    if (props.reportType === 'purchase') {
      const data = await reportApi.getPurchase(params)
      trend.value = data.trend
      breakdown.value = data.breakdown
      statusDistribution.value = data.statusDistribution
      summary.value = data.summary
    } else if (props.reportType === 'sales') {
      const data = await reportApi.getSales(params)
      trend.value = data.trend
      breakdown.value = data.breakdown
      productRanking.value = data.productRanking
      summary.value = data.summary
    } else if (props.reportType === 'inventory') {
      const data = await reportApi.getInventory()
      categoryOverview.value = data.categoryOverview
      movementTrend.value = data.movementTrend
      statusDistribution.value = data.statusDistribution
      summary.value = data.summary
    } else if (props.reportType === 'salary') {
      const data = await reportApi.getSalary(params)
      trend.value = data.trend
      breakdown.value = data.breakdown
      summary.value = data.summary
    }
  } catch {
    // 错误由 request.ts 拦截器处理
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (val) => {
  if (val) loadData()
})
</script>

<style scoped>
.report-body {
  min-height: 400px;
}
.report-filter {
  margin-bottom: var(--space-4);
}
.summary-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  min-width: 100px;
}
.summary-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.summary-value {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-700);
  color: var(--color-text-primary);
}
.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.chart-cell {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
</style>
