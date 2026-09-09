<template>
  <div class="page-container">
    <div class="page-header">
      <h1>应付管理</h1>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>新增应付单
      </el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索单号或供应商"
          clearable
          style="width:240px"
          @keyup.enter="loadData"
        />
        <el-select
          v-model="queryParams.status"
          placeholder="状态"
          clearable
          style="width:120px"
          @change="loadData"
        >
          <el-option label="待审核" value="pending" />
          <el-option label="已审核" value="approved" />
        </el-select>
        <el-select
          v-model="queryParams.supplierId"
          placeholder="供应商"
          clearable
          filterable
          style="width:180px"
          @change="loadData"
        >
          <el-option
            v-for="s in suppliers"
            :key="s.id"
            :label="s.name"
            :value="s.id"
          />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="orderNo" label="单号" width="180" />
        <el-table-column label="供应商" min-width="120">
          <template #default="{ row }">{{ row.partner?.name || '' }}</template>
        </el-table-column>
        <el-table-column label="总金额" width="130">
          <template #default="{ row }">
            <span class="clickable-amount" @click="toggleAmount(row.id)">
              {{ maskAmount(row.totalAmount, { visible: revealed[row.id] }) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="引用单数" width="90">
          <template #default="{ row }">{{ row.items?.length || 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'approved' ? 'success' : 'warning'" size="small">
              {{ row.status === 'approved' ? '已审核' : '待审核' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'pending'" link type="success" @click="handleApprove(row)">审核</el-button>
            <el-button v-if="row.status === 'approved'" link type="warning" @click="handleRevoke(row)">反审</el-button>
            <el-button v-if="row.status === 'pending'" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="queryParams.page"
        v-model:page-size="queryParams.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top:16px;justify-content:flex-end"
        @current-change="loadData"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑应付单' : '新增应付单'"
      width="750px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="80px">
        <el-form-item label="供应商" required>
          <el-select
            v-model="form.supplierId"
            placeholder="请选择供应商"
            filterable
            style="width:100%"
            :disabled="isEdit"
            @change="onSupplierChange"
          >
            <el-option
              v-for="s in suppliers"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="引用单据">
          <div style="width:100%">
            <el-button size="small" @click="openSelectDialog">
              <el-icon><Plus /></el-icon>选择采购单
            </el-button>
            <el-table :data="form.items" size="small" style="margin-top:8px" max-height="300">
              <el-table-column label="采购单号" min-width="180">
                <template #default="{ row }">{{ row.purchaseOrder?.orderNo }}</template>
              </el-table-column>
              <el-table-column label="供应商" min-width="120">
                <template #default="{ row }">{{ row.purchaseOrder?.partner?.name }}</template>
              </el-table-column>
              <el-table-column label="金额" width="130">
                <template #default="{ row }">
                  {{ maskAmount(row.amount, { visible: revealed[row.id] }) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70">
                <template #default="{ $index }">
                  <el-button link type="danger" size="small" @click="form.items.splice($index, 1)">移除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="form.items.length > 0" style="margin-top:8px;text-align:right">
              合计: <strong>{{ maskAmount(totalFormAmount, { visible: true }) }}</strong>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="selectDialogVisible" title="选择采购单" width="800px">
      <div class="filter-bar">
        <el-input
          v-model="selectKeyword"
          placeholder="搜索单号"
          clearable
          style="width:200px"
        />
      </div>
      <el-table
        ref="selectTableRef"
        v-loading="selectLoading"
        :data="filteredAvailableOrders"
        stripe
        @selection-change="onSelectChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column label="单号" width="180" prop="orderNo" />
        <el-table-column label="供应商" min-width="120">
          <template #default="{ row }">{{ row.partner?.name }}</template>
        </el-table-column>
        <el-table-column label="金额" width="130">
          <template #default="{ row }">{{ maskAmount(row.totalAmount, { visible: revealed[row.id] }) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="selectDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="selectedOrders.length === 0" @click="confirmSelect">
          确认选择 ({{ selectedOrders.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { payableApi, type Payable } from '@/api/payable'
import { partnerApi, type Partner } from '@/api/partner'
import type { PurchaseOrder } from '@/api/purchaseOrder'
import { useStatusHelpers } from '@/composables/useStatusHelpers'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'

const loading = ref(false); const submitting = ref(false)
const tableData = ref<Payable[]>([]); const total = ref(0)
const dialogVisible = ref(false); const selectDialogVisible = ref(false)
const isEdit = ref(false); const editId = ref(0)
const suppliers = ref<Partner[]>([])
const availableOrders = ref<PurchaseOrder[]>([])
const selectedOrders = ref<PurchaseOrder[]>([])
const selectLoading = ref(false); const selectKeyword = ref('')
const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '', supplierId: '' as number | string })
const { statusLabel, statusType } = useStatusHelpers()
const { maskAmount } = useAmountPrivacy()
const revealed = reactive<Record<number, boolean>>({})
const toggleAmount = (id: number) => { revealed[id] = !revealed[id] }
const formatDate = (d: string) => new Date(d).toLocaleDateString('zh-CN')

const form = reactive({
  supplierId: 0,
  items: [] as Array<{ purchaseOrderId: number; amount: number; purchaseOrder?: PurchaseOrder }>,
  remark: ''
})

const totalFormAmount = computed(() => form.items.reduce((s, i) => s + i.amount, 0))

const filteredAvailableOrders = computed(() => {
  if (!selectKeyword.value) return availableOrders.value
  const kw = selectKeyword.value.toLowerCase()
  return availableOrders.value.filter(o => o.orderNo.toLowerCase().includes(kw))
})

function resetForm() {
  form.supplierId = 0
  form.items = []
  form.remark = ''
  isEdit.value = false
  editId.value = 0
}

async function loadData() {
  loading.value = true
  try {
    const params: any = { ...queryParams }
    if (!params.supplierId) delete params.supplierId
    const res = await payableApi.getList(params)
    tableData.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

async function loadAvailableOrders(supplierId: number) {
  selectLoading.value = true
  try {
    const res = await payableApi.getAvailablePurchaseOrders(supplierId)
    availableOrders.value = Array.isArray(res) ? res : []
  } finally { selectLoading.value = false }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: Payable) {
  if (row.status !== 'pending') {
    ElMessage.warning('仅待审核的应付单可编辑')
    return
  }
  isEdit.value = true
  editId.value = row.id
  form.supplierId = (row as any).partnerId ?? row.supplierId
  form.remark = row.remark || ''
  form.items = (row.items || []).map(i => ({
    purchaseOrderId: i.purchaseOrderId,
    amount: i.amount,
    purchaseOrder: i.purchaseOrder
  }))
  dialogVisible.value = true
}

function onSupplierChange() {
  form.items = []
}

function openSelectDialog() {
  if (!form.supplierId) { ElMessage.warning('请先选择供应商'); return }
  selectedOrders.value = []
  selectKeyword.value = ''
  loadAvailableOrders(form.supplierId)
  selectDialogVisible.value = true
}

function onSelectChange(rows: PurchaseOrder[]) {
  selectedOrders.value = rows
}

function confirmSelect() {
  for (const order of selectedOrders.value) {
    if (!form.items.find(i => i.purchaseOrderId === order.id)) {
      form.items.push({
        purchaseOrderId: order.id,
        amount: order.totalAmount,
        purchaseOrder: order
      })
    }
  }
  selectDialogVisible.value = false
}

async function handleSubmit() {
  if (!form.supplierId || form.items.length === 0) {
    ElMessage.warning('供应商和引用采购单不能为空')
    return
  }
  submitting.value = true
  try {
    const data = {
      supplierId: form.supplierId,
      items: form.items.map(i => ({ purchaseOrderId: i.purchaseOrderId, amount: i.amount })),
      remark: form.remark
    }
    if (isEdit.value) {
      await payableApi.update(editId.value, data)
      ElMessage.success('更新成功')
    } else {
      await payableApi.create(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  } finally { submitting.value = false }
}

async function handleApprove(row: Payable) {
  try {
    await ElMessageBox.confirm(`确认审核"${row.orderNo}"？审核后关联的采购单将被锁定。`, '确认审核', { type: 'info' })
    await payableApi.approve(row.id)
    ElMessage.success('审核通过')
    loadData()
  } catch {}
}

async function handleRevoke(row: Payable) {
  try {
    await ElMessageBox.confirm(`确认反审"${row.orderNo}"？反审后关联的采购单将解锁。`, '确认反审', { type: 'warning' })
    await payableApi.revoke(row.id)
    ElMessage.success('反审成功')
    loadData()
  } catch {}
}

async function handleDelete(row: Payable) {
  try {
    await ElMessageBox.confirm(`删除"${row.orderNo}"？删除后关联的采购单将解锁。`, '确认删除', { type: 'warning' })
    await payableApi.delete(row.id)
    ElMessage.success('已删除')
    loadData()
  } catch {}
}

onMounted(() => {
  loadData()
  partnerApi.getList({ page: 1, pageSize: 1000, status: 'active', isSupplier: true }).then(r => suppliers.value = r.list)
})
</script>

<style scoped>
.page-container { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.page-header h1 { margin: 0; font-size: var(--font-size-h3); font-weight: var(--font-weight-600); }
.filter-bar { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
.clickable-amount { cursor: pointer; padding: 2px 4px; border-radius: var(--radius-sm); transition: background-color 0.15s; }
.clickable-amount:hover { background-color: var(--el-fill-color-light); }
</style>
