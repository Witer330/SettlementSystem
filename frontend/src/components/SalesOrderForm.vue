<template>
  <div>
    <el-dialog
      v-model="visible"
      :title="readonly ? '查看销售单' : (isEdit ? '编辑销售单' : '新增销售单')"
      width="720px"
      @closed="onClosed"
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
            style="width:100%"
            :disabled="readonly"
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
            :disabled="readonly"
          />
        </el-form-item>
        <el-form-item label="占用库存">
          <el-checkbox
            v-model="form.reserveInventory"
            :disabled="readonly"
          >
            草稿商品占用库存，避免超卖
          </el-checkbox>
        </el-form-item>
      </el-form>

      <h4 style="margin:12px 0 8px">
        销售明细
      </h4>
      <el-table
        :data="form.items"
        border
        size="small"
      >
        <el-table-column
          label="#"
          width="44"
          align="center"
        >
          <template #default="{ $index }">
            {{ $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column
          label="产品"
          min-width="200"
        >
          <template #default="{ row }">
            <el-select
              v-model="row.productId"
              placeholder="选择产品"
              filterable
              size="small"
              style="width:100%"
              :disabled="readonly"
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
              :min="1"
              size="small"
              style="width:100%"
              controls-position="right"
              :disabled="readonly"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="单价"
          width="150"
        >
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:4px;">
              <el-input-number
                v-model="row.price"
                :min="0"
                :precision="2"
                size="small"
                style="width:100%"
                controls-position="right"
                :disabled="readonly"
              />
              <el-tag
                v-if="row.productId > 0 && row.price === 0"
                type="danger"
                size="small"
                effect="dark"
              >
                赠品
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          label="小计"
          width="100"
        >
          <template #default="{ row }">
            <span
              :style="{ color: docReveal.revealed.value && row.productId > 0 && row.price === 0 ? 'var(--color-danger)' : '' }"
              class="clickable-amount"
              @click="docReveal.toggle()"
            >{{ maskAmount((row.quantity||0)*(row.price||0), { visible: docReveal.revealed.value }) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="!readonly"
          width="70"
        >
          <template #default="{ row }">
            <el-button
              link
              type="danger"
              size="small"
              @click="removeItem(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div
        v-if="!readonly"
        style="display:flex;gap:8px;margin-top:8px;"
      >
        <el-button
          size="small"
          @click="addItemRow"
        >
          + 添加行
        </el-button>
        <el-button
          size="small"
          @click="batchSelectProducts"
        >
          批量选择产品
        </el-button>
      </div>
      <div style="text-align:right;margin-top:8px;font-size:16px">
        合计：<b
          class="clickable-amount"
          @click="docReveal.toggle()"
        >{{ maskAmount(totalAmount, { visible: docReveal.revealed.value }) }}</b>
      </div>

      <template #footer>
        <div
          v-if="readonly"
          style="text-align:right"
        >
          <el-button @click="visible = false">
            关闭
          </el-button>
        </div>
        <div
          v-else
          style="display:flex;align-items:center;gap:8px;"
        >
          <span
            v-if="draft.isDraft.value"
            style="color:var(--color-text-muted);font-size:12px;margin-right:auto;"
          >
            {{ draft.isSaving.value ? '保存中...' : `草稿 · 已自动保存 ${draft.lastSavedAt.value ? new Date(draft.lastSavedAt.value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : ''}`.trim() }}
          </span>
          <span
            v-else
            style="flex:1;"
          />
          <el-button @click="visible = false">
            取消
          </el-button>
          <el-button
            :loading="draft.isSaving.value"
            @click="handleSaveDraft"
          >
            保存草稿
          </el-button>
          <el-button
            type="primary"
            :loading="submitting"
            @click="handleSubmit"
          >
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { salesOrderApi, type SalesOrder } from '@/api/salesOrder'
import { useDraftAutoSave } from '@/composables/useDraftAutoSave'
import { useAmountPrivacy, useReveal } from '@/composables/useAmountPrivacy'

const props = defineProps<{ modelValue: boolean; isEdit: boolean; editId: number; row?: SalesOrder | null; customers: any[]; products: any[]; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; success: [] }>()

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const submitting = ref(false)
const formRef = ref<FormInstance>()
const batchVisible = ref(false)
const batchSelected = ref<number[]>([])

const form = reactive({ customerId: 0, remark: '', reserveInventory: true, items: [] as Array<{ productId: number; quantity: number; price: number }> })

const rules: FormRules = { customerId: [{ required: true, message: '请选择客户', trigger: 'change' }] }
const totalAmount = computed(() => form.items.reduce((s: number, i: any) => s + i.quantity * i.price, 0))
const draft = useDraftAutoSave(salesOrderApi as any, form as any, 'customerId', 'productId')
const { maskAmount } = useAmountPrivacy()
const docReveal = useReveal()

watch(() => props.modelValue, (val) => {
  if (val) {
    form.customerId = props.row?.customerId || 0
    form.remark = props.row?.remark || ''
    form.reserveInventory = props.row?.reserveInventory !== undefined ? props.row.reserveInventory : true
    form.items = props.row?.items?.map((i: any) => ({ productId: i.productId, quantity: i.quantity, price: i.price }))
      || [{ productId: 0, quantity: 1, price: 0 }]
    if (props.row?.status === 'draft' || !props.row) draft.initAutoSave(props.row || null)
    else draft.stopAutoSave()
  }
})

function onClosed() { draft.stopAutoSave(); if (draft.draftId.value && !draft.hasMeaningfulContent()) draft.discardDraft() }

function onProductChange(v: number, row: any) { const p = props.products.find((x: any) => x.id === v); if (p && row.price === 0) row.price = p.price || 0 }
function addItemRow() { form.items.push({ productId: 0, quantity: 1, price: 0 }) }
function removeItem(row: any) { const i = form.items.indexOf(row); if (i >= 0) form.items.splice(i, 1) }

async function handleSaveDraft() { try { await draft.saveAsDraft(); ElMessage.success('草稿已保存'); visible.value = false } catch (e: any) { ElMessage.error(e.message) } }

const giftLines = () => form.items.map((i: any, idx: number) => ({ ...i, rowNo: idx + 1 })).filter((i: any) => i.productId > 0 && i.price === 0)

async function handleSubmit() {
  await formRef.value?.validate()
  if (form.items.length === 0 || form.items.every((i: any) => !i.productId)) { ElMessage.warning('请至少添加一条销售明细'); return }
  const gifts = giftLines()
  if (gifts.length > 0) {
    const productMap = new Map(props.products.map((p: any) => [p.id, p]))
    const lines = gifts.map((g: any) => `<tr><td style="padding:4px 12px;">#${g.rowNo}</td><td style="padding:4px 12px;">${productMap.get(g.productId)?.code||'-'} ${productMap.get(g.productId)?.name||'未知'}</td><td style="padding:4px 12px;text-align:right;">×${g.quantity}</td></tr>`).join('')
    const msg = `<div style="font-size:13px;line-height:1.8;"><p>以下 <b style="color:#e6a23c;">${gifts.length}</b> 条明细售价为0，将作为赠品开单：</p><table style="width:100%;border-collapse:collapse;margin:8px 0;">${lines}</table><p style="color:#999;">请确认是否继续？</p></div>`
    try { await ElMessageBox.confirm(msg, '赠品确认', { dangerouslyUseHTMLString: true, confirmButtonText: '确认开单', cancelButtonText: '返回修改', type: 'warning' }) } catch { return }
  }
  submitting.value = true
  try {
    if (draft.isDraft.value) { await draft.submitDraft(); ElMessage.success('创建成功') }
    else if (props.isEdit) { await salesOrderApi.update(props.editId, { ...form } as any); ElMessage.success('更新成功') }
    else { await salesOrderApi.create({ customerId: form.customerId, items: form.items, remark: form.remark }); ElMessage.success('创建成功') }
    visible.value = false; emit('success')
  } catch (e: any) { ElMessage.error(e.message || '操作失败') } finally { submitting.value = false }
}

// 批量选择
const batchSelectProducts = () => { batchSelected.value = []; batchVisible.value = true }
const confirmBatchProducts = () => { if (batchSelected.value.length === 0) { ElMessage.warning('请选择产品'); return }; for (const pid of batchSelected.value) { const p = props.products.find((x: any) => x.id === pid); form.items.push({ productId: pid, quantity: 1, price: p?.price || 0 }) }; batchVisible.value = false }

const batchDialog = { visible: batchVisible, selected: batchSelected, confirm: confirmBatchProducts }
Object.defineProperty(batchDialog, 'visible', { get: () => batchVisible.value, set: (v: boolean) => batchVisible.value = v })
</script>
