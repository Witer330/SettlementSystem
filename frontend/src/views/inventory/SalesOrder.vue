<template>
  <div class="page-container">
    <div class="page-header">
      <h1>销售管理</h1>
      <div class="page-header-actions">
        <el-button @click="showReport = true">
          <el-icon><DataAnalysis /></el-icon>查看报表
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>新增销售单
        </el-button>
      </div>
    </div>

    <!-- 流程进度条 -->
    <div class="flow-progress">
      <div v-for="(s, i) in flowMilestones" :key="i" class="flow-progress-item">
        <div class="flow-progress-dot" :class="{ active: s.active }" />
        <span class="flow-progress-label">{{ s.label }}</span>
        <span v-if="i < flowMilestones.length - 1" class="flow-progress-line" :class="{ active: s.active }" />
      </div>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索单号或客户"
          clearable
          style="width: 240px"
          @keyup.enter="loadData"
        />
        <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 120px" @change="loadData">
          <el-option label="待确认" value="pending" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="已完成" value="completed" />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="orderNo" label="单号" width="180" />
        <el-table-column prop="customerName" label="客户" min-width="120">
          <template #default="{ row }">{{ row.customer?.name }}</template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">¥{{ row.totalAmount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleDateString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="success" @click="goRequirements(row)">物料需求</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="queryParams.page"
        v-model:page-size="queryParams.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadData"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑销售单' : '新增销售单'" width="720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="客户" prop="customerId">
          <el-select v-model="form.customerId" placeholder="请选择客户" filterable style="width: 100%">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选" />
        </el-form-item>
      </el-form>

      <h4 style="margin: 12px 0 8px">销售明细</h4>
      <el-table :data="form.items" border size="small">
        <el-table-column label="产品" min-width="180">
          <template #default="{ row }">
            <el-select v-model="row.productId" placeholder="选择产品" filterable size="small" style="width: 100%">
              <el-option v-for="p in products" :key="p.id" :label="`${p.code} - ${p.name}`" :value="p.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.quantity" :min="0" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="单价" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.price" :min="0" :precision="2" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="小计" width="100">
          <template #default="{ row }">¥{{ (row.quantity * row.price).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column width="60">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="form.items.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-button size="small" style="margin-top: 8px" @click="form.items.push({ productId: 0, quantity: 1, price: 0 })">
        + 添加明细
      </el-button>
      <div style="text-align: right; margin-top: 8px; font-size: 16px">
        合计：<b>¥{{ totalAmount.toFixed(2) }}</b>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <ReportDialog v-model="showReport" report-type="sales" title="销售报表" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, DataAnalysis } from '@element-plus/icons-vue'
import { salesOrderApi, type SalesOrder } from '@/api/salesOrder'
import { productApi, type Product } from '@/api/product'
import ReportDialog from '@/components/ReportDialog.vue'

const showReport = ref(false)
const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const tableData = ref<SalesOrder[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const formRef = ref<FormInstance>()
const customers = ref<any[]>([])
const products = ref<Product[]>([])

// 流程里程碑（销售单视角）
const flowMilestones = ref([
  { label: '销售下单', active: false },
  { label: '物料需求', active: false },
  { label: '采购到货', active: false },
  { label: '生产报工', active: false },
  { label: '成品入库', active: false }
])

const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })

const form = reactive({
  customerId: 0,
  remark: '',
  items: [] as Array<{ productId: number; quantity: number; price: number }>
})

const rules: FormRules = {
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }]
}

const totalAmount = computed(() => form.items.reduce((s, i) => s + i.quantity * i.price, 0))

const statusLabel = (s: string) => ({ pending: '待确认', confirmed: '已确认', completed: '已完成' }[s] || s)
const statusType = (s: string) => ({ pending: 'warning', confirmed: 'primary', completed: 'success' }[s] as any)

const loadData = async () => {
  loading.value = true
  try {
    const res = await salesOrderApi.getList(queryParams)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

// 客户数据通过 API 获取（customer 接口尚未实现）

const openDialog = (row?: SalesOrder) => {
  isEdit.value = !!row
  editId.value = row?.id || 0
  form.customerId = (row as any)?.customerId || 0
  form.remark = row?.remark || ''
  form.items = row?.items?.map(i => ({
    productId: i.productId,
    quantity: i.quantity,
    price: i.price
  })) || [{ productId: 0, quantity: 1, price: 0 }]
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  if (form.items.length === 0 || form.items.every(i => !i.productId)) {
    ElMessage.warning('请至少添加一条销售明细')
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      await salesOrderApi.update(editId.value, { ...form } as any)
      ElMessage.success('更新成功')
    } else {
      await salesOrderApi.create({ customerId: form.customerId, items: form.items, remark: form.remark })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (row: SalesOrder) => {
  await ElMessageBox.confirm(`确定要删除销售单"${row.orderNo}"吗？`, '确认删除', { type: 'warning' })
  await salesOrderApi.delete(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const goRequirements = (row: SalesOrder) => {
  router.push({ path: '/dashboard/inventory/material-requirements', query: { orderId: row.id } })
}

onMounted(async () => {
  loadData()
  try {
    const res = await productApi.getList({ page: 1, pageSize: 1000 })
    products.value = res.list
  } catch {}
  // 加载流程状态
  try {
    const { workflowApi } = await import('@/api/workflow')
    const status = await workflowApi.getFlowStatus()
    flowMilestones.value[0].active = (status.salesOrders?.count || 0) > 0
    flowMilestones.value[1].active = (status.salesOrders?.count || 0) > 0
    flowMilestones.value[2].active = (status.purchaseOrders?.count || 0) > 0
    flowMilestones.value[3].active = (status.dailyRecords?.count || 0) > 0
    flowMilestones.value[4].active = (status.inventory?.count || 0) > 0
  } catch {}
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
  margin-bottom: var(--space-4);
}
.page-header h1 {
  margin: 0;
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-600);
}

/* 流程进度条 */
.flow-progress {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border-radius: 8px;
  margin-bottom: var(--space-4);
  overflow-x: auto;
}
.flow-progress-item {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.flow-progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #D1D5DB;
  flex-shrink: 0;
}
.flow-progress-dot.active {
  background: #10B981;
}
.flow-progress-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-left: 6px;
  white-space: nowrap;
}
.flow-progress-dot.active + .flow-progress-label {
  color: var(--color-text-primary);
  font-weight: 500;
}
.flow-progress-line {
  display: inline-block;
  width: 24px;
  height: 1px;
  background: #D1D5DB;
  margin: 0 8px;
  flex-shrink: 0;
}
.flow-progress-line.active {
  background: #10B981;
}

.filter-bar {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
</style>
