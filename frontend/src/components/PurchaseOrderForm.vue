<template>
  <div class="po-root">
    <!-- ═══ 弹窗模式 ═══ -->
    <el-dialog
      v-if="!inline"
      v-model="visible"
      :title="readonly ? '查看采购单' : (isEdit ? '编辑采购单' : '新增采购单')"
      width="720px"
      @closed="onClosed"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="供应商" prop="supplierId">
          <PartnerSelect v-model="form.supplierId" role="supplier" placeholder="请选择供应商" :disabled="readonly" @change="onPartnerSelected" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="占用库存">
          <el-checkbox v-model="form.reserveInventory" :disabled="readonly">草稿物料占用库存，避免重复采购</el-checkbox>
        </el-form-item>
      </el-form>
      <h4 style="margin:12px 0 8px">采购明细</h4>
      <el-table :data="form.items" border size="small">
        <el-table-column label="#" width="44" align="center"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
        <el-table-column label="物料" min-width="200">
          <template #default="{ row: r }"><el-select v-model="r.materialId" placeholder="选择物料" filterable size="small" style="width:100%"><el-option v-for="m in materials" :key="m.id" :label="`${m.code} - ${m.name}`" :value="m.id" /></el-select></template>
        </el-table-column>
        <el-table-column label="数量" width="120"><template #default="{ row: r }"><el-input-number v-model="r.quantity" :min="1" size="small" style="width:100%" controls-position="right" /></template></el-table-column>
        <el-table-column label="单价" width="130"><template #default="{ row: r }"><el-input-number v-model="r.price" :min="0" :precision="2" size="small" style="width:100%" controls-position="right" /></template></el-table-column>
        <el-table-column label="小计" width="100"><template #default="{ row: r }"><span class="clickable-amount" @click="docReveal.toggle()">{{ maskAmount((r.quantity||0)*(r.price||0), { visible: docReveal.revealed.value }) }}</span></template></el-table-column>
        <el-table-column v-if="!readonly" width="70"><template #default="{ row: r }"><el-button link type="danger" size="small" @click="removeItem(r)">删除</el-button></template></el-table-column>
      </el-table>
      <div v-if="!readonly" style="display:flex;gap:8px;margin-top:8px;"><el-button size="small" @click="addItemRow">+ 添加行</el-button><el-button size="small" @click="batchSelectMaterials">批量选择物料</el-button></div>
      <div style="text-align:right;margin-top:8px;font-size:16px">合计：<b class="clickable-amount" @click="docReveal.toggle()">{{ maskAmount(totalAmount, { visible: docReveal.revealed.value }) }}</b></div>
      <template #footer>
        <div v-if="readonly" style="text-align:right"><el-button @click="visible = false">关闭</el-button></div>
        <div v-else style="display:flex;align-items:center;gap:8px;">
          <span v-if="draft.isDraft.value" style="color:var(--color-text-muted);font-size:12px;margin-right:auto;">{{ draft.isSaving.value ? '保存中...' : `草稿 · ${draft.lastSavedAt.value ? new Date(draft.lastSavedAt.value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : ''}`.trim() }}</span>
          <span v-else style="flex:1;" />
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- ═══ 工作台模式（三组件：表头/明细/表尾） ═══ -->
    <div v-else v-loading="inlineLoading" class="ws-form" @keydown="onWsKeydown">
      <div class="ws-toolbar">
        <DocActionBar order-type="purchase-order" :status="orderId ? orderStatus : 'draft'" :order-id="orderId" :is-locked="orderIsLocked" :readonly="readonly" @action="handleToolbarAction" />
      </div>
      <DocHeader
        :order-id="orderId"
        :order-no="orderNo"
        :status="orderStatus"
        :order-date="orderCreatedAt"
        :locked="orderIsLocked"
        :readonly="readonly"
        :partner-id="form.supplierId"
        partner-label="供应商"
        :partners="suppliers"
        :remark="form.remark"
        :upstream-doc="upstreamOrder"
        default-title="新采购单"
        @update:partner-id="form.supplierId = $event"
        @update:remark="form.remark = $event"
        @partner-change="onPartnerChange"
        @open-upstream="(id) => emit('toolbarAction', 'open-order:' + id)"
      >
        <template #fields>
          <div class="dh-row">
            <div class="dh-cell">
              <span class="dh-label">单据日期</span>
              <span class="dh-line dh-line--lg">{{ orderCreatedAt || '—' }}</span>
            </div>
            <div class="dh-cell">
              <span class="dh-label">单据编号</span>
              <span class="dh-line dh-line--lg">{{ orderNo || '—' }}</span>
            </div>
            <div class="dh-cell">
              <span class="dh-label">状态</span>
              <span class="dh-line">{{ orderId ? statusLabel(orderStatus) : '新单据' }}</span>
            </div>
            <div class="dh-cell dh-cell--partner">
              <span class="dh-label">供应商</span>
              <PartnerSelect v-model="form.supplierId" role="supplier" placeholder="选择供应商" size="small" :disabled="readonly || orderIsLocked || isConfirmed" @change="onPartnerChangeFromSelect" />
            </div>
          </div>
          <div v-if="upstreamOrder" class="dh-row">
            <div class="dh-cell">
              <span class="dh-label">来源单号</span>
              <el-button link type="primary" size="small" @click="emit('toolbarAction', 'open-order:' + upstreamOrder.id)">{{ upstreamOrder.orderNo }}</el-button>
            </div>
          </div>
          <div v-if="selSupplier" class="dh-row" style="padding-top:2px">
            <div class="dh-detail-row">
              <span v-if="selSupplier.contact">联系人：{{ selSupplier.contact }}</span>
              <span v-if="selSupplier.phone">电话：{{ selSupplier.phone }}</span>
              <span v-if="selSupplier.address">地址：{{ selSupplier.address }}</span>
            </div>
          </div>
        </template>
      </DocHeader>

      <DocDetail
        :items="form.items"
        :options="materials"
        item-field="materialId"
        item-label="物料"
        :show-received="orderId > 0 && orderStatus !== 'draft'"
        received-label="已收"
        received-field="receivedQuantity"
        :readonly="readonly || isConfirmed"
        :locked="orderIsLocked || isConfirmed"
        @add-row="addItemRow"
        @remove-row="removeItem"
        @batch-remove="batchRemoveItems"
      >
        <template #modeBarExtra>
          <el-button v-if="!readonly" size="small" @click="batchSelectMaterials">批量导入</el-button>
        </template>
        <template #priceTag="{ row: r }">
          <span v-if="r.materialId > 0 && r.price === 0" class="ws-price-warn">待定价</span>
        </template>
        <template #subtotal="{ amount }">
          <span class="clickable-amount" @click="docReveal.toggle()">{{ maskAmount(amount, { visible: docReveal.revealed.value }) }}</span>
        </template>
      </DocDetail>

      <DocFooter
        :stats="footerStats"
        :draft-hint="draftHint"
        @stat-click="onStatClick"
      >
        <template #statsExtra>
          <template v-if="hasRelatedDocs">
            <el-button v-if="upstreamOrder" link type="primary" size="small" @click="emit('toolbarAction', 'open-order:' + upstreamOrder.id)">{{ upstreamOrder.orderNo }}</el-button>
            <el-button v-for="d in downstreamDocs" :key="d.id" link :type="d.docType === 'payable' ? 'warning' : 'primary'" size="small" @click="emit('toolbarAction', 'open-' + d.docType + ':' + d.id)">{{ d.orderNo }}</el-button>
          </template>
        </template>
      </DocFooter>
    </div>

    <!-- 批量选择物料（两种模式共用） -->
    <el-dialog v-model="batchVisible" title="批量选择物料" width="500px">
      <el-select v-model="batchSelected" multiple filterable placeholder="搜索物料" style="width:100%">
        <el-option v-for="m in materials" :key="m.id" :label="`${m.code} - ${m.name}`" :value="m.id" />
      </el-select>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmBatchMaterials">添加选中物料</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import DocActionBar from './DocActionBar.vue'
import DocHeader from './DocHeader.vue'
import DocDetail from './DocDetail.vue'
import DocFooter, { type FooterStat } from './DocFooter.vue'
import { purchaseOrderApi, type PurchaseOrder } from '@/api/purchaseOrder'
import { partnerApi, type Partner } from '@/api/partner'
import PartnerSelect from './PartnerSelect.vue'
import { materialApi } from '@/api/material'
import { useDraftAutoSave } from '@/composables/useDraftAutoSave'
import { useAmountPrivacy, useReveal } from '@/composables/useAmountPrivacy'

const props = defineProps<{
  modelValue?: boolean; isEdit: boolean; editId: number; row?: PurchaseOrder | null
  suppliers?: any[]; materials?: any[]; readonly?: boolean; inline?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]; success: [orderNo?: string]; cancel: []
  dirty: [boolean]; titleChange: [title: string]; toolbarAction: [key: string]
}>()

const visible = computed({ get: () => props.inline ? true : (props.modelValue ?? false), set: (v) => { if (!props.inline) emit('update:modelValue', v) } })
const submitting = ref(false)
const formRef = ref<FormInstance>()
const batchVisible = ref(false)
const batchSelected = ref<number[]>([])
const orderNo = ref('')
const orderId = ref(0)
const orderStatus = ref('draft')
const orderIsLocked = ref(false)
const isConfirmed = computed(() => orderStatus.value === 'confirmed')
const orderCreatedAt = ref('')
const upstreamOrder = ref<{ id: number; orderNo: string } | null>(null)
const downstreamDocs = ref<Array<{ id: number; orderNo: string; docType: string; status: string; statusLabel: string }>>([])

const statusLabel = (s: string) => ({ draft: '草稿', pending: '待确认', confirmed: '已确认', completed: '已完成' }[s] || s)
const inlineLoading = ref(false)
const receivedTotal = computed(() => form.items.reduce((s: number, i: any) => s + (i.receivedQuantity || 0) * i.price, 0))
const hasRelatedDocs = computed(() => upstreamOrder.value !== null || downstreamDocs.value.length > 0)
const suppliers = ref<any[]>(props.suppliers || [])
const materials = ref<any[]>(props.materials || [])
const selSupplier = ref<Partner | null>(null)
const form = reactive({ supplierId: 0, remark: '', reserveInventory: true, items: [] as Array<{ materialId: number; quantity: number; price: number; _fresh?: boolean }> })
const rules: FormRules = { supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }] }
const totalAmount = computed(() => form.items.reduce((s: number, i: any) => s + i.quantity * i.price, 0))
const draft = useDraftAutoSave(purchaseOrderApi as any, form as any, 'supplierId', 'materialId')
const { maskAmount } = useAmountPrivacy()
const docReveal = useReveal()

// ── 表尾统计 ──
const footerStats = computed<FooterStat[]>(() => [
  { label: '合计', value: maskAmount(totalAmount.value, { visible: docReveal.revealed.value }), primary: true, clickable: true },
  { label: '数量', value: String(form.items.reduce((s: number, i: any) => s + i.quantity, 0)) },
  { label: '已收', value: '¥' + receivedTotal.value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  { label: '未收', value: '¥' + (totalAmount.value - receivedTotal.value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
])
const draftHint = computed(() => {
  if (!draft.isDraft.value) return ''
  if (draft.isSaving.value) return '保存中...'
  const t = draft.lastSavedAt.value
  return '草稿 · ' + (t ? new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '')
})

function onStatClick(label: string) { if (label === '合计') docReveal.toggle() }
function onPartnerSelected(partner: Partner | null) {
  selSupplier.value = partner
  if (partner) {
    const f = form as Record<string, any>
    for (const cv of partner.customFieldValues || []) {
      const k = cv.field.key
      const cur = f[k]
              if (cur === undefined || cur === '' || cur === 0 || cur === false || cur === null) {
        f[k] = cv.value
      }
    }
  }
}
function onPartnerChangeFromSelect(partner: Partner | null) {
  selSupplier.value = partner
  if (partner) {
    const f = form as Record<string, any>
    for (const cv of partner.customFieldValues || []) {
      const k = cv.field.key
      const cur = f[k]
              if (cur === undefined || cur === '' || cur === 0 || cur === false || cur === null) {
        f[k] = cv.value
      }
    }
  }
  const hasData = form.items.some((i: any) => i.materialId > 0)
  if (!hasData) return
  ElMessageBox.confirm('切换供应商将清空已有明细，是否继续？', '确认切换', { type: 'warning' })
    .then(() => { form.items = [{ materialId: 0, quantity: 1, price: 0 }] })
    .catch(() => {})
}
function onPartnerChange() {
  if (!form.supplierId) { selSupplier.value = null; return }
  partnerApi.getDetail(form.supplierId).then(p => { selSupplier.value = p }).catch(() => {})
}
async function handleToolbarAction(key: string) {
  if (key === 'new') { emit('cancel'); return }
  if (key === 'save-draft') { handleSaveDraft(); return }
  if (key === 'submit') { handleSubmit(); return }
  // 状态操作
  if ((key === 'confirm' || key === 'complete' || key === 'unconfirm' || key === 'uncomplete') && orderId.value) {
    const statusMap: Record<string, string> = { confirm: 'confirmed', complete: 'completed', unconfirm: 'pending', uncomplete: 'confirmed' }
    const labelMap: Record<string, string> = { confirm: '审核通过', complete: '完成', unconfirm: '反确认', uncomplete: '反完成' }
    try { await ElMessageBox.confirm(`确定${labelMap[key]}该单据？`, '操作确认', { type: 'info' }) } catch { return }
    try { await purchaseOrderApi.updateStatus(orderId.value, statusMap[key]); ElMessage.success(`已${labelMap[key]}`); loadOrderDetail() } catch (e: any) { ElMessage.error(e.message) }
    return
  }
  if (key === 'delete' && orderId.value) {
    try { await ElMessageBox.confirm('确定作废该单据？作废后可在作废单据中恢复。', '作废确认', { type: 'warning', confirmButtonText: '作废', cancelButtonText: '取消' }) }
    catch { return }
    try {
      await purchaseOrderApi.delete(orderId.value)
      ElMessage.success('已作废')
      draft.stopAutoSave()
      emit('cancel')
    } catch (e: any) { ElMessage.error(e.message || '作废失败') }
    return
  }
  emit('toolbarAction', key)
}

function onWsKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSubmit() }
  else if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSubmit() }
  else if (e.key === 'Enter' && !['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)) { addItemRow() }
}

async function loadRefData() {
  if (!props.inline) return
  try { const m = await materialApi.getList({ page: 1, pageSize: 200 }); materials.value = m.list } catch { /* 忽略 */ }
}
async function loadOrderDetail() {
  if (!props.inline || !props.editId) return
  inlineLoading.value = true
  try {
    const detail = await purchaseOrderApi.getDetail(props.editId)
    form.supplierId = detail.supplierId || 0; form.remark = detail.remark || ''
    form.reserveInventory = detail.reserveInventory !== undefined ? detail.reserveInventory : true
    form.items = detail.items?.map((i: any) => ({ materialId: i.materialId, quantity: i.quantity, price: i.price })) || [{ materialId: 0, quantity: 1, price: 0 }]
    orderNo.value = detail.orderNo || ''; orderId.value = detail.id || 0; orderStatus.value = detail.status || 'draft'
    orderCreatedAt.value = detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('zh-CN') : ''
    orderIsLocked.value = (detail as any).payableItems?.some((pi: any) => ['pending', 'approved'].includes(pi.payable?.status)) || false
    upstreamOrder.value = (detail as any).salesOrder ? { id: (detail as any).salesOrder.id, orderNo: (detail as any).salesOrder.orderNo } : null
    downstreamDocs.value = ((detail as any).payableItems || []).filter((pi: any) => pi.payable).map((pi: any) => ({ id: pi.payable.id, orderNo: pi.payable.orderNo, docType: 'payable', status: pi.payable.status, statusLabel: pi.payable.status === 'approved' ? '已审核' : '待审核' }))
    emit('titleChange', '采购单 - ' + (detail.orderNo || '新建'))
    if (detail.status === 'draft') draft.initAutoSave({ id: detail.id } as any)
  } catch { ElMessage.error('加载单据详情失败') } finally { inlineLoading.value = false }
}
function initDialogForm() {
  form.supplierId = props.row?.supplierId || 0; form.remark = props.row?.remark || ''
  form.reserveInventory = props.row?.reserveInventory !== undefined ? props.row.reserveInventory : true
  form.items = props.row?.items?.map((i: any) => ({ materialId: i.materialId, quantity: i.quantity, price: i.price })) || [{ materialId: 0, quantity: 1, price: 0 }]
  if (props.row?.status === 'draft' || !props.row) draft.initAutoSave(props.row || null); else draft.stopAutoSave()
}
watch(() => props.modelValue, (val) => { if (!props.inline && val) initDialogForm() })
onMounted(() => { if (props.inline) { loadRefData(); loadOrderDetail().then(() => { if (!props.editId) draft.initAutoSave(null) }) } })
watch(() => ({ s: form.supplierId, r: form.remark, len: form.items.length }), () => { if (props.inline) emit('dirty', form.supplierId > 0 || form.remark.trim() !== '' || form.items.some((i: any) => i.materialId > 0)) }, { deep: true, immediate: false })
function onClosed() { draft.stopAutoSave(); if (draft.draftId.value && !draft.hasMeaningfulContent()) draft.discardDraft() }
function addItemRow() { form.items.push({ materialId: 0, quantity: 1, price: 0, _fresh: true }) }
async function removeItem(row: any) {
  if (!row._fresh) {
    try { await ElMessageBox.confirm('确定删除该行明细？', '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  }
  const i = form.items.indexOf(row); if (i >= 0) form.items.splice(i, 1)
}

function batchRemoveItems(rows: any[]) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const idx = form.items.indexOf(rows[i])
    if (idx >= 0) form.items.splice(idx, 1)
  }
  if (form.items.length === 0) addItemRow()
}
async function handleSaveDraft() { try { await draft.saveAsDraft(); ElMessage.success('草稿已保存'); if (!props.inline) visible.value = false } catch (e: any) { ElMessage.error(e.message) } }
async function handleSubmit() {
  await formRef.value?.validate()
  if (form.items.length === 0 || form.items.every((i: any) => !i.materialId)) { ElMessage.warning('请至少添加一条采购明细'); return }
  submitting.value = true
  try {
    let resultOrderNo = ''
    if (draft.isDraft.value) { const r = await draft.submitDraft(); resultOrderNo = r?.orderNo || ''; ElMessage.success('创建成功') }
    else if (props.isEdit) { await purchaseOrderApi.update(props.editId, { ...form } as any); ElMessage.success('更新成功') }
    else { const r = await purchaseOrderApi.create({ supplierId: form.supplierId, items: form.items, remark: form.remark }); resultOrderNo = r?.orderNo || ''; ElMessage.success('创建成功') }
    if (props.inline) emit('success', resultOrderNo || orderNo.value); else { visible.value = false; emit('success') }
  } catch (e: any) { ElMessage.error(e.message || '操作失败') } finally { submitting.value = false }
}
const batchSelectMaterials = () => { batchSelected.value = []; batchVisible.value = true }
const confirmBatchMaterials = () => { if (batchSelected.value.length === 0) { ElMessage.warning('请选择物料'); return }; for (const mid of batchSelected.value) form.items.push({ materialId: mid, quantity: 1, price: 0 }); batchVisible.value = false }

</script>

<style>
@import '@/styles/inline-form.css';
.po-root { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
</style>
<style scoped>
</style>
