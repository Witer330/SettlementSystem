<template>
  <div class="page-container">
    <div class="page-header">
      <h1>退货管理</h1>
    </div>
    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="query.keyword"
          placeholder="搜索退货单号/销货单号/客户"
          clearable
          style="width:260px"
          @keyup.enter="loadData"
        />
        <el-select
          v-model="query.status"
          placeholder="状态"
          clearable
          style="width:140px"
          @change="loadData"
        >
          <el-option
            label="待入库"
            value="confirmed"
          />
          <el-option
            label="已入库"
            value="completed"
          />
          <el-option
            label="已取消"
            value="cancelled"
          />
          <el-option
            label="已报废"
            value="scrapped"
          />
        </el-select>
        <el-button
          type="primary"
          @click="loadData"
        >
          搜索
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        stripe
      >
        <el-table-column
          prop="returnNo"
          label="退货单号"
          width="180"
        />
        <el-table-column
          label="关联销货单"
          width="180"
        >
          <template #default="{ row }">
            {{ row.salesOrder?.orderNo }}
          </template>
        </el-table-column>
        <el-table-column
          label="客户"
          min-width="120"
        >
          <template #default="{ row }">
            {{ row.salesOrder?.customer?.name }}
          </template>
        </el-table-column>
        <el-table-column
          prop="totalQuantity"
          label="退货数量"
          width="100"
        />
        <el-table-column
          label="退货明细"
          min-width="200"
        >
          <template #default="{ row }">
            <span
              v-for="(i, idx) in row.items"
              :key="i.id"
            >
              {{ i.product?.name }}×{{ i.quantity }}<span v-if="idx < row.items.length - 1">, </span>
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="reason"
          label="退货原因"
          width="120"
        />
        <el-table-column
          label="状态"
          width="110"
        >
          <template #default="{ row }">
            <el-tag
              :type="statusTagType(row.status)"
              size="small"
            >
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="createdAt"
          label="创建时间"
          width="160"
        >
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleDateString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="220"
         
        >
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'confirmed'"
              link
              type="success"
              @click="handleComplete(row)"
            >
              确认入库
            </el-button>
            <el-button
              v-if="row.status === 'confirmed'"
              link
              type="danger"
              @click="handleScrap(row)"
            >
              报废
            </el-button>
            <el-button
              v-if="row.status === 'confirmed' || row.status === 'completed'"
              link
              type="warning"
              @click="handleCancel(row)"
            >
              取消退货
            </el-button>
            <span
              v-if="row.status === 'cancelled' || row.status === 'scrapped'"
              style="color:var(--color-text-muted);font-size:12px"
            >-</span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top:16px;justify-content:flex-end"
        @current-change="loadData"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { returnOrderApi, type ReturnOrder } from '@/api/returnOrder'

const loading = ref(false)
const list = ref<ReturnOrder[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })

const loadData = async () => {
  loading.value = true
  try {
    const res = await returnOrderApi.getList({ ...query })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

const scrapReasons = ['外观破损', '尺寸不符', '材质缺陷', '工艺不达标', '运输损坏', '客户拒收', '过期作废', '其他']

const statusLabel = (s: string) => ({ confirmed: '待入库', completed: '已入库', cancelled: '已取消', scrapped: '已报废' }[s] || s)
const statusTagType = (s: string) => ({ confirmed: 'warning', completed: 'success', cancelled: 'info', scrapped: 'danger' }[s] || '')

const handleComplete = async (row: ReturnOrder) => {
  try {
    await ElMessageBox.confirm(`确认退货入库后将回加成品库存。确定入库退货单"${row.returnNo}"吗？`, '确认入库', { confirmButtonText: '确认入库', type: 'success' })
    await returnOrderApi.complete(row.id)
    ElMessage.success('退货已入库，库存已回加')
    loadData()
  } catch { /* 取消 */ }
}

const handleCancel = async (row: ReturnOrder) => {
  try {
    const msg = row.status === 'completed'
      ? `该退货单已入库，取消后将回退库存数据。确定取消退货单"${row.returnNo}"吗？`
      : `确定取消退货单"${row.returnNo}"吗？退货数据将回退至销货单。`
    await ElMessageBox.confirm(msg, '取消退货', { confirmButtonText: '确认取消', cancelButtonText: '返回', type: 'warning' })
    await returnOrderApi.cancel(row.id)
    ElMessage.success('退货已取消')
    loadData()
  } catch { /* 取消 */ }
}

const handleScrap = async (row: ReturnOrder) => {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入报废原因', '报废确认', {
      confirmButtonText: '确认报废',
      cancelButtonText: '返回',
      type: 'error',
      inputType: 'textarea',
      inputPlaceholder: scrapReasons.join('；'),
      inputValidator: (v) => v.trim() ? true : '请填写报废原因'
    })
    await returnOrderApi.scrap(row.id, reason || '')
    ElMessage.success('已报废，退货商品不再入库')
    loadData()
  } catch { /* 取消 */ }
}

onMounted(() => loadData())
</script>

<style scoped>
.page-container { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
.page-header h1 { margin: 0; font-size: var(--font-size-h3); font-weight: var(--font-weight-600); }
.filter-bar { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
</style>
