<template>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-header">
        <span class="kpi-label">本月销售额</span>
        <el-icon class="kpi-icon"><TrendCharts /></el-icon>
      </div>
      <div class="kpi-value">
        <span class="clickable-amount" @click="toggleReveal('sales')">{{ maskAmount(stats.currentMonthSales, { decimals: 0, visible: reveals.sales }) }}</span>
      </div>
      <div class="kpi-trend" :class="salesTrend >= 0 ? 'positive' : 'negative'">
        <el-icon><Top /></el-icon>
        <span>较上月 {{ formatTrend(salesTrend) }}</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-header">
        <span class="kpi-label">本月采购额</span>
        <el-icon class="kpi-icon"><ShoppingCart /></el-icon>
      </div>
      <div class="kpi-value">
        <span class="clickable-amount" @click="toggleReveal('purchase')">{{ maskAmount(stats.currentMonthPurchase, { decimals: 0, visible: reveals.purchase }) }}</span>
      </div>
      <div class="kpi-trend" :class="purchaseTrend >= 0 ? 'positive' : 'negative'">
        <el-icon><Top /></el-icon>
        <span>较上月 {{ formatTrend(purchaseTrend) }}</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-header">
        <span class="kpi-label">应收 / 应付</span>
        <el-icon class="kpi-icon"><Money /></el-icon>
      </div>
      <div class="kpi-value receivable">
        <span class="clickable-amount" @click="toggleReveal('receivable')">{{ maskAmount(stats.receivableAmount - stats.payableAmount, { decimals: 0, visible: reveals.receivable }) }}</span>
      </div>
      <div class="kpi-detail">
        <span>应收 <em class="clickable-amount" @click="toggleReveal('receivable')">{{ maskAmount(stats.receivableAmount, { decimals: 0, visible: reveals.receivable }) }}</em></span>
        <span>应付 <em class="clickable-amount" @click="toggleReveal('receivable')">{{ maskAmount(stats.payableAmount, { decimals: 0, visible: reveals.receivable }) }}</em></span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-header">
        <span class="kpi-label">库存预警</span>
        <el-icon class="kpi-icon" :class="{ warning: stats.lowStockCount > 0 }"><Warning /></el-icon>
      </div>
      <div class="kpi-value">{{ stats.lowStockCount }}</div>
      <div class="kpi-trend" :class="stats.lowStockCount > 0 ? 'negative' : 'positive'">
        <el-icon><Top /></el-icon>
        <span>{{ stats.lowStockCount > 0 ? '需要及时处理' : '库存充足' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import { TrendCharts, ShoppingCart, Money, Warning, Top } from '@element-plus/icons-vue'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'

export interface DashboardStats {
  currentMonthSales: number
  lastMonthSales: number
  currentMonthPurchase: number
  lastMonthPurchase: number
  receivableAmount: number
  payableAmount: number
  lowStockCount: number
}

const props = defineProps<{ stats: DashboardStats }>()
const { maskAmount } = useAmountPrivacy()

const reveals = reactive<Record<string, boolean>>({})
function toggleReveal(key: string) {
  reveals[key] = !reveals[key]
}

const salesTrend = computed(() => {
  if (props.stats.lastMonthSales === 0) return props.stats.currentMonthSales > 0 ? 100 : 0
  return Math.round(((props.stats.currentMonthSales - props.stats.lastMonthSales) / props.stats.lastMonthSales) * 100)
})

const purchaseTrend = computed(() => {
  if (props.stats.lastMonthPurchase === 0) return props.stats.currentMonthPurchase > 0 ? 100 : 0
  return Math.round(((props.stats.currentMonthPurchase - props.stats.lastMonthPurchase) / props.stats.lastMonthPurchase) * 100)
})

function formatTrend(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct}%`
}
</script>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.kpi-card {
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.kpi-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.kpi-label {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-450);
  letter-spacing: var(--letter-body);
  color: var(--el-text-color-secondary);
}

.kpi-icon {
  width: 24px;
  height: 24px;
  color: var(--el-text-color-secondary);
}

.kpi-icon.warning {
  color: var(--color-warning);
}

.kpi-value {
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-700);
  line-height: var(--line-heading);
  letter-spacing: var(--letter-heading);
  color: var(--color-black);
  margin-bottom: var(--space-3);
}

.kpi-value.receivable {
  color: var(--el-color-primary);
}

.kpi-trend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-330);
}

.kpi-trend.positive { color: var(--color-success); }
.kpi-trend.negative { color: var(--color-warning); }

.kpi-detail {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-330);
  color: var(--el-text-color-secondary);
}

.kpi-detail em {
  font-style: normal;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 560px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
</style>
