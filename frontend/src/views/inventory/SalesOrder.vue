<template>
  <div class="page-container">
    <div class="page-header">
      <h1>销售管理</h1>
      <div class="page-header-actions">
        <el-button @click="showReport = true"><el-icon><DataAnalysis /></el-icon>查看报表</el-button>
        <el-button @click="router.push('/dashboard/inventory/return-orders')"><el-icon><RefreshLeft /></el-icon>退货管理</el-button>
        <el-button type="primary" @click="openTabNew()"><el-icon><Plus /></el-icon>新增销售单</el-button>
      </div>
    </div>

    <div class="flow-progress">
      <div v-for="(s, i) in flowMilestones" :key="i" class="flow-progress-item">
        <div class="flow-progress-dot" :class="{ active: s.active }" />
        <span class="flow-progress-label">{{ s.label }}</span>
        <span v-if="i < flowMilestones.length - 1" class="flow-progress-line" :class="{ active: s.active }" />
      </div>
    </div>

    <div v-if="drafts.length > 0" class="draft-zone">
      <div class="draft-zone-header">
        <span class="draft-zone-title"><el-icon :size="16" style="margin-right:4px;"><Document /></el-icon>未完成的草稿 · {{ drafts.length }}</span>
        <div class="draft-zone-header-actions">
          <el-button link type="danger" size="small" @click="deleteAllDrafts">全部删除</el-button>
          <el-button link size="small" @click="draftsCollapsed = !draftsCollapsed">{{ draftsCollapsed ? '展开 ▼' : '收起 ▲' }}</el-button>
        </div>
      </div>
      <div v-show="!draftsCollapsed" class="draft-cards">
        <div v-for="d in drafts" :key="d.id" class="draft-card">
          <div class="draft-card-body">
            <div class="draft-card-left">
              <span class="draft-card-no">{{ d.orderNo }}</span>
              <span class="draft-card-party">{{ d.customer?.name || '(未选择客户)' }}</span>
              <span class="draft-card-meta">{{ d.items?.length || 0 }} 项明细 · <span class="clickable-amount" @click.stop="toggleRowReveal(d.id)">{{ maskAmount(d.totalAmount || 0, { visible: rowRevealed[d.id] }) }}</span> · {{ formatDraftTime(d.updatedAt) }}</span>
            </div>
            <div class="draft-card-actions">
              <el-button size="small" type="primary" @click="openTabEdit(d)">继续编辑</el-button>
              <el-button size="small" @click="deleteDraft(d)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input v-model="queryParams.keyword" placeholder="搜索单号或客户" clearable style="width:240px" @keyup.enter="loadData" />
        <el-select v-model="queryParams.status" placeholder="状态" clearable style="width:120px" @change="loadData">
          <el-option label="草稿" value="draft" /> <el-option label="待确认" value="pending" />
          <el-option label="已确认" value="confirmed" /> <el-option label="已完成" value="completed" />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="orderNo" label="单号" width="180" />
        <el-table-column label="客户" min-width="120"><template #default="{ row }">{{ row.customer?.name || (row.status === 'draft' ? '(未选择)' : '') }}</template></el-table-column>
        <el-table-column label="总金额" width="120"><template #default="{ row }"><span class="clickable-amount" @click="toggleRowReveal(row.id)">{{ maskAmount(row.totalAmount, { visible: rowRevealed[row.id] }) }}</span></template></el-table-column>
        <el-table-column label="状态" width="170">
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              <el-tag v-if="getReturnSummary(row)" :type="returnTagType(row)" size="small">{{ returnLabel(row) }}</el-tag>
              <el-tag v-if="isOrderLocked(row)" type="danger" size="small">已锁定</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180"><template #default="{ row }">{{ new Date(row.createdAt).toLocaleDateString('zh-CN') }}</template></el-table-column>
        <el-table-column label="操作" width="400">
          <template #default="{ row }">
            <template v-if="isOrderLocked(row)">
              <el-tooltip :content="`已被应收单 ${getLockedReceivableNo(row)} 锁定`" placement="top">
                <span style="margin-right:4px"><el-tag type="danger" size="small">锁定</el-tag></span>
              </el-tooltip>
              <el-button link type="primary" @click="openTabView(row)">查看</el-button>
              <el-button v-if="row.status === 'pending'" link type="warning" @click="handleConfirm(row)">确认<el-tooltip placement="top" :content="statusHelp.confirm"><el-icon :size="12" style="margin-left:2px;"><QuestionFilled /></el-icon></el-tooltip></el-button>
              <el-button v-if="row.status === 'confirmed'" link type="success" @click="handleComplete(row)">完成<el-tooltip placement="top" :content="statusHelp.complete"><el-icon :size="12" style="margin-left:2px;"><QuestionFilled /></el-icon></el-tooltip></el-button>
              <el-button v-if="row.status === 'confirmed' || row.status === 'completed'" link type="danger" @click="openReturnDialog(row)">退货</el-button>
              <el-button link type="success" @click="goRequirements(row)">物料需求</el-button>
              <el-button link type="info" @click="openFlowDialog(row)"><el-icon style="margin-right:2px"><Connection /></el-icon>流转</el-button>
            </template>
            <template v-else>
            <el-button link type="primary" @click="openTabEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'pending'" link type="warning" @click="handleConfirm(row)">确认<el-tooltip placement="top" :content="statusHelp.confirm"><el-icon :size="12" style="margin-left:2px;"><QuestionFilled /></el-icon></el-tooltip></el-button>
            <el-button v-if="row.status === 'confirmed'" link type="success" @click="handleComplete(row)">完成<el-tooltip placement="top" :content="statusHelp.complete"><el-icon :size="12" style="margin-left:2px;"><QuestionFilled /></el-icon></el-tooltip></el-button>
            <el-button v-if="row.status === 'confirmed' || row.status === 'completed'" link type="danger" @click="openReturnDialog(row)">退货<el-tooltip placement="top" :content="statusHelp.returned"><el-icon :size="12" style="margin-left:2px;"><QuestionFilled /></el-icon></el-tooltip></el-button>
            <el-button link type="success" @click="goRequirements(row)">物料需求</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="queryParams.page" v-model:page-size="queryParams.pageSize" :total="total" layout="total, prev, pager, next" @current-change="loadData" style="margin-top:16px;justify-content:flex-end" />
    </el-card>

    <SalesOrderForm v-model="dialogVisible" :is-edit="isEdit" :edit-id="editId" :row="currentRow" :customers="customers" :products="products" :readonly="formReadonly" @success="onFormSuccess" />

    <el-dialog v-model="returnVisible" title="新建退货单" width="600px">
      <div style="margin-bottom:8px;color:var(--color-text-muted);font-size:12px;">关联销货单：{{ returnTarget?.orderNo }} | 客户：{{ returnTarget?.customer?.name }}</div>
      <el-table :data="returnDraft" border size="small">
        <el-table-column label="产品" min-width="160"><template #default="{ row }">{{ row.productName }}</template></el-table-column>
        <el-table-column label="订单数量" width="100"><template #default="{ row }">{{ row.orderedQty }}</template></el-table-column>
        <el-table-column label="退货数量" width="150"><template #default="{ row }"><el-input-number v-model="row.returnQty" :min="0" :max="row.orderedQty" size="small" style="width:100%" /></template></el-table-column>
      </el-table>
      <div style="color:var(--color-text-muted);font-size:12px;margin-top:8px;">退货单创建后可在「退货管理」中确认入库，入库时自动回加成品库存。</div>
      <template #footer><el-button @click="returnVisible = false">取消</el-button><el-button type="danger" :loading="submitting" @click="handleReturn">生成退货单</el-button></template>
    </el-dialog>

    <el-dialog v-model="flowDialogVisible" title="单据流转记录" width="550px">
      <div class="flow-timeline">
        <div class="flow-node">
          <div class="flow-dot current" />
          <div class="flow-content">
            <div class="flow-label">销售单</div>
            <div class="flow-no">{{ flowOrder?.orderNo }}</div>
            <div style="display:flex;gap:8px;align-items:center">
              <el-tag :type="flowOrder ? statusType(flowOrder.status) : 'info'" size="small">{{ flowOrder ? statusLabel(flowOrder.status) : '' }}</el-tag>
              <span v-if="flowOrder" class="flow-amount">{{ maskAmount(flowOrder.totalAmount) }}</span>
            </div>
            <div class="flow-time">{{ flowOrder ? new Date(flowOrder.createdAt).toLocaleDateString('zh-CN') : '' }}</div>
          </div>
        </div>
        <div v-if="flowOrder?.receivableItems?.length" class="flow-connector">
          <span class="flow-arrow">→ 应收单锁定</span>
        </div>
        <div v-for="ri in (flowOrder?.receivableItems || [])" :key="ri.id" class="flow-node">
          <div class="flow-dot" :class="ri.receivable?.status === 'approved' ? 'approved' : 'pending'" />
          <div class="flow-content">
            <div class="flow-label">应收单</div>
            <el-button link type="primary" class="flow-no-link" @click="goToReceivableFromFlow(ri.receivable?.id)">
              {{ ri.receivable?.orderNo }}
            </el-button>
            <el-tag :type="ri.receivable?.status === 'approved' ? 'success' : 'warning'" size="small">{{ ri.receivable?.status === 'approved' ? '已审核' : '待审核' }}</el-tag>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="flowDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <ReportDialog v-model="showReport" report-type="sales" title="销售报表" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, DataAnalysis, Document, QuestionFilled, RefreshLeft, Connection } from '@element-plus/icons-vue'
import { salesOrderApi, type SalesOrder } from '@/api/salesOrder'
import { returnOrderApi } from '@/api/returnOrder'
import ReportDialog from '@/components/ReportDialog.vue'
import SalesOrderForm from '@/components/SalesOrderForm.vue'
import { useStatusHelpers } from '@/composables/useStatusHelpers'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'
import { useTabStore } from '@/stores/tabs'

const showReport = ref(false)
const router = useRouter()
const route = useRoute()
const tabStore = useTabStore()
const loading = ref(false)
const submitting = ref(false)
const tableData = ref<SalesOrder[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const currentRow = ref<SalesOrder | null>(null)
const customers = ref<any[]>([])
const products = ref<any[]>([])
const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })
const { statusLabel, statusType, statusHelp } = useStatusHelpers()
const { maskAmount } = useAmountPrivacy()

const rowRevealed = reactive<Record<number, boolean>>({})
const toggleRowReveal = (id: number) => { rowRevealed[id] = !rowRevealed[id] }

const flowMilestones = ref([{ label: '销售下单', active: false }, { label: '物料需求', active: false }, { label: '采购到货', active: false }, { label: '生产报工', active: false }, { label: '成品入库', active: false }])

// ── 草稿 ──
const draftCount = ref(0); const drafts = ref<SalesOrder[]>([]); const draftsCollapsed = ref(false)

async function loadDrafts() { try { const r = await salesOrderApi.getList({ page: 1, pageSize: 50, status: 'draft' }); drafts.value = r.list; draftCount.value = r.total } catch {} }

async function deleteDraft(d: SalesOrder) {
  try { await ElMessageBox.confirm(`确定要删除草稿"${d.orderNo}"吗？`, '删除草稿', { type: 'info', confirmButtonText: '删除' }); await salesOrderApi.delete(d.id); ElMessage.success('已删除'); loadDrafts(); if (queryParams.status === 'draft') loadData() } catch {}
}

async function deleteAllDrafts() {
  try { await ElMessageBox.confirm(`确定要删除全部 ${drafts.value.length} 条草稿吗？`, '删除全部草稿', { type: 'warning', confirmButtonText: '全部删除' }); await Promise.all(drafts.value.map(d => salesOrderApi.delete(d.id))); ElMessage.success('已清空'); drafts.value = []; draftCount.value = 0; if (queryParams.status === 'draft') loadData() } catch {}
}

function formatDraftTime(d: string) { const diff = Date.now() - new Date(d).getTime(); if (diff < 60000) return '刚刚'; if (diff < 3600000) return `${Math.floor(diff/60000)}分钟前`; if (diff < 86400000) return `${Math.floor(diff/3600000)}小时前`; return new Date(d).toLocaleDateString('zh-CN') }

// ── 列表 ──
const loadData = async () => {
  loading.value = true
  try { const [res, dr] = await Promise.all([salesOrderApi.getList(queryParams), salesOrderApi.getList({ page:1, pageSize:1, status:'draft' })]); tableData.value = res.list; total.value = res.total; draftCount.value = dr.total } finally { loading.value = false }
}

const handleDelete = async (row: SalesOrder) => { await ElMessageBox.confirm(`确定要删除"${row.orderNo}"吗？`, '确认删除', { type: 'warning' }); await salesOrderApi.delete(row.id); ElMessage.success('已删除'); loadData() }
const handleConfirm = async (row: SalesOrder) => { await ElMessageBox.confirm(`确认"${row.orderNo}"审核通过？`, '确认操作', { type: 'info' }); await salesOrderApi.updateStatus(row.id, 'confirmed'); ElMessage.success('已确认'); loadData() }
const handleComplete = async (row: SalesOrder) => { await ElMessageBox.confirm(`确认"${row.orderNo}"全部发货完毕？`, '完成操作', { type: 'success' }); await salesOrderApi.updateStatus(row.id, 'completed'); ElMessage.success('已完成'); loadData() }
const goRequirements = (row: SalesOrder) => router.push({ path: '/dashboard/inventory/material-requirements', query: { orderId: row.id } })

// ── 表单（Tab 方式） ──
const formReadonly = ref(false)
function openTabNew() { tabStore.addTab('sales-order', '销货单 - 新建', {}) }
function openTabEdit(row: SalesOrder) { tabStore.addTab('sales-order', '销货单 - ' + row.orderNo, { orderId: row.id, isEdit: true }) }
function openTabView(row: SalesOrder) { tabStore.addTab('sales-order', '销货单 - ' + row.orderNo, { orderId: row.id, readonly: true }) }

watch(
  () => ({ path: route.path, activeTabId: tabStore.activeTabId }),
  () => { if (route.path === '/dashboard/inventory/sales-orders' && !tabStore.activeTabId) loadData() }
)

function onFormSuccess() { formReadonly.value = false; loadData(); loadDrafts() }

// ── 退货 ──
const returnVisible = ref(false); const returnTarget = ref<SalesOrder | null>(null)
const returnDraft = ref<Array<{ salesItemId: number; productId: number; productName: string; orderedQty: number; returnQty: number }>>([])

function openReturnDialog(row: any) { returnTarget.value = row; returnDraft.value = (row.items || []).map((i: any) => ({ salesItemId: i.id, productId: i.productId, productName: i.product?.name||`产品#${i.productId}`, orderedQty: i.quantity, returnQty: 0 })); returnVisible.value = true }

async function handleReturn() { const items = returnDraft.value.filter((i: any) => i.returnQty > 0); if (items.length === 0) { ElMessage.warning('请填写退货数量'); return }; submitting.value = true; try { await returnOrderApi.create({ salesOrderId: returnTarget.value!.id, items: items.map((i: any) => ({ salesItemId: i.salesItemId, productId: i.productId, quantity: i.returnQty })), remark: '' }); ElMessage.success('退货单已创建'); returnVisible.value = false; loadData() } catch (e: any) { ElMessage.error(e.message) } finally { submitting.value = false } }

const getReturnSummary = (row: any) => { const returns = (row.returnOrders||[]).filter((r: any) => r.status !== 'cancelled' && r.status !== 'scrapped'); if (returns.length === 0) return null; const t = returns.reduce((s: number, r: any) => s + r.totalQuantity, 0); const o = row.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0; return { label: t >= o ? `已退${t}件(全部)` : `已退${t}件(部分)`, type: t >= o ? 'danger' : 'warning' } }
const returnTagType = (row: any) => getReturnSummary(row)?.type || ''
const returnLabel = (row: any) => getReturnSummary(row)?.label || ''
const getLockedReceivableNo = (row: any) => row.receivableItems?.find((ri: any) => ['pending', 'approved'].includes(ri.receivable?.status))?.receivable?.orderNo || ''
const isOrderLocked = (row: any) => row.receivableItems?.some((ri: any) => ['pending', 'approved'].includes(ri.receivable?.status))

const flowDialogVisible = ref(false)
const flowOrder = ref<SalesOrder | null>(null)
const openFlowDialog = (row: SalesOrder) => { flowOrder.value = row; flowDialogVisible.value = true }
const goToReceivableFromFlow = (id: number) => { if (id) { flowDialogVisible.value = false; router.push(`/dashboard/finance/receivables`) } }

onMounted(async () => { loadData(); loadDrafts() })
</script>

<style scoped>
.page-container { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.page-header h1 { margin: 0; font-size: var(--font-size-h3); font-weight: var(--font-weight-600); }
.flow-progress { display: flex; align-items: center; padding: 12px 16px; background: var(--bg-elevated); border-radius: 8px; margin-bottom: var(--space-4); overflow-x: auto; }
.flow-progress-item { display: flex; align-items: center; flex-shrink: 0; }
.flow-progress-dot { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; flex-shrink: 0; }
.flow-progress-dot.active { background: #10b981; }
.flow-progress-label { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-left: 6px; white-space: nowrap; }
.flow-progress-dot.active + .flow-progress-label { color: var(--color-text-primary); font-weight: 500; }
.flow-progress-line { display: inline-block; width: 24px; height: 1px; background: #d1d5db; margin: 0 8px; flex-shrink: 0; }
.flow-progress-line.active { background: #10b981; }
.filter-bar { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
.draft-zone { margin-bottom: var(--space-4); background: var(--bg-surface); border: 1px solid var(--border-color-light); border-radius: var(--radius-lg); overflow: hidden; }
.draft-zone-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: var(--bg-muted); border-bottom: 1px solid var(--border-color-light); }
.draft-zone-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-600); }
.draft-zone-header-actions { display: flex; gap: var(--space-2); }
.draft-cards { padding: 8px 12px; }
.draft-card { padding: 12px 0; }
.draft-card + .draft-card { border-top: 1px solid var(--border-color-light); }
.draft-card-body { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.draft-card-left { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.draft-card-no { font-size: var(--font-size-sm); font-weight: var(--font-weight-600); color: var(--color-primary); font-family: 'SF Mono', monospace; }
.draft-card-party { font-size: var(--font-size-sm); color: var(--color-text-primary); }
.draft-card-meta { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.draft-card-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }

.clickable-amount {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s;
  display: inline-block;
}
.clickable-amount:hover {
  background-color: var(--el-fill-color-light);
}

.flow-timeline { padding: 8px 0; }
.flow-node { display: flex; align-items: flex-start; gap: 12px; padding: 8px 0; }
.flow-dot { width: 12px; height: 12px; border-radius: 50%; background: #d1d5db; flex-shrink: 0; margin-top: 4px; }
.flow-dot.current { background: var(--color-primary); }
.flow-dot.approved { background: #10b981; }
.flow-dot.pending { background: #f59e0b; }
.flow-content { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.flow-label { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.flow-no { font-family: 'SF Mono', monospace; font-size: var(--font-size-sm); font-weight: var(--font-weight-600); }
.flow-no-link { font-family: 'SF Mono', monospace; font-size: var(--font-size-sm); padding: 0; height: auto; justify-content: flex-start; }
.flow-amount { font-size: var(--font-size-sm); color: var(--color-text-primary); }
.flow-time { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.flow-connector { display: flex; align-items: center; padding: 4px 0 4px 17px; }
.flow-arrow { font-size: var(--font-size-xs); color: var(--color-text-muted); background: var(--bg-muted); padding: 2px 12px; border-radius: var(--radius-sm); }
</style>
