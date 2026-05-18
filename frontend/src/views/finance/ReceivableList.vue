<template>
  <div class="page-container">
    <div class="page-header">
      <h1>应收管理</h1>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>新增应收单
      </el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索单号或客户"
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
          v-model="queryParams.customerId"
          placeholder="客户"
          clearable
          filterable
          style="width:180px"
          @change="loadData"
        >
          <el-option
            v-for="c in customers"
            :key="c.id"
            :label="c.name"
            :value="c.id"
          />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="orderNo" label="单号" width="180" />
        <el-table-column label="客户" min-width="120">
          <template #default="{ row }">{{ row.customer?.name || '' }}</template>
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
      :title="isEdit ? '编辑应收单' : '新增应收单'"
      width="750px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="80px">
        <el-form-item label="客户" required>
          <el-select
            v-model="form.customerId"
            placeholder="请选择客户"
            filterable
            style="width:100%"
            :disabled="isEdit"
            @change="onCustomerChange"
          >
            <el-option
              v-for="c in customers"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="引用单据">
          <div style="width:100%">
            <el-button size="small" @click="openSelectDialog">
              <el-icon><Plus /></el-icon>选择销货单
            </el-button>
            <el-table :data="form.items" size="small" style="margin-top:8px" max-height="300">
              <el-table-column label="销货单号" min-width="180">
                <template #default="{ row }">{{ row.salesOrder?.orderNo }}</template>
              </el-table-column>
              <el-table-column label="客户" min-width="120">
                <template #default="{ row }">{{ row.salesOrder?.customer?.name }}</template>
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

    <el-dialog v-model="selectDialogVisible" title="选择销货单" width="800px">
      <div class="filter-bar">
        <el-input
          v-model="selectKeyword"
          placeholder="搜索单号"
          clearable
          style="width:200px"
        />
      </div>
      <el-table
        v-loading="selectLoading"
        :data="filteredAvailableOrders"
        stripe
        @selection-change="onSelectChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column label="单号" width="180" prop="orderNo" />
        <el-table-column label="客户" min-width="120">
          <template #default="{ row }">{{ row.customer?.name }}</template>
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
import { receivableApi, type Receivable } from '@/api/receivable'
import { customerApi, type Customer } from '@/api/customer'
import type { SalesOrder } from '@/api/salesOrder'
import { useStatusHelpers } from '@/composables/useStatusHelpers'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'

const loading = ref(false); const submitting = ref(false)
const tableData = ref<Receivable[]>([]); const total = ref(0)
const dialogVisible = ref(false); const selectDialogVisible = ref(false)
const isEdit = ref(false); const editId = ref(0)
const customers = ref<Customer[]>([])
const availableOrders = ref<SalesOrder[]>([])
const selectedOrders = ref<SalesOrder[]>([])
const selectLoading = ref(false); const selectKeyword = ref('')
const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '', customerId: '' as number | string })
const { statusLabel, statusType } = useStatusHelpers()
const { maskAmount } = useAmountPrivacy()
const revealed = reactive<Record<number, boolean>>({})
const toggleAmount = (id: number) => { revealed[id] = !revealed[id] }
const formatDate = (d: string) => new Date(d).toLocaleDateString('zh-CN')

const form = reactive({
  customerId: 0,
  items: [] as Array<{ salesOrderId: number; amount: number; salesOrder?: SalesOrder }>,
  remark: ''
})

const totalFormAmount = computed(() => form.items.reduce((s, i) => s + i.amount, 0))

const filteredAvailableOrders = computed(() => {
  if (!selectKeyword.value) return availableOrders.value
  const kw = selectKeyword.value.toLowerCase()
  return availableOrders.value.filter(o => o.orderNo.toLowerCase().includes(kw))
})

function resetForm() {
  form.customerId = 0
  form.items = []
  form.remark = ''
  isEdit.value = false
  editId.value = 0
}

async function loadData() {
  loading.value = true
  try {
    const params: any = { ...queryParams }
    if (!params.customerId) delete params.customerId
    const res = await receivableApi.getList(params)
    tableData.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

async function loadAvailableOrders(customerId: number) {
  selectLoading.value = true
  try {
    const res = await receivableApi.getAvailableSalesOrders(customerId)
    availableOrders.value = Array.isArray(res) ? res : (res.list || [])
  } finally { selectLoading.value = false }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: Receivable) {
  if (row.status !== 'pending') {
    ElMessage.warning('仅待审核的应收单可编辑')
    return
  }
  isEdit.value = true
  editId.value = row.id
  form.customerId = row.customerId
  form.remark = row.remark || ''
  form.items = (row.items || []).map(i => ({
    salesOrderId: i.salesOrderId,
    amount: i.amount,
    salesOrder: i.salesOrder
  }))
  dialogVisible.value = true
}

function onCustomerChange() {
  form.items = []
}

function openSelectDialog() {
  if (!form.customerId) { ElMessage.warning('请先选择客户'); return }
  selectedOrders.value = []
  selectKeyword.value = ''
  loadAvailableOrders(form.customerId)
  selectDialogVisible.value = true
}

function onSelectChange(rows: SalesOrder[]) {
  selectedOrders.value = rows
}

function confirmSelect() {
  for (const order of selectedOrders.value) {
    if (!form.items.find(i => i.salesOrderId === order.id)) {
      form.items.push({
        salesOrderId: order.id,
        amount: order.totalAmount,
        salesOrder: order
      })
    }
  }
  selectDialogVisible.value = false
}

async function handleSubmit() {
  if (!form.customerId || form.items.length === 0) {
    ElMessage.warning('客户和引用销货单不能为空')
    return
  }
  submitting.value = true
  try {
    const data = {
      customerId: form.customerId,
      items: form.items.map(i => ({ salesOrderId: i.salesOrderId, amount: i.amount })),
      remark: form.remark
    }
    if (isEdit.value) {
      await receivableApi.update(editId.value, data)
      ElMessage.success('更新成功')
    } else {
      await receivableApi.create(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  } finally { submitting.value = false }
}

async function handleApprove(row: Receivable) {
  try {
    await ElMessageBox.confirm(`确认审核"${row.orderNo}"？审核后关联的销货单将被锁定。`, '确认审核', { type: 'info' })
    await receivableApi.approve(row.id)
    ElMessage.success('审核通过')
    loadData()
  } catch {}
}

async function handleRevoke(row: Receivable) {
  try {
    await ElMessageBox.confirm(`确认反审"${row.orderNo}"？反审后关联的销货单将解锁。`, '确认反审', { type: 'warning' })
    await receivableApi.revoke(row.id)
    ElMessage.success('反审成功')
    loadData()
  } catch {}
}

async function handleDelete(row: Receivable) {
  try {
    await ElMessageBox.confirm(`删除"${row.orderNo}"？删除后关联的销货单将解锁。`, '确认删除', { type: 'warning' })
    await receivableApi.delete(row.id)
    ElMessage.success('已删除')
    loadData()
  } catch {}
}

onMounted(() => {
  loadData()
  customerApi.getList({ page: 1, pageSize: 1000, status: 'active' }).then(r => customers.value = r.list)
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
