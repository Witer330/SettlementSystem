<template>
  <div class="production-order">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">生产工单</h1>
        <p class="page-description">管理生产计划、领料出库与完工入库</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新增工单</el-button>
    </div>

    <!-- Filter Bar -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="工单号/产品名" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 130px">
            <el-option label="待生产" value="pending" />
            <el-option label="生产中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Data Table -->
    <el-card class="table-card" shadow="never">
      <el-table v-loading="loading" :data="orderList" stripe style="width: 100%">
        <el-table-column prop="orderNo" label="工单号" width="160" />
        <el-table-column label="产品" width="140">
          <template #default="{ row }">
            {{ row.product?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="来源" width="200">
          <template #default="{ row }">
            <template v-if="row.salesOrder">
              <el-tag size="small" type="info">{{ row.salesOrder.orderNo }}</el-tag>
              <span style="margin-left:4px;font-size:12px;color:var(--color-text-secondary)">
                {{ row.salesOrder.customer?.name || '' }}
              </span>
              <template v-if="salesOrderProgress(row.salesOrder)">
                <div class="so-progress">
                  <el-progress
                    :percentage="salesOrderProgress(row.salesOrder)?.pct ?? 0"
                    :stroke-width="4"
                    :show-text="false"
                    style="width: 80px; display: inline-block; vertical-align: middle;"
                  />
                  <span class="so-progress-text">
                    {{ salesOrderProgress(row.salesOrder)?.produced ?? 0 }}/{{ salesOrderProgress(row.salesOrder)?.planned ?? 0 }}
                  </span>
                </div>
              </template>
            </template>
            <span v-else class="text-muted">手动创建</span>
          </template>
        </el-table-column>
        <el-table-column label="计划/已产" width="120">
          <template #default="{ row }">
            <el-progress
              :percentage="row.quantity > 0 ? Math.round((row.producedQuantity / row.quantity) * 100) : 0"
              :stroke-width="8"
            />
            <span class="progress-text">{{ row.producedQuantity }} / {{ row.quantity }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
            <el-tooltip
              v-if="row.pickingStale && (row.status === 'pending' || row.status === 'processing')"
              content="BOM已变更，领料单可能已过期，请重新生成"
              placement="top"
            >
              <el-tag type="danger" size="small" effect="dark" style="margin-left:4px">
                领料过期
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="开始日期" width="110">
          <template #default="{ row }">
            {{ row.startDate ? new Date(row.startDate).toLocaleDateString('zh-CN') : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" link type="primary" :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              link type="success"
              :icon="Document"
              @click="handleGeneratePicking(row)"
            >
              生成领料
            </el-button>
            <el-button
              v-if="row.status === 'pending' || row.status === 'processing'"
              link type="warning"
              :icon="Box"
              @click="handleOpenPicking(row)"
            >
              领料
            </el-button>
            <el-button
              v-if="row.status === 'processing'"
              link type="success"
              :icon="CircleCheck"
              @click="handleOpenComplete(row)"
            >
              完工入库
            </el-button>
            <el-button
              v-if="row.status === 'pending' || row.status === 'cancelled'"
              link type="danger" :icon="Delete" @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- Form Dialog -->
    <ProductionOrderForm
      v-model="formVisible"
      :mode="formMode"
      :order="currentOrder"
      @success="loadOrderList"
    />

    <!-- Picking Dialog -->
    <ProductionPickingDialog
      v-model="pickingVisible"
      :order="currentOrder"
      @success="loadOrderList"
    />

    <!-- Complete Dialog -->
    <ProductionCompleteDialog
      v-model="completeVisible"
      :order="currentOrder"
      @success="loadOrderList"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete, Document, Box, CircleCheck } from '@element-plus/icons-vue'
import { productionOrderApi, type ProductionOrder } from '@/api/productionOrder'
import ProductionOrderForm from './ProductionOrderForm.vue'
import ProductionPickingDialog from './ProductionPickingDialog.vue'
import ProductionCompleteDialog from './ProductionCompleteDialog.vue'

const loading = ref(false)
const orderList = ref<ProductionOrder[]>([])
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const currentOrder = ref<ProductionOrder | null>(null)
const pickingVisible = ref(false)
const completeVisible = ref(false)

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const statusLabel = (s: string) =>
  ({ pending: '待生产', processing: '生产中', completed: '已完成', cancelled: '已取消' } as Record<string, string>)[s] || s

const statusTagType = (s: string) =>
  ({ pending: 'info', processing: 'warning', completed: 'success', cancelled: 'danger' } as Record<string, string>)[s] || 'info'

const salesOrderProgress = (so: any) => {
  if (!so?.productionOrders?.length) return null
  const planned = so.productionOrders.reduce((s: number, o: any) => s + o.quantity, 0)
  const produced = so.productionOrders.reduce((s: number, o: any) => s + o.producedQuantity, 0)
  if (planned <= 0) return null
  return { planned, produced, pct: Math.round((produced / planned) * 100) }
}

const loadOrderList = async () => {
  try {
    loading.value = true
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.status) params.status = searchForm.status
    const res = await productionOrderApi.getList(params)
    orderList.value = res.list
    pagination.total = res.total
  } catch (error: any) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => { pagination.page = 1; loadOrderList() }
const handleReset = () => { searchForm.keyword = ''; searchForm.status = ''; pagination.page = 1; loadOrderList() }
const handlePageChange = (p: number) => { pagination.page = p; loadOrderList() }
const handleSizeChange = () => { pagination.page = 1; loadOrderList() }

const handleCreate = () => {
  formMode.value = 'create'
  currentOrder.value = null
  formVisible.value = true
}

const handleEdit = (row: ProductionOrder) => {
  formMode.value = 'edit'
  currentOrder.value = row
  formVisible.value = true
}

const handleGeneratePicking = async (row: ProductionOrder) => {
  try {
    await ElMessageBox.confirm('将根据BOM自动生成领料清单，是否继续？', '确认', { type: 'info' })
    await productionOrderApi.generatePicking(row.id)
    ElMessage.success('领料项已生成')
    loadOrderList()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '生成失败')
  }
}

const handleOpenPicking = (row: ProductionOrder) => {
  currentOrder.value = row
  pickingVisible.value = true
}

const handleOpenComplete = (row: ProductionOrder) => {
  currentOrder.value = row
  completeVisible.value = true
}

const handleDelete = async (row: ProductionOrder) => {
  try {
    await ElMessageBox.confirm(`确定删除工单 ${row.orderNo} 吗？`, '确认删除', { type: 'warning' })
    await productionOrderApi.delete(row.id)
    ElMessage.success('删除成功')
    loadOrderList()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

onMounted(() => { loadOrderList() })
</script>

<style scoped>
.production-order {
  padding: var(--space-6);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}
.header-content { flex: 1; }
.page-title {
  margin: 0;
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-700);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}
.page-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.search-card, .table-card { margin-bottom: var(--space-6); }
.progress-text {
  display: block;
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
.text-muted { color: var(--color-text-secondary); font-size: var(--font-size-sm); }
.so-progress { margin-top: 4px; }
.so-progress-text {
  margin-left: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
  vertical-align: middle;
}
.pagination { display: flex; justify-content: flex-end; margin-top: var(--space-6); }
</style>
