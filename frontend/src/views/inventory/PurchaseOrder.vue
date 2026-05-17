<template>
  <div class="page-container">
    <div class="page-header">
      <h1>采购管理</h1>
      <div class="page-header-actions">
        <el-button @click="showReport = true">
          <el-icon><DataAnalysis /></el-icon>查看报表
        </el-button>
        <el-button
          type="primary"
          @click="openDialog()"
        >
          <el-icon><Plus /></el-icon>新增采购单
        </el-button>
      </div>
    </div>

    <div
      v-if="drafts.length > 0"
      class="draft-zone"
    >
      <div class="draft-zone-header">
        <span class="draft-zone-title"><el-icon
          :size="16"
          style="margin-right:4px;"
        ><Document /></el-icon>未完成的草稿 · {{ drafts.length }}</span>
        <div class="draft-zone-header-actions">
          <el-button
            link
            type="danger"
            size="small"
            @click="deleteAllDrafts"
          >
            全部删除
          </el-button>
          <el-button
            link
            size="small"
            @click="draftsCollapsed = !draftsCollapsed"
          >
            {{ draftsCollapsed ? '展开 ▼' : '收起 ▲' }}
          </el-button>
        </div>
      </div>
      <div
        v-show="!draftsCollapsed"
        class="draft-cards"
      >
        <div
          v-for="d in drafts"
          :key="d.id"
          class="draft-card"
        >
          <div class="draft-card-body">
            <div class="draft-card-left">
              <span class="draft-card-no">{{ d.orderNo }}</span>
              <span class="draft-card-party">{{ d.supplier?.name || '(未选择供应商)' }}</span>
              <span class="draft-card-meta">{{ d.items?.length || 0 }} 项明细 · ¥{{ (d.totalAmount || 0).toFixed(2) }} · {{ formatDraftTime(d.updatedAt) }}</span>
            </div>
            <div class="draft-card-actions">
              <el-button
                size="small"
                type="primary"
                @click="openDialog(d)"
              >
                继续编辑
              </el-button>
              <el-button
                size="small"
                @click="deleteDraft(d)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
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
          <el-option
            label="草稿"
            value="draft"
          /> <el-option
            label="待确认"
            value="pending"
          />
          <el-option
            label="已确认"
            value="confirmed"
          /> <el-option
            label="已完成"
            value="completed"
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
        :data="tableData"
        stripe
      >
        <el-table-column
          prop="orderNo"
          label="单号"
          width="180"
        />
        <el-table-column
          label="供应商"
          min-width="120"
        >
          <template #default="{ row }">
            {{ row.supplier?.name || (row.status === 'draft' ? '(未选择)' : '') }}
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
        <el-table-column
          label="明细数"
          width="80"
        >
          <template #default="{ row }">
            {{ row.items?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column
          prop="status"
          label="状态"
          width="100"
        >
          <template #default="{ row }">
            <el-tag
              :type="statusType(row.status)"
              size="small"
            >
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="createdAt"
          label="创建时间"
          width="180"
        >
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="280"
         
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="openDialog(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="row.status !== 'completed'"
              link
              type="success"
              @click="openReceiveDialog(row)"
            >
              入库
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              link
              type="warning"
              @click="handleConfirm(row)"
            >
              确认
            </el-button>
            <el-button
              link
              type="danger"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
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

    <PurchaseOrderForm
      v-model="dialogVisible"
      :is-edit="isEdit"
      :edit-id="editId"
      :row="currentRow"
      :suppliers="suppliers"
      :materials="materials"
      @success="onFormSuccess"
    />

    <el-dialog
      v-model="receiveDialogVisible"
      title="采购入库"
      width="600px"
    >
      <el-table
        :data="receiveItems"
        border
        size="small"
      >
        <el-table-column
          label="物料"
          min-width="140"
        >
          <template #default="{ row }">
            {{ row.materialName }}
          </template>
        </el-table-column>
        <el-table-column
          label="采购数量"
          width="100"
        >
          <template #default="{ row }">
            {{ row.quantity }}
          </template>
        </el-table-column>
        <el-table-column
          label="已收数量"
          width="100"
        >
          <template #default="{ row }">
            {{ row.receivedQuantity }}
          </template>
        </el-table-column>
        <el-table-column
          label="本次入库"
          width="120"
        >
          <template #default="{ row }">
            <el-input-number
              v-model="row.receiveQty"
              :min="0"
              :max="row.quantity - row.receivedQuantity"
              size="small"
              style="width:100%"
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="receiveDialogVisible = false">
          取消
        </el-button><el-button
          type="primary"
          :loading="submitting"
          @click="handleReceive"
        >
          确认入库
        </el-button>
      </template>
    </el-dialog>

    <ReportDialog
      v-model="showReport"
      report-type="purchase"
      title="采购报表"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, DataAnalysis, Document } from '@element-plus/icons-vue'
import { purchaseOrderApi, type PurchaseOrder } from '@/api/purchaseOrder'
import { supplierApi, type Supplier } from '@/api/supplier'
import { materialApi, type Material } from '@/api/material'
import ReportDialog from '@/components/ReportDialog.vue'
import PurchaseOrderForm from '@/components/PurchaseOrderForm.vue'
import { useStatusHelpers } from '@/composables/useStatusHelpers'

const showReport = ref(false); const loading = ref(false); const submitting = ref(false)
const tableData = ref<PurchaseOrder[]>([]); const total = ref(0)
const dialogVisible = ref(false); const receiveDialogVisible = ref(false)
const isEdit = ref(false); const editId = ref(0); const currentRow = ref<PurchaseOrder | null>(null)
const suppliers = ref<Supplier[]>([]); const materials = ref<Material[]>([])
const currentReceiveOrderId = ref(0)
const receiveItems = ref<Array<{ itemId: number; materialName: string; quantity: number; receivedQuantity: number; receiveQty: number }>>([])
const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })
const { statusLabel, statusType } = useStatusHelpers()
const formatDate = (d: string) => new Date(d).toLocaleDateString('zh-CN')

// ── 草稿 ──
const drafts = ref<PurchaseOrder[]>([]); const draftsCollapsed = ref(false)
async function loadDrafts() { try { const r = await purchaseOrderApi.getList({ page: 1, pageSize: 50, status: 'draft' }); drafts.value = r.list } catch {} }
async function deleteDraft(d: PurchaseOrder) { try { await ElMessageBox.confirm(`删除草稿"${d.orderNo}"？`, '删除草稿', { type: 'info' }); await purchaseOrderApi.delete(d.id); loadDrafts(); if (queryParams.status === 'draft') loadData() } catch {} }
async function deleteAllDrafts() { try { await ElMessageBox.confirm(`删除全部${drafts.value.length}条草稿？`, '清空草稿', { type: 'warning' }); await Promise.all(drafts.value.map(d => purchaseOrderApi.delete(d.id))); drafts.value = []; if (queryParams.status === 'draft') loadData() } catch {} }
function formatDraftTime(d: string) { const diff = Date.now() - new Date(d).getTime(); if (diff < 60000) return '刚刚'; if (diff < 3600000) return `${Math.floor(diff/60000)}分钟前`; if (diff < 86400000) return `${Math.floor(diff/3600000)}小时前`; return new Date(d).toLocaleDateString('zh-CN') }

// ── 列表 ──
async function loadData() { loading.value = true; try { const [res] = await Promise.all([purchaseOrderApi.getList(queryParams), loadDrafts()]); tableData.value = res.list; total.value = res.total } finally { loading.value = false } }
const handleDelete = async (row: PurchaseOrder) => { await ElMessageBox.confirm(`删除"${row.orderNo}"？`, '确认删除', { type: 'warning' }); await purchaseOrderApi.delete(row.id); ElMessage.success('已删除'); loadData() }
const handleConfirm = async (row: PurchaseOrder) => { await ElMessageBox.confirm(`确认"${row.orderNo}"？`, '确认操作', { type: 'info' }); await purchaseOrderApi.updateStatus(row.id, 'confirmed'); ElMessage.success('已确认'); loadData() }

function openDialog(row?: PurchaseOrder) { currentRow.value = row || null; isEdit.value = !!row && row.status !== 'draft'; editId.value = row?.id || 0; dialogVisible.value = true }
function onFormSuccess() { loadData(); loadDrafts() }

// ── 入库 ──
async function openReceiveDialog(row: PurchaseOrder) { currentReceiveOrderId.value = row.id; const detail = await purchaseOrderApi.getDetail(row.id); receiveItems.value = detail.items.map(i => ({ itemId: i.id!, materialName: `${i.materialCode||''} - ${i.materialName||''}`, quantity: i.quantity, receivedQuantity: i.receivedQuantity || 0, receiveQty: 0 })); receiveDialogVisible.value = true }

async function handleReceive() { const toReceive = receiveItems.value.filter(i => i.receiveQty > 0); if (toReceive.length === 0) { ElMessage.warning('请填写入库数量'); return }; submitting.value = true; try { await purchaseOrderApi.receive(currentReceiveOrderId.value, toReceive.map(i => ({ itemId: i.itemId, receivedQuantity: i.receivedQuantity + i.receiveQty }))); ElMessage.success('入库成功'); receiveDialogVisible.value = false; loadData() } catch (e: any) { ElMessage.error(e.message) } finally { submitting.value = false } }

onMounted(() => { loadData(); loadDrafts(); supplierApi.getList({ page:1, pageSize:1000, status:'active' }).then(r => suppliers.value = r.list).catch(() => {}); materialApi.getList({ page:1, pageSize:1000 }).then(r => materials.value = r.list).catch(() => {}) })
</script>

<style scoped>
.page-container { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.page-header h1 { margin: 0; font-size: var(--font-size-h3); font-weight: var(--font-weight-600); }
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
</style>
