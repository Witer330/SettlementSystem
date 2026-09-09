<template>
  <div class="page-container">
    <div class="page-header">
      <h1>库存查询</h1>
      <div class="page-header-actions">
        <el-button @click="showReport = true"><el-icon><DataAnalysis /></el-icon>查看报表</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <!-- Tab 切换 -->
      <el-tabs v-model="inventoryType" @tab-change="onTabChange" style="margin-top: -8px;">
        <el-tab-pane label="原材料库存" name="material" />
        <el-tab-pane label="成品库存" name="product" />
      </el-tabs>

      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          :placeholder="inventoryType === 'material' ? '搜索物料名称或编码' : '搜索产品名称或编码'"
          clearable
          style="width: 240px"
          @keyup.enter="loadData"
        />
        <el-select v-if="inventoryType === 'material'" v-model="queryParams.status" placeholder="库存状态" clearable style="width: 140px" @change="loadData">
          <el-option label="正常" value="normal" />
          <el-option label="不足" value="low" />
          <el-option label="缺货" value="empty" />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-item__label">{{ inventoryType === 'material' ? '物料总数' : '产品总数' }}</span>
          <span class="stat-item__value">{{ stats.total }}</span>
        </div>
        <div class="stat-item stat-item--success" v-if="inventoryType === 'material'">
          <span class="stat-item__label">库存正常</span>
          <span class="stat-item__value">{{ stats.normal }}</span>
        </div>
        <div class="stat-item stat-item--warning" v-if="inventoryType === 'material'">
          <span class="stat-item__label">库存不足</span>
          <span class="stat-item__value">{{ stats.low }}</span>
        </div>
        <div class="stat-item stat-item--danger">
          <span class="stat-item__label">{{ inventoryType === 'material' ? '缺货' : '缺货' }}</span>
          <span class="stat-item__value">{{ stats.empty }}</span>
        </div>
        <div class="stat-item" v-if="inventoryType === 'product'">
          <span class="stat-item__label">有库存</span>
          <span class="stat-item__value">{{ stats.normal }}</span>
        </div>
      </div>

      <el-table :data="tableData" stripe v-loading="loading" :row-class-name="rowClassName">
        <el-table-column :prop="inventoryType === 'material' ? 'materialCode' : 'productCode'" label="编码" width="120" />
        <el-table-column :prop="inventoryType === 'material' ? 'materialName' : 'productName'" label="名称" min-width="150" />
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="specification" label="规格" width="120" />
        <el-table-column prop="quantity" label="当前库存" width="110">
          <template #default="{ row }">
            <span :class="getQtyClass(row)">{{ row.quantity }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="inventoryType === 'material'" prop="safeStock" label="安全库存" width="100" />
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
        <el-table-column label="操作" width="210">
          <template #default="{ row }">
            <template v-if="inventoryType === 'material'">
              <el-button link type="primary" @click="openLogDialog(row)">变动记录</el-button>
              <el-button link type="success" @click="openPickDialog(row)">领料</el-button>
              <el-button link type="warning" @click="openAdjustDialog(row)">调整</el-button>
            </template>
            <template v-else>
              <el-button link type="warning" @click="openAdjustDialog(row)">调整</el-button>
            </template>
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

    <!-- 领料出库对话框 -->
    <el-dialog v-model="pickDialogVisible" title="领料出库" width="420px">
      <el-form ref="pickFormRef" :model="pickForm" :rules="pickRules" label-width="90px">
        <el-form-item label="物料">
          <el-input :model-value="pickForm.itemName" disabled />
        </el-form-item>
        <el-form-item label="当前库存">
          <span>{{ pickForm.currentStock }} {{ pickForm.unit }}</span>
        </el-form-item>
        <el-form-item label="领料数量" prop="quantity">
          <el-input-number v-model="pickForm.quantity" :min="1" :max="pickForm.currentStock" style="width: 100%" />
        </el-form-item>
        <el-form-item label="用途">
          <el-input v-model="pickForm.remark" placeholder="如：生产TH-01弹簧领料" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pickDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjusting" @click="handlePick">确认领料</el-button>
      </template>
    </el-dialog>

    <!-- 库存调整对话框 -->
    <el-dialog v-model="adjustDialogVisible" :title="adjustDialogTitle" width="480px">
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="90px">
        <el-form-item :label="inventoryType === 'material' ? '物料' : '产品'">
          <el-input :model-value="adjustForm.itemName" disabled />
        </el-form-item>
        <el-form-item label="调整类型" prop="type">
          <el-radio-group v-model="adjustForm.type" @change="onAdjustTypeChange">
            <el-radio value="in">入库</el-radio>
            <el-radio value="out">出库</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="包装规格">
          <el-select v-model="adjustForm.pkgSpec" placeholder="基本单位" clearable style="width:100%" @change="onPkgSpecChange">
            <el-option v-for="s in pkgSpecOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="adjustForm.pkgSpec" label="换算比">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="white-space:nowrap">1{{ adjustForm.pkgSpec }} =</span>
            <el-input-number v-model="adjustForm.unitRatio" :min="1" style="flex:1" />
            <span style="white-space:nowrap">{{ currentItemUnit }}</span>
          </div>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <div style="display:flex;align-items:center;gap:8px">
            <el-input-number v-model="adjustForm.quantity" :min="1" style="flex:1" />
            <span style="white-space:nowrap;color:var(--color-text-muted);min-width:60px">
              {{ adjustForm.pkgSpec || currentItemUnit }}
            </span>
            <span v-if="adjustForm.pkgSpec && adjustForm.unitRatio" style="white-space:nowrap;color:var(--color-text-muted);font-size:12px">
              = {{ adjustForm.quantity * adjustForm.unitRatio }} {{ currentItemUnit }}
            </span>
          </div>
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

    <!-- 变动记录对话框（仅原材料） -->
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

    <ReportDialog v-model="showReport" report-type="inventory" title="库存报表" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { DataAnalysis } from '@element-plus/icons-vue'
import { inventoryApi, type InventoryItem, type InventoryLog, type ProductStockItem } from '@/api/inventory'
import ReportDialog from '@/components/ReportDialog.vue'

const showReport = ref(false)

const inventoryType = ref<'material' | 'product'>('material')
const loading = ref(false)
const adjusting = ref(false)
const logLoading = ref(false)
const tableData = ref<InventoryItem[] | ProductStockItem[]>([])
const total = ref(0)
const adjustDialogVisible = ref(false)
const logDialogVisible = ref(false)
const adjustFormRef = ref<FormInstance>()
const logMaterialName = ref('')
const logData = ref<InventoryLog[]>([])
const logTotal = ref(0)

const stats = reactive({ total: 0, normal: 0, low: 0, empty: 0 })

const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })

const pickDialogVisible = ref(false)
const pickFormRef = ref<FormInstance>()
const pickForm = reactive({
  materialId: 0,
  itemName: '',
  currentStock: 0,
  unit: '',
  quantity: 1,
  remark: ''
})
const pickRules: FormRules = {
  quantity: [{ required: true, message: '请输入领料数量', trigger: 'blur' }]
}

const adjustForm = reactive({
  materialId: 0,
  productId: 0,
  itemName: '',
  type: 'in' as 'in' | 'out',
  pkgSpec: '',
  unitRatio: 0,
  quantity: 1,
  remark: ''
})
const currentItemUnit = ref('个')
const pkgSpecOptions = ['小箱', '中箱', '大箱', '包', '卷', '袋', '桶', '托']
const PKG_MEMORY = 'inv_pkg_memory'
function pkgKey() { return inventoryType.value === 'material' ? `mat_${adjustForm.materialId}` : `prod_${adjustForm.productId}` }
function loadPkgRatio(spec: string): number { try { return JSON.parse(localStorage.getItem(PKG_MEMORY) || '{}')[pkgKey()]?.[spec] || 0 } catch { return 0 } }
function savePkgRatio(spec: string, ratio: number) { if (!spec || !ratio) return; const m = JSON.parse(localStorage.getItem(PKG_MEMORY) || '{}'); m[pkgKey()] = { ...m[pkgKey()], [spec]: ratio }; localStorage.setItem(PKG_MEMORY, JSON.stringify(m)) }
function onPkgSpecChange(spec: string) { adjustForm.unitRatio = spec ? loadPkgRatio(spec) : 0 }
function onAdjustTypeChange() { /* noop */ }

const adjustRules: FormRules = {
  type: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }]
}

const logParams = reactive({ page: 1, pageSize: 10, materialId: 0 })

const onTabChange = () => {
  queryParams.page = 1
  queryParams.status = ''
  loadData()
}

const loadData = async () => {
  loading.value = true
  try {
    if (inventoryType.value === 'material') {
      const res = await inventoryApi.getList(queryParams)
      tableData.value = res.list
      total.value = res.total
      const allRes = await inventoryApi.getList({ pageSize: 1000 })
      stats.total = allRes.total
      stats.normal = allRes.list.filter((i: any) => i.stockStatus === 'normal').length
      stats.low = allRes.list.filter((i: any) => i.stockStatus === 'low').length
      stats.empty = allRes.list.filter((i: any) => i.stockStatus === 'empty').length
    } else {
      const res = await inventoryApi.getProductStockList(queryParams)
      tableData.value = res.list
      total.value = res.total
      const allRes = await inventoryApi.getProductStockList({ pageSize: 1000 })
      stats.total = allRes.total
      stats.normal = allRes.list.filter((i: any) => i.stockStatus === 'normal').length
      stats.low = 0
      stats.empty = allRes.list.filter((i: any) => i.stockStatus === 'empty').length
    }
  } finally {
    loading.value = false
  }
}

const stockTagType = (status: string) =>
  ({ normal: 'success', low: 'warning', empty: 'danger' }[status] || 'info') as any

const stockLabel = (status: string) =>
  ({ normal: '正常', low: '不足', empty: '缺货' }[status] || status)

const getQtyClass = (row: any) => {
  if (row.stockStatus === 'empty') return 'qty-empty'
  if (row.stockStatus === 'low') return 'qty-low'
  return ''
}

const rowClassName = ({ row }: { row: any }) => {
  if (row.stockStatus === 'empty') return 'row-empty'
  if (row.stockStatus === 'low') return 'row-low'
  return ''
}

const adjustDialogTitle = computed(() => {
  const prefix = inventoryType.value === 'material' ? '原材料' : '成品'
  const action = adjustForm.type === 'in' ? '入库' : '出库'
  return `${prefix}手工${action}`
})

const openAdjustDialog = (row?: any) => {
  if (inventoryType.value === 'material') {
    adjustForm.materialId = row?.materialId || 0
    adjustForm.productId = 0
    adjustForm.itemName = row ? `${row.materialCode} - ${row.materialName}` : ''
  } else {
    adjustForm.productId = row?.productId || 0
    adjustForm.materialId = 0
    adjustForm.itemName = row ? `${row.productCode} - ${row.productName}` : ''
  }
  if (!adjustForm.type) adjustForm.type = 'in'
  adjustForm.quantity = 1
  adjustForm.remark = ''
  adjustDialogVisible.value = true
}

const handleAdjust = async () => {
  await adjustFormRef.value?.validate()
  adjusting.value = true
  try {
    // 记住换算比
    if (adjustForm.pkgSpec && adjustForm.unitRatio) savePkgRatio(adjustForm.pkgSpec, adjustForm.unitRatio)
    const actualQty = adjustForm.pkgSpec && adjustForm.unitRatio ? adjustForm.quantity * adjustForm.unitRatio : adjustForm.quantity
    if (inventoryType.value === 'material') {
      await inventoryApi.adjust({
        materialId: adjustForm.materialId,
        quantity: actualQty,
        type: adjustForm.type,
        pkgSpec: adjustForm.pkgSpec || undefined,
        unitRatio: adjustForm.unitRatio || undefined,
        remark: adjustForm.remark
      })
    } else {
      await inventoryApi.adjustProductStock({
        productId: adjustForm.productId,
        quantity: actualQty,
        type: adjustForm.type,
        remark: adjustForm.remark
      })
    }
    ElMessage.success(`${adjustForm.type === 'in' ? '入库' : '出库'}成功`)
    adjustDialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    adjusting.value = false
  }
}

const openPickDialog = (row: InventoryItem) => {
  pickForm.materialId = row.materialId
  pickForm.itemName = `${row.materialCode} - ${row.materialName}`
  pickForm.currentStock = row.quantity
  pickForm.unit = row.unit
  pickForm.quantity = 1
  pickForm.remark = ''
  pickDialogVisible.value = true
}

const handlePick = async () => {
  await pickFormRef.value?.validate()
  adjusting.value = true
  try {
    await inventoryApi.adjust({
      materialId: pickForm.materialId,
      quantity: pickForm.quantity,
      type: 'out',
      remark: pickForm.remark || '生产领料'
    })
    ElMessage.success('领料出库成功')
    pickDialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '领料失败')
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
.page-container { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
.page-header h1 { margin: 0; font-size: var(--font-size-h3); font-weight: var(--font-weight-600); }
.filter-bar { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }

.stats-row { display: flex; gap: var(--space-4); margin-bottom: var(--space-4); }
.stat-item { display: flex; flex-direction: column; padding: var(--space-3) var(--space-5); background: var(--bg-muted); border-radius: var(--radius-md); min-width: 100px; }
.stat-item__label { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-bottom: 2px; }
.stat-item__value { font-size: var(--font-size-h4); font-weight: var(--font-weight-700); color: var(--color-text-primary); }
.stat-item--success .stat-item__value { color: var(--color-success); }
.stat-item--warning .stat-item__value { color: var(--color-warning); }
.stat-item--danger .stat-item__value { color: var(--color-danger); }

.qty-empty { color: var(--color-danger); font-weight: var(--font-weight-600); }
.qty-low { color: var(--color-warning); font-weight: var(--font-weight-600); }

:deep(.row-empty) { background-color: rgba(226, 89, 80, 0.04) !important; }
:deep(.row-low) { background-color: rgba(245, 166, 35, 0.04) !important; }

@media (max-width: 768px) {
  .stats-row { flex-wrap: wrap; }
  .stat-item { min-width: calc(50% - var(--space-2)); }
}
</style>
