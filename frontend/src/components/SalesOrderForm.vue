<template>
  <div class="so-root">
    <!-- ═══ 弹窗模式 ═══ -->
    <el-dialog
      v-if="!inline"
      v-model="visible"
      :title="readonly ? '查看销售单' : (isEdit ? '编辑销售单' : '新增销售单')"
      width="720px"
      @closed="onClosed"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="客户" prop="customerId">
          <el-select v-model="form.customerId" placeholder="请选择客户" filterable style="width:100%" :disabled="readonly">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" placeholder="可选" :disabled="readonly" /></el-form-item>
        <el-form-item label="占用库存"><el-checkbox v-model="form.reserveInventory" :disabled="readonly">草稿商品占用库存，避免超卖</el-checkbox></el-form-item>
      </el-form>
      <h4 style="margin:12px 0 8px">销售明细</h4>
      <el-table :data="form.items" border size="small">
        <el-table-column label="#" width="44" align="center"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
        <el-table-column label="产品" min-width="200">
          <template #default="{ row: r }"><el-select v-model="r.productId" placeholder="选择产品" filterable size="small" style="width:100%" :disabled="readonly" @change="onProductChange($event, r)"><el-option v-for="p in products" :key="p.id" :label="`${p.code} - ${p.name}`" :value="p.id" /></el-select></template>
        </el-table-column>
        <el-table-column label="数量" width="120"><template #default="{ row: r }"><el-input-number v-model="r.quantity" :min="1" size="small" style="width:100%" controls-position="right" :disabled="readonly" /></template></el-table-column>
        <el-table-column label="单价" width="150">
          <template #default="{ row: r }">
            <div style="display:flex;align-items:center;gap:4px;">
              <el-input-number v-model="r.price" :min="0" :precision="2" size="small" style="width:100%" controls-position="right" :disabled="readonly" />
              <el-tag v-if="r.productId > 0 && r.price === 0" type="danger" size="small" effect="dark">赠品</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="小计" width="100"><template #default="{ row: r }"><span :style="{ color: docReveal.revealed.value && r.productId > 0 && r.price === 0 ? 'var(--color-danger)' : '' }" class="clickable-amount" @click="docReveal.toggle()">{{ maskAmount((r.quantity||0)*(r.price||0), { visible: docReveal.revealed.value }) }}</span></template></el-table-column>
        <el-table-column v-if="!readonly" width="70"><template #default="{ row: r }"><el-button link type="danger" size="small" @click="removeItem(r)">删除</el-button></template></el-table-column>
      </el-table>
      <div v-if="!readonly" style="display:flex;gap:8px;margin-top:8px;"><el-button size="small" @click="addItemRow">+ 添加行</el-button><el-button size="small" @click="batchSelectProducts">批量选择产品</el-button></div>
      <div style="text-align:right;margin-top:8px;font-size:16px">合计：<b class="clickable-amount" @click="docReveal.toggle()">{{ maskAmount(totalAmount, { visible: docReveal.revealed.value }) }}</b></div>
      <template #footer>
        <div v-if="readonly" style="text-align:right"><el-button @click="visible = false">关闭</el-button></div>
        <div v-else style="display:flex;align-items:center;gap:8px;">
          <span v-if="draft.isDraft.value" style="color:var(--color-text-muted);font-size:12px;margin-right:auto;">{{ draft.isSaving.value ? '保存中...' : `草稿 · ${draft.lastSavedAt.value ? new Date(draft.lastSavedAt.value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : ''}`.trim() }}</span>
          <span v-else style="flex:1;" />
          <el-button @click="visible = false">取消</el-button>
          <el-button :loading="draft.isSaving.value" @click="handleSaveDraft">保存草稿</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- ═══ 工作台模式（三组件：表头/明细/表尾） ═══ -->
    <div v-else v-loading="inlineLoading" class="ws-form" @keydown="onWsKeydown">
      <!-- 功能栏（表头上方） -->
      <div v-if="orderId" class="ws-toolbar">
        <DocActionBar order-type="sales-order" :status="orderStatus" :order-id="orderId" :is-locked="orderIsLocked" :readonly="readonly" @action="(key) => handleToolbarAction(key)" />
      </div>

      <DocHeader
        :order-id="orderId"
        :order-no="orderNo"
        :status="orderStatus"
        :order-date="orderCreatedAt"
        :locked="orderIsLocked"
        :readonly="readonly"
        :partner-id="form.customerId"
        partner-label="客户"
        :partners="customers"
        :remark="form.remark"
        default-title="新销货单"
        @update:partner-id="form.customerId = $event"
        @update:remark="form.remark = $event"
        @partner-change="onPartnerChange"
      >
        <template #fields>
          <!-- 动态字段行（Grid 等宽排布） -->
          <div
            v-for="(group, idx) in fieldGroups"
            :key="idx"
            class="dh-row"
            :class="{ 'dh-row--full': group.length === 1 && group[0].fullRow }"
            :style="(group.length === 1 && group[0].fullRow) ? '' : { gridTemplateColumns: `repeat(${group.length}, 1fr)` }"
          >
            <div v-for="field in group" :key="field.key" class="dh-cell" :class="{ 'dh-cell--partner': field.key === 'customerId' }" :style="field.fullRow ? 'flex:1' : ''">
              <!-- 只读展示 -->
              <template v-if="field.type === 'display'">
                <span class="dh-label">{{ field.label }}</span>
                <span class="dh-line dh-line--lg">{{ fieldValue(field) }}</span>
              </template>
              <!-- 复选框 -->
              <template v-else-if="field.type === 'checkbox'">
                <el-checkbox v-model="form[field.key]" :disabled="readonly || orderIsLocked">{{ field.label }}</el-checkbox>
              </template>
              <!-- 日期选择 -->
              <template v-else-if="field.type === 'date'">
                <span class="dh-label">{{ field.label }}</span>
                <el-date-picker v-model="form[field.key]" type="date" value-format="YYYY-MM-DD" placeholder="" size="small" :disabled="readonly || orderIsLocked" />
              </template>
              <!-- 下拉选择 -->
              <template v-else-if="field.type === 'select'">
                <span class="dh-label">{{ field.label }}</span>
                <el-select v-if="field.key === 'customerId'" :model-value="form.customerId" @update:model-value="form.customerId = $event" placeholder="选择客户" filterable size="small" :disabled="readonly || orderIsLocked" @change="onPartnerChange">
                  <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
                </el-select>
                <el-select v-else v-model="form[field.key]" placeholder="" size="small" :disabled="readonly || orderIsLocked" clearable>
                  <el-option v-for="opt in (field.options || [])" :key="opt" :label="opt" :value="opt" />
                </el-select>
              </template>
              <!-- 数字输入 -->
              <template v-else-if="field.type === 'number'">
                <span class="dh-label">{{ field.label }}</span>
                <el-input-number v-model="form[field.key]" :min="0" :max="field.key === 'wholeDiscount' ? 100 : 9999999" :precision="field.key === 'wholeDiscount' ? 0 : 2" size="small" :disabled="readonly || orderIsLocked" controls-position="right" />
                <span v-if="field.key === 'wholeDiscount'" style="font-size:12px;color:var(--color-text-muted);flex-shrink:0">%</span>
              </template>
              <!-- 文本输入 -->
              <template v-else>
                <span class="dh-label">{{ field.label }}</span>
                <el-input v-model="form[field.key]" placeholder="" size="small" :disabled="readonly || orderIsLocked" :style="field.fullRow ? 'flex:1' : ''" />
              </template>
            </div>
          </div>

          <!-- 客户信息（选客户后自动带出） -->
          <div v-if="selCustomer" class="dh-row" style="display:flex;padding-top:2px">
            <div class="dh-detail-row">
              <span v-if="selCustomer.contact">联系人：{{ selCustomer.contact }}</span>
              <span v-if="selCustomer.phone">电话：{{ selCustomer.phone }}</span>
              <span v-if="selCustomer.creditLimit > 0">信用额度：¥{{ selCustomer.creditLimit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
          </div>
        </template>

        <template #actions>
          <el-button v-if="!readonly" size="small" :icon="Setting" @click="configDrawerVisible = true" title="表头字段配置" />
        </template>
      </DocHeader>

      <DocDetail
        :items="form.items"
        :options="products"
        item-field="productId"
        item-label="产品"
        :show-received="orderId > 0 && orderStatus !== 'draft'"
        received-label="已发"
        received-field="shippedQuantity"
        :readonly="readonly"
        :locked="orderIsLocked"
        @add-row="addItemRow"
        @remove-row="removeItem"
        @batch-remove="batchRemoveItems"
        @item-select="(v, r) => onProductChange(v, r)"
      >
        <template #modeBarExtra>
          <el-button v-if="!readonly" size="small" @click="batchSelectProducts">批量导入</el-button>
        </template>
        <template #priceTag="{ row: r }">
          <el-tag v-if="r.productId > 0 && r.price === 0" type="danger" size="small" effect="dark">赠</el-tag>
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
        <template #info>
          <span class="df-info-label">备注</span>
          <el-input v-model="form.remark" placeholder="" size="small" :disabled="readonly || orderIsLocked" clearable style="width:200px" />
          <span class="df-info-label">客户备注</span>
          <el-input v-model="form.customerRemark" placeholder="" size="small" :disabled="readonly || orderIsLocked" clearable style="width:200px" />
          <span class="df-info-label">制单人</span>
          <el-input :model-value="form.creator" disabled size="small" style="width:100px" />
          <span class="df-info-label">制单日期</span>
          <span class="df-info-value">{{ orderCreatedAt || '—' }}</span>
          <span class="df-info-label">最近修改</span>
          <span class="df-info-value">{{ orderUpdatedAt || '—' }}</span>
        </template>
        <template #statsExtra>
          <template v-if="downstreamDocs.length > 0">
            <span class="df-related-label">关联</span>
            <el-button v-for="d in downstreamDocs" :key="d.id" link :type="d.docType === 'receivable' ? 'warning' : d.docType === 'return' ? 'danger' : 'primary'" size="small" @click="emit('toolbarAction', 'open-' + d.docType + ':' + d.id)">{{ d.orderNo }}</el-button>
          </template>
        </template>
      </DocFooter>
    </div>

    <!-- 批量选择产品（两种模式共用） -->
    <el-dialog v-model="batchVisible" title="批量选择产品" width="500px">
      <el-select v-model="batchSelected" multiple filterable placeholder="搜索产品" style="width:100%">
        <el-option v-for="p in products" :key="p.id" :label="`${p.code} - ${p.name}`" :value="p.id" />
      </el-select>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmBatchProducts">添加选中产品</el-button>
      </template>
    </el-dialog>

    <!-- 表头字段配置抽屉 -->
    <HeaderFieldConfig v-model="configDrawerVisible" :fields="headerFields" :per-row="perRow" @save="(fields, pr) => saveHeaderConfig(fields, pr)" @reset="resetHeaderFields" />

    <!-- 草稿保存确认弹窗 -->
    <el-dialog v-model="draftSaveVisible" title="保存草稿" width="380px" :append-to-body="true">
      <el-checkbox v-model="draftReserveInventory" :disabled="readonly">占用库存（占用后其他单据将无法使用此库存）</el-checkbox>
      <template #footer>
        <el-button @click="draftSaveVisible = false">取消操作</el-button>
        <el-button type="primary" :loading="draft.isSaving.value" @click="doSaveDraft">确认保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import DocActionBar from './DocActionBar.vue'
import DocHeader from './DocHeader.vue'
import DocDetail from './DocDetail.vue'
import DocFooter, { type FooterStat } from './DocFooter.vue'
import HeaderFieldConfig from './HeaderFieldConfig.vue'
import { salesOrderApi, type SalesOrder } from '@/api/salesOrder'
import { productApi } from '@/api/product'
import { customerApi } from '@/api/customer'
import { useDraftAutoSave } from '@/composables/useDraftAutoSave'
import { useAmountPrivacy, useReveal } from '@/composables/useAmountPrivacy'
import { useHeaderFields, type HeaderFieldDef } from '@/composables/useHeaderFields'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  modelValue?: boolean; isEdit: boolean; editId: number; row?: SalesOrder | null
  customers?: any[]; products?: any[]; readonly?: boolean; inline?: boolean
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
const orderCreatedAt = ref('')
const orderUpdatedAt = ref('')
const downstreamDocs = ref<Array<{ id: number; orderNo: string; docType: string; status: string; statusLabel: string }>>([])
const inlineLoading = ref(false)
const customers = ref<any[]>(props.customers || [])
const products = ref<any[]>(props.products || [])
const selCustomer = computed(() => customers.value.find((c: any) => c.id === form.customerId) || null)
const form = reactive({
  customerId: 0, remark: '', customerRemark: '', reserveInventory: true,
  orderDate: '', businessType: '', deliveryMethod: '', salesperson: '',
  deliveryPerson: '', returnDate: '', paymentMethod: '', contactInfo: '',
  wholeDiscount: 100, usePrepayment: false, shippingAddress: '', creator: '',
  items: [] as Array<{ productId: number; quantity: number; price: number; _fresh?: boolean }>
})
const rules: FormRules = { customerId: [{ required: true, message: '请选择客户', trigger: 'change' }] }
const totalAmount = computed(() => form.items.reduce((s: number, i: any) => s + i.quantity * i.price, 0))
const draft = useDraftAutoSave(salesOrderApi as any, form as any, 'customerId', 'productId')
const { maskAmount } = useAmountPrivacy()
const docReveal = useReveal()
const { fields: headerFields, perRow, fieldGroups, loadConfig: loadHeaderConfig, saveConfig: saveHeaderConfig, resetToDefault: resetHeaderFields } = useHeaderFields()
const configDrawerVisible = ref(false)
const draftSaveVisible = ref(false)
const draftReserveInventory = ref(true)

function fieldValue(field: HeaderFieldDef): string {
  if (field.key === 'orderNo') return orderNo.value || '—'
  return String(form[field.key] || '—')
}

// ── 表尾统计 ──
const footerStats = computed<FooterStat[]>(() => [
  { label: '合计', value: maskAmount(totalAmount.value, { visible: docReveal.revealed.value }), primary: true, clickable: true },
  { label: '数量', value: String(form.items.reduce((s: number, i: any) => s + i.quantity, 0)) }
])
const draftHint = computed(() => {
  if (!draft.isDraft.value) return ''
  if (draft.isSaving.value) return '保存中...'
  const t = draft.lastSavedAt.value
  return '草稿 · ' + (t ? new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '')
})

function onStatClick(label: string) { if (label === '合计') docReveal.toggle() }
function onPartnerChange() {
  const customer = selCustomer.value
  if (customer) {
    if (customer.address && !form.shippingAddress) form.shippingAddress = customer.address
    if (customer.phone && !form.contactInfo) form.contactInfo = customer.phone
  }
  const hasData = form.items.some((i: any) => i.productId > 0)
  if (!hasData) return
  ElMessageBox.confirm('切换客户将清空已有明细，是否继续？', '确认切换', { type: 'warning' })
    .then(() => { form.items = [{ productId: 0, quantity: 1, price: 0 }] })
    .catch(() => {})
}
async function handleToolbarAction(key: string) {
  if (key === 'new') { emit('cancel'); return }
  if (key === 'save-draft') { handleSaveDraft(); return }
  if (key === 'submit') { handleSubmit(); return }
  if (key === 'config-header') { configDrawerVisible.value = true; return }
  if (key === 'delete' && orderId.value) {
    try { await ElMessageBox.confirm('确定删除该单据？删除后无法恢复。', '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) }
    catch { return }
    try {
      await salesOrderApi.delete(orderId.value)
      ElMessage.success('已删除')
      draft.stopAutoSave()
      emit('cancel')
    } catch (e: any) { ElMessage.error(e.message || '删除失败') }
    return
  }
  emit('toolbarAction', key)
}

function onWsKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSaveDraft() }
  else if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSubmit() }
  else if (e.key === 'Enter' && !['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)) { addItemRow() }
}

async function loadRefData() {
  if (!props.inline) return
  try { const [p, c] = await Promise.all([productApi.getList({ page: 1, pageSize: 1000 }), customerApi.getList({ page: 1, pageSize: 1000 })]); products.value = p.list; customers.value = (c as any).list || [] } catch { /* 忽略 */ }
}
async function loadOrderDetail() {
  if (!props.inline || !props.editId) return
  inlineLoading.value = true
  try {
    const detail = await salesOrderApi.getDetail(props.editId)
    form.customerId = detail.customerId || 0; form.remark = detail.remark || ''
    form.reserveInventory = detail.status === 'draft' ? (detail.reserveInventory ?? true) : true
    form.orderDate = detail.orderDate ? detail.orderDate.slice(0, 10) : ''
    form.businessType = detail.businessType || ''
    form.deliveryMethod = detail.deliveryMethod || ''
    form.salesperson = detail.salesperson || ''
    form.deliveryPerson = detail.deliveryPerson || ''
    form.returnDate = detail.returnDate ? detail.returnDate.slice(0, 10) : ''
    form.paymentMethod = detail.paymentMethod || ''
    form.contactInfo = detail.contactInfo || ''
    form.wholeDiscount = detail.wholeDiscount ?? 100
    form.usePrepayment = detail.usePrepayment ?? false
    form.shippingAddress = detail.shippingAddress || ''
    form.customerRemark = detail.customerRemark || ''
    form.creator = detail.creator || detail.createdBy || ''
    form.items = detail.items?.map((i: any) => ({ productId: i.productId, quantity: i.quantity, price: i.price })) || [{ productId: 0, quantity: 1, price: 0 }]
    orderNo.value = detail.orderNo || ''; orderId.value = detail.id || 0; orderStatus.value = detail.status || 'draft'
    orderCreatedAt.value = detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('zh-CN') : ''
    orderUpdatedAt.value = detail.updatedAt ? new Date(detail.updatedAt).toLocaleDateString('zh-CN') : ''
    orderIsLocked.value = (detail as any).receivableItems?.some((ri: any) => ['pending', 'approved'].includes(ri.receivable?.status)) || false
    const docs: typeof downstreamDocs.value = []
    ;((detail as any).receivableItems || []).filter((ri: any) => ri.receivable).forEach((ri: any) => docs.push({ id: ri.receivable.id, orderNo: ri.receivable.orderNo, docType: 'receivable', status: ri.receivable.status, statusLabel: ri.receivable.status === 'approved' ? '已审核' : '待审核' }))
    ;((detail as any).productionOrders || []).forEach((po: any) => docs.push({ id: po.id, orderNo: po.orderNo, docType: 'production', status: po.status, statusLabel: po.status === 'completed' ? '已完成' : '进行中' }))
    ;((detail as any).purchaseOrders || []).forEach((po: any) => docs.push({ id: po.id, orderNo: po.orderNo, docType: 'purchase', status: po.status, statusLabel: (detail as any).statusLabel?.(po.status) || po.status }))
    ;((detail as any).returnOrders || []).forEach((ro: any) => docs.push({ id: ro.id, orderNo: ro.returnNo, docType: 'return', status: ro.status, statusLabel: ro.status === 'completed' ? '已完成' : '待处理' }))
    downstreamDocs.value = docs
    emit('titleChange', '销货单 - ' + (detail.orderNo || '新建'))
    if (detail.status === 'draft') draft.initAutoSave({ id: detail.id } as any)
  } catch { ElMessage.error('加载单据详情失败') } finally { inlineLoading.value = false }
}
function initDialogForm() {
  form.customerId = props.row?.customerId || 0; form.remark = props.row?.remark || ''
  form.reserveInventory = props.row?.reserveInventory !== undefined ? props.row.reserveInventory : true
  form.creator = props.row?.creator || useUserStore().userInfo?.name || ''
  form.items = props.row?.items?.map((i: any) => ({ productId: i.productId, quantity: i.quantity, price: i.price })) || [{ productId: 0, quantity: 1, price: 0 }]
  if (props.row?.status === 'draft' || !props.row) draft.initAutoSave(props.row || null); else draft.stopAutoSave()
}
watch(() => props.modelValue, (val) => { if (!props.inline && val) initDialogForm() })
onMounted(() => { if (props.inline) { form.creator = useUserStore().userInfo?.name || ''; loadRefData(); loadHeaderConfig(); loadOrderDetail().then(() => { if (!props.editId) { if (form.items.length === 0) form.items.push({ productId: 0, quantity: 1, price: 0 }); draft.initAutoSave(null) } }) } })
watch(() => ({ c: form.customerId, r: form.remark, len: form.items.length, bt: form.businessType, sp: form.salesperson, dp: form.deliveryPerson, sa: form.shippingAddress }), () => { if (props.inline) emit('dirty', form.customerId > 0 || form.remark.trim() !== '' || form.items.some((i: any) => i.productId > 0) || form.businessType !== '' || form.salesperson !== '' || form.deliveryPerson !== '' || form.shippingAddress !== '') }, { deep: true, immediate: false })
function onClosed() { draft.stopAutoSave(); if (draft.draftId.value && !draft.hasMeaningfulContent()) draft.discardDraft() }
function onProductChange(v: number, row: any) { row._fresh = false; const p = products.value.find((x: any) => x.id === v); if (p && row.price === 0) row.price = p.price || 0 }
function addItemRow() { form.items.push({ productId: 0, quantity: 1, price: 0, _fresh: true }) }
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
function handleSaveDraft() {
  draftReserveInventory.value = true
  draftSaveVisible.value = true
}
async function doSaveDraft() {
  form.reserveInventory = draftReserveInventory.value
  draftSaveVisible.value = false
  try { await draft.saveAsDraft(); ElMessage.success('草稿已保存'); if (!props.inline) visible.value = false } catch (e: any) { ElMessage.error(e.message) }
}
const giftLines = () => form.items.map((i: any, idx: number) => ({ ...i, rowNo: idx + 1 })).filter((i: any) => i.productId > 0 && i.price === 0)
async function handleSubmit() {
  await formRef.value?.validate()
  if (form.items.length === 0 || form.items.every((i: any) => !i.productId)) { ElMessage.warning('请至少添加一条销售明细'); return }
  const gifts = giftLines()
  if (gifts.length > 0) {
    const productMap = new Map(products.value.map((p: any) => [p.id, p]))
    const lines = gifts.map((g: any) => `<tr><td style="padding:4px 12px;">#${g.rowNo}</td><td style="padding:4px 12px;">${productMap.get(g.productId)?.code||'-'} ${productMap.get(g.productId)?.name||'未知'}</td><td style="padding:4px 12px;text-align:right;">×${g.quantity}</td></tr>`).join('')
    const msg = `<div style="font-size:13px;line-height:1.8;"><p>以下 <b style="color:#e6a23c;">${gifts.length}</b> 条明细售价为0，将作为赠品开单：</p><table style="width:100%;border-collapse:collapse;margin:8px 0;">${lines}</table><p style="color:#999;">请确认是否继续？</p></div>`
    try { await ElMessageBox.confirm(msg, '赠品确认', { dangerouslyUseHTMLString: true, confirmButtonText: '确认开单', cancelButtonText: '返回修改', type: 'warning' }) } catch { return }
  }
  submitting.value = true
  try {
    let resultOrderNo = ''
    if (draft.isDraft.value) { const r = await draft.submitDraft(); resultOrderNo = r?.orderNo || ''; ElMessage.success('创建成功') }
    else if (props.isEdit) { await salesOrderApi.update(props.editId, { ...form } as any); ElMessage.success('更新成功') }
    else { const r = await salesOrderApi.create({ customerId: form.customerId, items: form.items, remark: form.remark, customerRemark: form.customerRemark, reserveInventory: true, creator: form.creator, orderDate: form.orderDate, businessType: form.businessType, deliveryMethod: form.deliveryMethod, salesperson: form.salesperson, deliveryPerson: form.deliveryPerson, returnDate: form.returnDate, paymentMethod: form.paymentMethod, contactInfo: form.contactInfo, wholeDiscount: form.wholeDiscount, usePrepayment: form.usePrepayment, shippingAddress: form.shippingAddress }); resultOrderNo = r?.orderNo || ''; ElMessage.success('创建成功') }
    if (props.inline) emit('success', resultOrderNo || orderNo.value); else { visible.value = false; emit('success') }
  } catch (e: any) { ElMessage.error(e.message || '操作失败') } finally { submitting.value = false }
}
function handleCancel() { draft.stopAutoSave(); if (draft.draftId.value && !draft.hasMeaningfulContent()) draft.discardDraft(); if (props.inline) emit('cancel'); else visible.value = false }
const batchSelectProducts = () => { batchSelected.value = []; batchVisible.value = true }
const confirmBatchProducts = () => { if (batchSelected.value.length === 0) { ElMessage.warning('请选择产品'); return }; for (const pid of batchSelected.value) { const p = products.value.find((x: any) => x.id === pid); form.items.push({ productId: pid, quantity: 1, price: p?.price || 0 }) }; batchVisible.value = false }

</script>

<style>
@import '@/styles/inline-form.css';
.so-root { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
</style>
<style scoped>
</style>
