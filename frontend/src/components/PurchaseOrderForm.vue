<template>
  <div>
    <el-dialog
      v-model="visible"
      :title="isEdit ? '编辑采购单' : '新增采购单'"
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
          label="供应商"
          prop="supplierId"
        >
          <el-select
            v-model="form.supplierId"
            placeholder="请选择供应商"
            filterable
            style="width:100%"
          >
            <el-option
              v-for="s in suppliers"
              :key="s.id"
              :label="s.name"
              :value="s.id"
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
            草稿物料占用库存，避免重复采购
          </el-checkbox>
        </el-form-item>
      </el-form>

      <h4 style="margin:12px 0 8px">
        采购明细
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
          label="物料"
          min-width="200"
        >
          <template #default="{ row }">
            <el-select
              v-model="row.materialId"
              placeholder="选择物料"
              filterable
              size="small"
              style="width:100%"
            >
              <el-option
                v-for="m in materials"
                :key="m.id"
                :label="`${m.code} - ${m.name}`"
                :value="m.id"
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
            />
          </template>
        </el-table-column>
        <el-table-column
          label="单价"
          width="130"
        >
          <template #default="{ row }">
            <el-input-number
              v-model="row.price"
              :min="0"
              :precision="2"
              size="small"
              style="width:100%"
              controls-position="right"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="小计"
          width="100"
        >
          <template #default="{ row }">
            ¥{{ ((row.quantity||0)*(row.price||0)).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column width="70">
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
      <div style="display:flex;gap:8px;margin-top:8px;">
        <el-button
          size="small"
          @click="addItemRow"
        >
          + 添加行
        </el-button>
        <el-button
          size="small"
          @click="batchSelectMaterials"
        >
          批量选择物料
        </el-button>
      </div>
      <div style="text-align:right;margin-top:8px;font-size:16px">
        合计：<b>¥{{ totalAmount.toFixed(2) }}</b>
      </div>

      <template #footer>
        <div style="display:flex;align-items:center;gap:8px;">
          <span
            v-if="draft.isDraft.value"
            style="color:var(--color-text-muted);font-size:12px;margin-right:auto;"
          >{{ draft.isSaving.value ? '保存中...' : `草稿 · ${draft.lastSavedAt.value ? new Date(draft.lastSavedAt.value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : ''}`.trim() }}</span>
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

    <el-dialog
      v-model="batchVisible"
      title="批量选择物料"
      width="500px"
    >
      <el-select
        v-model="batchSelected"
        multiple
        filterable
        placeholder="搜索物料"
        style="width:100%"
      >
        <el-option
          v-for="m in materials"
          :key="m.id"
          :label="`${m.code} - ${m.name}`"
          :value="m.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="batchVisible = false">
          取消
        </el-button><el-button
          type="primary"
          @click="confirmBatchMaterials"
        >
          添加选中物料
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { purchaseOrderApi, type PurchaseOrder } from '@/api/purchaseOrder'
import { useDraftAutoSave } from '@/composables/useDraftAutoSave'

const props = defineProps<{ modelValue: boolean; isEdit: boolean; editId: number; row?: PurchaseOrder | null; suppliers: any[]; materials: any[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; success: [] }>()

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const submitting = ref(false); const formRef = ref<FormInstance>()
const batchVisible = ref(false); const batchSelected = ref<number[]>([])

const form = reactive({ supplierId: 0, remark: '', reserveInventory: true, items: [] as Array<{ materialId: number; quantity: number; price: number }> })
const rules: FormRules = { supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }] }
const totalAmount = computed(() => form.items.reduce((s: number, i: any) => s + i.quantity * i.price, 0))
const draft = useDraftAutoSave(purchaseOrderApi as any, form as any, 'supplierId', 'materialId')

watch(() => props.modelValue, (val) => {
  if (val) {
    form.supplierId = props.row?.supplierId || 0; form.remark = props.row?.remark || ''
    form.reserveInventory = props.row?.reserveInventory !== undefined ? props.row.reserveInventory : true
    form.items = props.row?.items?.map((i: any) => ({ materialId: i.materialId, quantity: i.quantity, price: i.price })) || [{ materialId: 0, quantity: 1, price: 0 }]
    if (props.row?.status === 'draft' || !props.row) draft.initAutoSave(props.row || null); else draft.stopAutoSave()
  }
})

function onClosed() { draft.stopAutoSave(); if (draft.draftId.value && !draft.hasMeaningfulContent()) draft.discardDraft() }
function addItemRow() { form.items.push({ materialId: 0, quantity: 1, price: 0 }) }
function removeItem(row: any) { const i = form.items.indexOf(row); if (i >= 0) form.items.splice(i, 1) }

async function handleSaveDraft() { try { await draft.saveAsDraft(); ElMessage.success('草稿已保存'); visible.value = false } catch (e: any) { ElMessage.error(e.message) } }

async function handleSubmit() {
  await formRef.value?.validate()
  if (form.items.length === 0 || form.items.every((i: any) => !i.materialId)) { ElMessage.warning('请至少添加一条采购明细'); return }
  submitting.value = true
  try {
    if (draft.isDraft.value) { await draft.submitDraft(); ElMessage.success('创建成功') }
    else if (props.isEdit) { await purchaseOrderApi.update(props.editId, { ...form } as any); ElMessage.success('更新成功') }
    else { await purchaseOrderApi.create({ supplierId: form.supplierId, items: form.items, remark: form.remark }); ElMessage.success('创建成功') }
    visible.value = false; emit('success')
  } catch (e: any) { ElMessage.error(e.message || '操作失败') } finally { submitting.value = false }
}

const batchSelectMaterials = () => { batchSelected.value = []; batchVisible.value = true }
const confirmBatchMaterials = () => { if (batchSelected.value.length === 0) { ElMessage.warning('请选择物料'); return }; for (const mid of batchSelected.value) form.items.push({ materialId: mid, quantity: 1, price: 0 }); batchVisible.value = false }
</script>
