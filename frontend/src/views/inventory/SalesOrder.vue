<template>
  <div class="page-container">
    <div class="page-header">
      <h1>销售管理</h1>
      <div class="page-header-actions">
        <el-button @click="showReport = true">
          <el-icon><DataAnalysis /></el-icon>查看报表
        </el-button>
        <el-button @click="router.push('/dashboard/inventory/return-orders')">
          <el-icon><RefreshLeft /></el-icon>退货管理
        </el-button>
        <el-button
          type="primary"
          @click="openDialog()"
        >
          <el-icon><Plus /></el-icon>新增销售单
        </el-button>
      </div>
    </div>

    <!-- 流程进度条 -->
    <div class="flow-progress">
      <div
        v-for="(s, i) in flowMilestones"
        :key="i"
        class="flow-progress-item"
      >
        <div
          class="flow-progress-dot"
          :class="{ active: s.active }"
        />
        <span class="flow-progress-label">{{ s.label }}</span>
        <span
          v-if="i < flowMilestones.length - 1"
          class="flow-progress-line"
          :class="{ active: s.active }"
        />
      </div>
    </div>

    <!-- 草稿卡片区 -->
    <div v-if="drafts.length > 0" class="draft-zone">
      <div class="draft-zone-header">
        <span class="draft-zone-title">
          <el-icon :size="16" style="margin-right:4px;"><Document /></el-icon>未完成的草稿 · {{ drafts.length }}
        </span>
        <div class="draft-zone-header-actions">
          <el-button link type="danger" size="small" @click="deleteAllDrafts">全部删除</el-button>
          <el-button link size="small" @click="draftsCollapsed = !draftsCollapsed">
            {{ draftsCollapsed ? '展开 ▼' : '收起 ▲' }}
          </el-button>
        </div>
      </div>
      <div v-show="!draftsCollapsed" class="draft-cards">
        <div
          v-for="d in drafts"
          :key="d.id"
          class="draft-card"
        >
          <div class="draft-card-body">
            <div class="draft-card-left">
              <span class="draft-card-no">{{ d.orderNo }}</span>
              <span class="draft-card-party">{{ d.customer?.name || '(未选择客户)' }}</span>
              <span class="draft-card-meta">{{ d.items?.length || 0 }} 项明细 · ¥{{ (d.totalAmount || 0).toFixed(2) }} · {{ formatDraftTime(d.updatedAt) }}</span>
            </div>
            <div class="draft-card-actions">
              <el-button size="small" type="primary" @click="openDialog(d)">继续编辑</el-button>
              <el-button size="small" @click="deleteDraft(d)">删除</el-button>
            </div>
          </div>
        </div>
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
        <el-select
          v-model="queryParams.status"
          placeholder="状态"
          clearable
          style="width: 120px"
          @change="loadData"
        >
          <el-option label="草稿" value="draft" />
          <el-option label="待确认" value="pending" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="已完成" value="completed" />
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
        :data="tableData"
        stripe
      >
        <el-table-column
          prop="orderNo"
          label="单号"
          width="180"
        />
        <el-table-column label="客户" min-width="120">
          <template #default="{ row }">
            {{ row.customer?.name || (row.status === 'draft' ? '(未选择)' : '') }}
          </template>
        </el-table-column>
        <el-table-column
          prop="totalAmount"
          label="总金额"
          width="120"
        >
          <template #default="{ row }">
            ¥{{ row.totalAmount.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="170">
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              <el-tag v-if="getReturnSummary(row)" :type="returnTagType(row)" size="small">{{ returnLabel(row) }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="createdAt"
          label="创建时间"
          width="180"
        >
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleDateString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="400"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'pending'"
              link type="warning"
              @click="handleConfirm(row)"
            >
              确认
              <el-tooltip placement="top" :content="statusHelp.confirm"><el-icon :size="12" style="margin-left:2px;"><QuestionFilled /></el-icon></el-tooltip>
            </el-button>
            <el-button
              v-if="row.status === 'confirmed'"
              link type="success"
              @click="handleComplete(row)"
            >
              完成
              <el-tooltip placement="top" :content="statusHelp.complete"><el-icon :size="12" style="margin-left:2px;"><QuestionFilled /></el-icon></el-tooltip>
            </el-button>
            <el-button
              v-if="row.status === 'confirmed' || row.status === 'completed'"
              link type="danger"
              @click="openReturnDialog(row)"
            >
              退货
              <el-tooltip placement="top" :content="statusHelp.returned"><el-icon :size="12" style="margin-left:2px;"><QuestionFilled /></el-icon></el-tooltip>
            </el-button>
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
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="loadData"
      />
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑销售单' : '新增销售单'"
      width="720px"
      @closed="onDialogClosed"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <el-form-item
          label="客户"
          prop="customerId"
        >
          <el-select
            v-model="form.customerId"
            placeholder="请选择客户"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="c in customers"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            placeholder="可选"
          />
        </el-form-item>
        <el-form-item label="占用库存">
          <el-checkbox v-model="form.reserveInventory">
            草稿商品占用库存，避免超卖
          </el-checkbox>
        </el-form-item>
      </el-form>

      <h4 style="margin: 12px 0 8px">
        销售明细
      </h4>
      <el-table
        :data="form.items"
        border
        size="small"
      >
        <el-table-column label="#" width="44" align="center">
          <template #default="{ $index }">
            <span style="color:var(--color-text-muted);font-size:12px;">{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="产品"
          min-width="180"
        >
          <template #default="{ row }">
            <el-select
              v-model="row.productId"
              placeholder="选择产品"
              filterable
              size="small"
              style="width: 100%"
              @change="onProductChange($event, row)"
            >
              <el-option
                v-for="p in products"
                :key="p.id"
                :label="`${p.code} - ${p.name}`"
                :value="p.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column
          label="数量"
          width="120"
        >
          <template #default="{ row }">
            <el-input-number
              v-model="row.quantity"
              :min="0"
              size="small"
              style="width: 100%"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="单价"
          width="140"
        >
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:4px;">
              <el-input-number
                v-model="row.price"
                :min="0"
                :precision="2"
                size="small"
                style="width: 100%"
              />
              <el-tag v-if="row.productId > 0 && row.price === 0" type="danger" size="small" effect="dark">赠品</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          label="小计"
          width="100"
        >
          <template #default="{ row }">
            <span :style="{ color: row.price === 0 && row.productId > 0 ? 'var(--color-danger)' : '' }">
              ¥{{ (row.quantity * row.price).toFixed(2) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column width="60">
          <template #default="{ $index }">
            <el-button
              link
              type="danger"
              size="small"
              @click="form.items.splice($index, 1)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-button
        size="small"
        style="margin-top: 8px"
        @click="form.items.push({ productId: 0, quantity: 1, price: 0 })"
      >
        + 添加明细
      </el-button>
      <div style="text-align: right; margin-top: 8px; font-size: 16px">
        合计：<b>¥{{ totalAmount.toFixed(2) }}</b>
      </div>

      <template #footer>
        <div style="display:flex;align-items:center;gap:8px;">
          <span
            v-if="draft.isDraft.value"
            style="color:var(--color-text-muted);font-size:12px;margin-right:auto;"
          >
            {{ draft.isSaving.value ? '保存中...' : `草稿 · 已自动保存 ${draft.lastSavedAt.value ? new Date(draft.lastSavedAt.value).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) : ''}`.trim() }}
          </span>
          <span v-else style="flex:1;" />
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button :loading="draft.isSaving.value" @click="handleSaveDraft">保存草稿</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 退货对话框 — 生成独立退货单 -->
    <el-dialog v-model="returnVisible" title="新建退货单" width="600px">
      <div style="margin-bottom:8px;color:var(--color-text-muted);font-size:12px;">
        关联销货单：{{ returnTarget?.orderNo }} | 客户：{{ returnTarget?.customer?.name }}
      </div>
      <el-table :data="returnDraft" border size="small">
        <el-table-column label="产品" min-width="160">
          <template #default="{ row }">{{ row.productName }}</template>
        </el-table-column>
        <el-table-column label="订单数量" width="100">
          <template #default="{ row }">{{ row.orderedQty }}</template>
        </el-table-column>
        <el-table-column label="退货数量" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.returnQty" :min="0" :max="row.orderedQty" size="small" style="width:100%" />
          </template>
        </el-table-column>
      </el-table>
      <div style="color:var(--color-text-muted);font-size:12px;margin-top:8px;">
        退货单创建后可在「退货管理」中确认入库，入库时自动回加成品库存。销货单状态不受影响。
      </div>
      <template #footer>
        <el-button @click="returnVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="handleReturn">生成退货单</el-button>
      </template>
    </el-dialog>

    <ReportDialog
      v-model="showReport"
      report-type="sales"
      title="销售报表"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, DataAnalysis, Document, QuestionFilled, RefreshLeft } from '@element-plus/icons-vue'
import { salesOrderApi, type SalesOrder } from '@/api/salesOrder'
import { productApi, type Product } from '@/api/product'
import { customerApi } from '@/api/customer'
import { returnOrderApi } from '@/api/returnOrder'
import ReportDialog from '@/components/ReportDialog.vue'
import { useDraftAutoSave } from '@/composables/useDraftAutoSave'

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

const form = reactive({
  customerId: 0,
  remark: '',
  reserveInventory: true,
  items: [] as Array<{ productId: number; quantity: number; price: number }>
})

// 草稿自动保存
const draft = useDraftAutoSave(salesOrderApi as any, form as any, 'customerId', 'productId')

// 流程里程碑（销售单视角）
const flowMilestones = ref([
  { label: '销售下单', active: false },
  { label: '物料需求', active: false },
  { label: '采购到货', active: false },
  { label: '生产报工', active: false },
  { label: '成品入库', active: false }
])

const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })

const rules: FormRules = {
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }]
}

const totalAmount = computed(() => form.items.reduce((s, i) => s + i.quantity * i.price, 0))

const statusLabel = (s: string) => ({ draft: '草稿', pending: '待确认', confirmed: '已确认', completed: '已完成' }[s] || s)
const statusType = (s: string) => ({ draft: 'info', pending: 'warning', confirmed: 'primary', completed: 'success' }[s] as any)

async function handleSaveDraft() {
  try {
    await draft.saveAsDraft()
    ElMessage.success('草稿已保存')
    dialogVisible.value = false
    loadDrafts()
  } catch (e: any) {
    ElMessage.error(e.message || '保存草稿失败')
  }
}

// 对话框关闭时清理自动保存，空草稿自动删除
async function onDialogClosed() {
  draft.stopAutoSave()
  if (draft.draftId.value && !draft.hasMeaningfulContent()) {
    await draft.discardDraft()
    loadData()
  }
  // 刷新草稿卡片区
  loadDrafts()
}

const draftCount = ref(0)
const drafts = ref<SalesOrder[]>([])
const draftsCollapsed = ref(false)

const loadData = async () => {
  loading.value = true
  try {
    const [res, draftRes] = await Promise.all([
      salesOrderApi.getList(queryParams),
      salesOrderApi.getList({ page: 1, pageSize: 1, status: 'draft' })
    ])
    tableData.value = res.list
    total.value = res.total
    draftCount.value = draftRes.total
  } finally {
    loading.value = false
  }
}

async function loadDrafts() {
  try {
    const res = await salesOrderApi.getList({ page: 1, pageSize: 50, status: 'draft' })
    drafts.value = res.list
    draftCount.value = res.total
  } catch { /* ignore */ }
}

async function deleteDraft(d: SalesOrder) {
  try {
    await ElMessageBox.confirm(`确定要删除草稿"${d.orderNo}"吗？`, '删除草稿', {
      type: 'info',
      confirmButtonText: '删除',
    })
    await salesOrderApi.delete(d.id)
    ElMessage.success('草稿已删除')
    loadDrafts()
    if (queryParams.status === 'draft') loadData()
  } catch { /* 取消 */ }
}

async function deleteAllDrafts() {
  try {
    await ElMessageBox.confirm(
      `确定要删除全部 ${drafts.value.length} 条草稿吗？此操作不可恢复。`,
      '删除全部草稿',
      { type: 'warning', confirmButtonText: '全部删除' }
    )
    await Promise.all(drafts.value.map(d => salesOrderApi.delete(d.id)))
    ElMessage.success('已清空草稿')
    drafts.value = []
    draftCount.value = 0
    if (queryParams.status === 'draft') loadData()
  } catch { /* 取消 */ }
}

function formatDraftTime(d: string) {
  const now = new Date()
  const dt = new Date(d)
  const diffMs = now.getTime() - dt.getTime()
  if (diffMs < 60000) return '刚刚'
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} 分钟前`
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} 小时前`
  return dt.toLocaleDateString('zh-CN')
}

// 客户数据通过 API 获取（customer 接口尚未实现）

const openDialog = (row?: SalesOrder) => {
  const isDraftOrder = row?.status === 'draft'
  isEdit.value = !!row && !isDraftOrder
  editId.value = row?.id || 0
  form.customerId = row?.customerId || 0
  form.remark = row?.remark || ''
  form.reserveInventory = row?.reserveInventory !== undefined ? row.reserveInventory : true
  form.items = row?.items?.map(i => ({
    productId: i.productId,
    quantity: i.quantity,
    price: i.price
  })) || [{ productId: 0, quantity: 1, price: 0 }]
  // 草稿：恢复自动保存，非草稿编辑：不启用自动保存
  if (isDraftOrder || !row) {
    draft.initAutoSave(row || null)
  } else {
    draft.stopAutoSave()
  }
  dialogVisible.value = true
}

// 选择产品时自动填入售价
function onProductChange(val: number, row: { price: number }) {
  const product = products.value.find(p => p.id === val)
  if (product && row.price === 0) {
    row.price = product.price || 0
  }
}

// 获取赠品行列表（售价为0且已选产品）
const giftLines = () => form.items
  .map((item, idx) => ({ ...item, rowNo: idx + 1 }))
  .filter(i => i.productId > 0 && i.price === 0)

const handleSubmit = async () => {
  await formRef.value?.validate()
  if (form.items.length === 0 || form.items.every(i => !i.productId)) {
    ElMessage.warning('请至少添加一条销售明细')
    return
  }
  // 赠品二次确认 — 列出具体行号
  const gifts = giftLines()
  if (gifts.length > 0) {
    const productMap = new Map(products.value.map(p => [p.id, p]))
    const lines = gifts.map(g => {
      const p = productMap.get(g.productId)
      return `<tr><td style="padding:4px 12px;">#${g.rowNo}</td><td style="padding:4px 12px;">${p?.code || '-'} ${p?.name || '未知'}</td><td style="padding:4px 12px;text-align:right;">×${g.quantity}</td></tr>`
    }).join('')
    const msg = `<div style="font-size:13px;line-height:1.8;">
      <p>以下 <b style="color:#e6a23c;">${gifts.length}</b> 条明细售价为 0，将被作为<b style="color:#f56c6c;">赠品</b>开单：</p>
      <table style="width:100%;border-collapse:collapse;margin:8px 0;">${lines}</table>
      <p style="color:#999;">请确认是否继续提交？</p>
    </div>`
    try {
      await ElMessageBox.confirm(msg, '赠品确认', {
        dangerouslyUseHTMLString: true,
        confirmButtonText: '确认开单',
        cancelButtonText: '返回修改',
        type: 'warning'
      })
    } catch {
      return
    }
  }
  submitting.value = true
  try {
    if (draft.isDraft.value) {
      await draft.submitDraft()
      ElMessage.success('创建成功')
    } else if (isEdit.value) {
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

// 退货相关 — 生成独立 ReturnOrder
const returnVisible = ref(false)
const returnTarget = ref<SalesOrder | null>(null)
const returnDraft = ref<Array<{ salesItemId: number; productId: number; productName: string; orderedQty: number; returnQty: number }>>([])

const openReturnDialog = (row: any) => {
  returnTarget.value = row
  returnDraft.value = (row.items || []).map((i: any) => ({
    salesItemId: i.id,
    productId: i.productId,
    productName: i.product?.name || `产品#${i.productId}`,
    orderedQty: i.quantity,
    returnQty: 0
  }))
  returnVisible.value = true
}

const handleReturn = async () => {
  const items = returnDraft.value.filter(i => i.returnQty > 0)
  if (items.length === 0) { ElMessage.warning('请填写退货数量'); return }
  submitting.value = true
  try {
    await returnOrderApi.create({
      salesOrderId: returnTarget.value!.id,
      items: items.map(i => ({ salesItemId: i.salesItemId, productId: i.productId, quantity: i.returnQty })),
      remark: ''
    })
    ElMessage.success('退货单已创建，可在退货管理中确认入库')
    returnVisible.value = false
    loadData()
  } catch (e: any) { ElMessage.error(e.message || '退货失败') }
  finally { submitting.value = false }
}

// 退货汇总（计算累计退货量和类型）
const getReturnSummary = (row: any) => {
  const returns = (row.returnOrders || []).filter((r: any) => r.status !== 'cancelled' && r.status !== 'scrapped')
  if (returns.length === 0) return null
  const totalQty = returns.reduce((s: number, r: any) => s + r.totalQuantity, 0)
  const orderQty = row.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
  const isFull = totalQty >= orderQty
  return { totalQty, orderQty, label: isFull ? `已退${totalQty}件(全部)` : `已退${totalQty}件(部分)`, type: isFull ? 'danger' : 'warning' }
}

const returnTagType = (row: any) => getReturnSummary(row)?.type || ''
const returnLabel = (row: any) => getReturnSummary(row)?.label || ''

// 状态流转说明
const statusHelp = {
  confirm: '确认后订单进入"已确认"状态，表示审核通过，可以安排生产或备货。流转条件：客户已确认交期和价格。',
  complete: '完成后订单进入"已完成"状态，表示全部商品已发货完毕。流转条件：所有商品已出库并发货。将扣减成品库存。',
  returned: '退货后订单进入"已退货"状态，成品库存自动回加。填写实际退回数量即可。如需补发可从已退货状态重新确认进入补发流程。',
  reship: '补发后订单回到"已确认"状态，可重新走发货流程。仅从已退货状态可操作。',
}

const handleConfirm = async (row: SalesOrder) => {
  try {
    await ElMessageBox.confirm(
      `确认后将进入"已确认"状态，表示审核通过可以安排生产。确定要确认销售单"${row.orderNo}"吗？`,
      '确认操作',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'info' }
    )
    await salesOrderApi.updateStatus(row.id, 'confirmed')
    ElMessage.success('已确认')
    loadData()
  } catch { /* 取消 */ }
}

const handleComplete = async (row: SalesOrder) => {
  try {
    await ElMessageBox.confirm(
      `完成后将进入"已完成"状态，表示全部商品已发货。确定要完成销售单"${row.orderNo}"吗？`,
      '完成操作',
      { confirmButtonText: '确认完成', cancelButtonText: '取消', type: 'success' }
    )
    await salesOrderApi.updateStatus(row.id, 'completed')
    ElMessage.success('已完成')
    loadData()
  } catch { /* 取消 */ }
}

const goRequirements = (row: SalesOrder) => {
  router.push({ path: '/dashboard/inventory/material-requirements', query: { orderId: row.id } })
}

onMounted(async () => {
  loadData()
  loadDrafts()
  try {
    const res = await productApi.getList({ page: 1, pageSize: 1000 })
    products.value = res.list
  } catch {}
  try {
    const cRes = await customerApi.getList({ page: 1, pageSize: 1000 })
    customers.value = (cRes as any).list || []
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

/* 草稿卡片区 */
.draft-zone {
  margin-bottom: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.draft-zone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-muted);
  border-bottom: 1px solid var(--border-color-light);
}
.draft-zone-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-600);
  color: var(--color-text-primary);
}
.draft-zone-header-actions {
  display: flex;
  gap: var(--space-2);
}
.draft-cards {
  padding: 8px 12px;
}
.draft-card {
  padding: 12px 0;
}
.draft-card + .draft-card {
  border-top: 1px solid var(--border-color-light);
}
.draft-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.draft-card-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.draft-card-no {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-600);
  color: var(--color-primary);
  font-family: 'SF Mono', monospace;
}
.draft-card-party {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}
.draft-card-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.draft-card-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}
</style>
