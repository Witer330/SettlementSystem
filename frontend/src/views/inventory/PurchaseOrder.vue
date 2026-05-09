<template>
  <div class="page-container">
    <div class="page-header">
      <h1>采购管理</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新增采购单
      </el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索单号或供应商"
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
        <el-table-column label="供应商" min-width="120">
          <template #default="{ row }">{{ row.supplier?.name }}</template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">¥{{ row.totalAmount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="明细数" width="80">
          <template #default="{ row }">{{ row.items?.length || 0 }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="success" v-if="row.status !== 'completed'" @click="openReceiveDialog(row)">入库</el-button>
            <el-button link type="warning" v-if="row.status === 'pending'" @click="handleConfirm(row)">确认</el-button>
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
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑采购单' : '新增采购单'" width="720px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="供应商" prop="supplierId">
          <el-select v-model="form.supplierId" placeholder="请选择供应商" filterable style="width: 100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选" />
        </el-form-item>
      </el-form>

      <h4 style="margin: 12px 0 8px">采购明细</h4>
      <el-table :data="form.items" border size="small">
        <el-table-column label="物料" min-width="180">
          <template #default="{ row }">
            <el-select v-model="row.materialId" placeholder="选择物料" filterable size="small" style="width: 100%">
              <el-option v-for="m in materials" :key="m.id" :label="`${m.code} - ${m.name}`" :value="m.id" />
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
      <el-button size="small" style="margin-top: 8px" @click="form.items.push({ materialId: 0, quantity: 1, price: 0 })">
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

    <!-- 入库对话框 -->
    <el-dialog v-model="receiveDialogVisible" title="采购入库" width="600px">
      <el-table :data="receiveItems" border size="small">
        <el-table-column label="物料" min-width="140">
          <template #default="{ row }">{{ row.materialName }}</template>
        </el-table-column>
        <el-table-column label="采购数量" width="100">
          <template #default="{ row }">{{ row.quantity }}</template>
        </el-table-column>
        <el-table-column label="已收数量" width="100">
          <template #default="{ row }">{{ row.receivedQuantity }}</template>
        </el-table-column>
        <el-table-column label="本次入库" width="120">
          <template #default="{ row }">
            <el-input-number
              v-model="row.receiveQty"
              :min="0"
              :max="row.quantity - row.receivedQuantity"
              size="small"
              style="width: 100%"
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="receiveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleReceive">确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { purchaseOrderApi, type PurchaseOrder } from '@/api/purchaseOrder'
import { supplierApi, type Supplier } from '@/api/supplier'
import { materialApi, type Material } from '@/api/material'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<PurchaseOrder[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const receiveDialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const formRef = ref<FormInstance>()
const suppliers = ref<Supplier[]>([])
const materials = ref<Material[]>([])
const currentReceiveOrderId = ref(0)
const receiveItems = ref<Array<{
  itemId: number
  materialName: string
  quantity: number
  receivedQuantity: number
  receiveQty: number
}>>([])

const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })

const form = reactive({
  supplierId: 0,
  remark: '',
  items: [] as Array<{ materialId: number; quantity: number; price: number }>
})

const rules: FormRules = {
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }]
}

const totalAmount = computed(() => form.items.reduce((s, i) => s + i.quantity * i.price, 0))

const statusLabel = (s: string) => ({ pending: '待确认', confirmed: '已确认', completed: '已完成' }[s] || s)
const statusType = (s: string) => ({ pending: 'warning', confirmed: 'primary', completed: 'success' }[s] as any)

const formatDate = (d: string) => new Date(d).toLocaleDateString('zh-CN')

const loadData = async () => {
  loading.value = true
  try {
    const res = await purchaseOrderApi.getList(queryParams)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const loadSuppliers = async () => {
  try {
    const res = await supplierApi.getList({ page: 1, pageSize: 1000, status: 'active' })
    suppliers.value = res.list
  } catch {}
}

const loadMaterials = async () => {
  try {
    const res = await materialApi.getList({ page: 1, pageSize: 1000 })
    materials.value = res.list
  } catch {}
}

const openDialog = (row?: PurchaseOrder) => {
  isEdit.value = !!row
  editId.value = row?.id || 0
  form.supplierId = (row as any)?.supplierId || 0
  form.remark = row?.remark || ''
  form.items = row?.items?.map(i => ({
    materialId: i.materialId,
    quantity: i.quantity,
    price: i.price
  })) || [{ materialId: 0, quantity: 1, price: 0 }]
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  if (form.items.length === 0 || form.items.every(i => !i.materialId)) {
    ElMessage.warning('请至少添加一条采购明细')
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      await purchaseOrderApi.update(editId.value, { ...form } as any)
      ElMessage.success('更新成功')
    } else {
      await purchaseOrderApi.create({ supplierId: form.supplierId, items: form.items, remark: form.remark })
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

const handleDelete = async (row: PurchaseOrder) => {
  await ElMessageBox.confirm(`确定要删除采购单"${row.orderNo}"吗？`, '确认删除', { type: 'warning' })
  await purchaseOrderApi.delete(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const handleConfirm = async (row: PurchaseOrder) => {
  await ElMessageBox.confirm(`确定要确认采购单"${row.orderNo}"吗？`, '确认操作', { type: 'info' })
  await purchaseOrderApi.updateStatus(row.id, 'confirmed')
  ElMessage.success('已确认')
  loadData()
}

const openReceiveDialog = async (row: PurchaseOrder) => {
  currentReceiveOrderId.value = row.id
  const detail = await purchaseOrderApi.getDetail(row.id)
  receiveItems.value = detail.items.map(i => ({
    itemId: i.id!,
    materialName: `${i.materialCode || ''} - ${i.materialName || ''}`,
    quantity: i.quantity,
    receivedQuantity: i.receivedQuantity || 0,
    receiveQty: 0
  }))
  receiveDialogVisible.value = true
}

const handleReceive = async () => {
  const toReceive = receiveItems.value.filter(i => i.receiveQty > 0)
  if (toReceive.length === 0) {
    ElMessage.warning('请填写入库数量')
    return
  }
  submitting.value = true
  try {
    await purchaseOrderApi.receive(currentReceiveOrderId.value, toReceive.map(i => ({
      itemId: i.itemId,
      receivedQuantity: i.receivedQuantity + i.receiveQty
    })))
    ElMessage.success('入库成功')
    receiveDialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '入库失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadData()
  loadSuppliers()
  loadMaterials()
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
.filter-bar {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
</style>
