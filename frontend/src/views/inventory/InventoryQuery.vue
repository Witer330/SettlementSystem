<template>
  <div class="page-container">
    <div class="page-header">
      <h1>库存查询</h1>
      <el-button type="primary" @click="openAdjustDialog()">
        <el-icon><Edit /></el-icon>库存调整
      </el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索物料名称或编码"
          clearable
          style="width: 240px"
          @keyup.enter="loadData"
        />
        <el-select v-model="queryParams.status" placeholder="库存状态" clearable style="width: 140px" @change="loadData">
          <el-option label="正常" value="normal" />
          <el-option label="不足" value="low" />
          <el-option label="缺货" value="empty" />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <!-- 库存汇总 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-item__label">物料总数</span>
          <span class="stat-item__value">{{ stats.total }}</span>
        </div>
        <div class="stat-item stat-item--success">
          <span class="stat-item__label">库存正常</span>
          <span class="stat-item__value">{{ stats.normal }}</span>
        </div>
        <div class="stat-item stat-item--warning">
          <span class="stat-item__label">库存不足</span>
          <span class="stat-item__value">{{ stats.low }}</span>
        </div>
        <div class="stat-item stat-item--danger">
          <span class="stat-item__label">缺货</span>
          <span class="stat-item__value">{{ stats.empty }}</span>
        </div>
      </div>

      <el-table :data="tableData" stripe v-loading="loading" :row-class-name="rowClassName">
        <el-table-column prop="materialCode" label="物料编码" width="120" />
        <el-table-column prop="materialName" label="物料名称" min-width="150" />
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="specification" label="规格" width="120" />
        <el-table-column prop="quantity" label="当前库存" width="110">
          <template #default="{ row }">
            <span :class="getQtyClass(row)">{{ row.quantity }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="safeStock" label="安全库存" width="100" />
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column prop="stockStatus" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="stockTagType(row.stockStatus)" size="small">
              {{ stockLabel(row.stockStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastUpdated" label="最后更新" width="120">
          <template #default="{ row }">
            {{ row.lastUpdated ? new Date(row.lastUpdated).toLocaleDateString('zh-CN') : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openLogDialog(row)">变动记录</el-button>
            <el-button link type="warning" @click="openAdjustDialog(row)">调整</el-button>
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

    <!-- 库存调整对话框 -->
    <el-dialog v-model="adjustDialogVisible" title="库存调整" width="480px">
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="90px">
        <el-form-item label="物料">
          <el-input :model-value="adjustForm.materialName" disabled />
        </el-form-item>
        <el-form-item label="调整类型" prop="type">
          <el-radio-group v-model="adjustForm.type">
            <el-radio value="in">入库</el-radio>
            <el-radio value="out">出库</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number v-model="adjustForm.quantity" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="adjustForm.remark" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjusting" @click="handleAdjust">确定</el-button>
      </template>
    </el-dialog>

    <!-- 变动记录对话框 -->
    <el-dialog v-model="logDialogVisible" :title="`变动记录 - ${logMaterialName}`" width="720px">
      <el-table :data="logData" stripe v-loading="logLoading" size="small">
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 'in' ? 'success' : 'danger'" size="small">
              {{ row.type === 'in' ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="100" />
        <el-table-column prop="remark" label="备注" min-width="200" />
        <el-table-column prop="createdAt" label="时间" width="160">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="logParams.page"
        v-model:page-size="logParams.pageSize"
        :total="logTotal"
        layout="total, prev, pager, next"
        @current-change="loadLogs"
        size="small"
        style="margin-top: 12px; justify-content: flex-end"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Edit } from '@element-plus/icons-vue'
import { inventoryApi, type InventoryItem, type InventoryLog } from '@/api/inventory'

const loading = ref(false)
const adjusting = ref(false)
const logLoading = ref(false)
const tableData = ref<InventoryItem[]>([])
const total = ref(0)
const adjustDialogVisible = ref(false)
const logDialogVisible = ref(false)
const adjustFormRef = ref<FormInstance>()
const logMaterialName = ref('')
const logData = ref<InventoryLog[]>([])
const logTotal = ref(0)

const stats = reactive({ total: 0, normal: 0, low: 0, empty: 0 })

const queryParams = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
})

const adjustForm = reactive({
  materialId: 0,
  materialName: '',
  type: 'in' as 'in' | 'out',
  quantity: 1,
  remark: ''
})

const adjustRules: FormRules = {
  type: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }]
}

const logParams = reactive({
  page: 1,
  pageSize: 10,
  materialId: 0
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await inventoryApi.getList(queryParams)
    tableData.value = res.list
    total.value = res.total

    // 汇总统计
    const allRes = await inventoryApi.getList({ pageSize: 1000 })
    stats.total = allRes.total
    stats.normal = allRes.list.filter(i => i.stockStatus === 'normal').length
    stats.low = allRes.list.filter(i => i.stockStatus === 'low').length
    stats.empty = allRes.list.filter(i => i.stockStatus === 'empty').length
  } finally {
    loading.value = false
  }
}

const stockTagType = (status: string) => {
  return ({ normal: 'success', low: 'warning', empty: 'danger' }[status] || 'info') as any
}

const stockLabel = (status: string) => {
  return ({ normal: '正常', low: '不足', empty: '缺货' }[status] || status)
}

const getQtyClass = (row: InventoryItem) => {
  if (row.stockStatus === 'empty') return 'qty-empty'
  if (row.stockStatus === 'low') return 'qty-low'
  return ''
}

const rowClassName = ({ row }: { row: InventoryItem }) => {
  if (row.stockStatus === 'empty') return 'row-empty'
  if (row.stockStatus === 'low') return 'row-low'
  return ''
}

const openAdjustDialog = (row?: InventoryItem) => {
  adjustForm.materialId = row?.materialId || 0
  adjustForm.materialName = row ? `${row.materialCode} - ${row.materialName}` : ''
  adjustForm.type = 'in'
  adjustForm.quantity = 1
  adjustForm.remark = ''
  adjustDialogVisible.value = true
}

const handleAdjust = async () => {
  await adjustFormRef.value?.validate()
  if (!adjustForm.materialId) {
    ElMessage.warning('请先选择物料')
    return
  }
  adjusting.value = true
  try {
    await inventoryApi.adjust({
      materialId: adjustForm.materialId,
      quantity: adjustForm.quantity,
      type: adjustForm.type,
      remark: adjustForm.remark
    })
    ElMessage.success(`${adjustForm.type === 'in' ? '入库' : '出库'}成功`)
    adjustDialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    adjusting.value = false
  }
}

const openLogDialog = (row: InventoryItem) => {
  logMaterialName.value = `${row.materialCode} - ${row.materialName}`
  logParams.materialId = row.materialId
  logParams.page = 1
  logDialogVisible.value = true
  loadLogs()
}

const loadLogs = async () => {
  logLoading.value = true
  try {
    const res = await inventoryApi.getLogs(logParams)
    logData.value = res.list
    logTotal.value = res.total
  } finally {
    logLoading.value = false
  }
}

onMounted(() => loadData())
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

/* 汇总统计 */
.stats-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.stat-item {
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-muted);
  border-radius: var(--radius-md);
  min-width: 100px;
}

.stat-item__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-bottom: 2px;
}

.stat-item__value {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-700);
  color: var(--color-text-primary);
}

.stat-item--success .stat-item__value {
  color: var(--color-success);
}

.stat-item--warning .stat-item__value {
  color: var(--color-warning);
}

.stat-item--danger .stat-item__value {
  color: var(--color-danger);
}

/* 库存数量样式 */
.qty-empty {
  color: var(--color-danger);
  font-weight: var(--font-weight-600);
}

.qty-low {
  color: var(--color-warning);
  font-weight: var(--font-weight-600);
}

/* 低库存行高亮 */
:deep(.row-empty) {
  background-color: rgba(226, 89, 80, 0.04) !important;
}

:deep(.row-low) {
  background-color: rgba(245, 166, 35, 0.04) !important;
}

@media (max-width: 768px) {
  .stats-row {
    flex-wrap: wrap;
  }

  .stat-item {
    min-width: calc(50% - var(--space-2));
  }
}
</style>
