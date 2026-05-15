<template>
  <div class="page-container">
    <div class="page-header">
      <h1>物料需求分析</h1>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-select
          v-model="selectedOrderId"
          placeholder="选择销售单"
          filterable
          style="width: 300px"
          @change="loadRequirements"
        >
          <el-option
            v-for="o in salesOrders"
            :key="o.id"
            :label="`${o.orderNo} - ${o.customerName || '未知客户'}`"
            :value="o.id"
          />
        </el-select>
        <el-button
          v-if="selectedOrderId"
          type="primary"
          @click="loadRequirements"
        >
          刷新
        </el-button>
      </div>

      <!-- 销售单信息 -->
      <div
        v-if="salesOrderInfo"
        class="order-info"
      >
        <span>单号：<b>{{ salesOrderInfo.orderNo }}</b></span>
        <span>客户：<b>{{ salesOrderInfo.customerName || '-' }}</b></span>
        <span>状态：<el-tag
          :type="statusType(salesOrderInfo.status)"
          size="small"
        >{{ statusLabel(salesOrderInfo.status) }}</el-tag></span>
      </div>

      <!-- 物料需求汇总表 -->
      <el-table
        v-if="requirements.length > 0"
        v-loading="loading"
        :data="requirements"
        stripe
        border
        row-key="materialId"
      >
        <el-table-column
          prop="materialCode"
          label="编码"
          width="120"
        />
        <el-table-column
          prop="materialName"
          label="物料名称"
          min-width="150"
        />
        <el-table-column
          prop="unit"
          label="单位"
          width="80"
        />
        <el-table-column
          prop="totalRequired"
          label="需求总量"
          width="120"
        >
          <template #default="{ row }">
            {{ row.totalRequired.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="currentStock"
          label="当前库存"
          width="120"
        >
          <template #default="{ row }">
            {{ row.currentStock.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="shortage"
          label="缺口量"
          width="120"
        >
          <template #default="{ row }">
            <span :class="{ 'shortage-negative': row.shortage > 0 }">
              {{ row.shortage > 0 ? row.shortage.toFixed(2) : '充足' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-content">
              <table class="detail-table">
                <thead>
                  <tr>
                    <th>产品名称</th>
                    <th>产品编码</th>
                    <th>需求数量</th>
                    <th>BOM 用量</th>
                    <th>小计</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(d, i) in row.details"
                    :key="i"
                  >
                    <td>{{ d.productName }}</td>
                    <td>{{ d.productCode }}</td>
                    <td>{{ d.quantity }}</td>
                    <td>{{ d.bomQty }}</td>
                    <td>{{ d.subTotal.toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && selectedOrderId && requirements.length === 0"
        description="该订单暂无物料需求数据"
      />
      <el-empty
        v-if="!selectedOrderId"
        description="请先选择一个销售单"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { salesOrderApi, type SalesOrder, type MaterialRequirement } from '@/api/salesOrder'

const route = useRoute()
const loading = ref(false)
const selectedOrderId = ref<number | null>(null)
const salesOrders = ref<SalesOrder[]>([])
const salesOrderInfo = ref<SalesOrder | null>(null)
const requirements = ref<MaterialRequirement[]>([])

const statusLabel = (s: string) => ({ pending: '待确认', confirmed: '已确认', completed: '已完成' }[s] || s)
const statusType = (s: string) => ({ pending: 'warning', confirmed: 'primary', completed: 'success' }[s] as any)

const loadRequirements = async () => {
  if (!selectedOrderId.value) return
  loading.value = true
  try {
    const res = await salesOrderApi.getMaterialRequirements(selectedOrderId.value)
    salesOrderInfo.value = res.salesOrder
    requirements.value = res.requirements
  } catch {
    salesOrderInfo.value = null
    requirements.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 加载销售单列表
  try {
    const res = await salesOrderApi.getList({ page: 1, pageSize: 1000 })
    salesOrders.value = res.list
  } catch {}

  // 如果 URL 带有 orderId 参数，自动选中
  const orderId = route.query.orderId
  if (orderId) {
    selectedOrderId.value = Number(orderId)
    loadRequirements()
  }
})
</script>

<style scoped>
.page-container {
  padding: var(--space-6);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}
.page-header h1 {
  margin: 0;
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-600);
}
.filter-bar {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.order-info {
  display: flex;
  gap: var(--space-6);
  padding: 12px 16px;
  background: var(--bg-elevated);
  border-radius: 8px;
  margin-bottom: var(--space-4);
  font-size: var(--font-size-sm);
}
.shortage-negative {
  color: #e74c3c;
  font-weight: 600;
}
.expand-content {
  padding: 12px 24px;
}
.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.detail-table th,
.detail-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}
.detail-table th {
  font-weight: 500;
  color: var(--color-text-muted);
}
</style>
