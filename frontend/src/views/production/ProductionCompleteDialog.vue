<template>
  <el-dialog
    :model-value="visible"
    title="完工入库"
    width="600px"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="initForm"
  >
    <div v-if="order" class="complete-header">
      <p>工单号：<strong>{{ order.orderNo }}</strong></p>
      <p>产品：<strong>{{ order.product?.name }}</strong></p>
      <p>计划数量：{{ order.quantity }} &nbsp; 已生产：{{ order.producedQuantity }}</p>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" style="margin-top: 16px">
      <el-form-item label="完工数量" prop="quantity">
        <el-input-number v-model="form.quantity" :min="1" style="width: 100%" />
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" />
      </el-form-item>

      <el-divider content-position="left">计件工资（可选，支持多人）</el-divider>

      <div v-for="(record, idx) in form.dailyRecords" :key="idx" class="piece-record-row">
        <el-form-item :label="`员工 ${idx + 1}`" class="piece-record-field">
          <el-select v-model="record.employeeId" placeholder="选择计件员工" clearable filterable style="width: 100%">
            <el-option
              v-for="emp in pieceEmployees"
              :key="emp.id"
              :label="`${emp.name} (${emp.code})`"
              :value="emp.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="完工件数" class="piece-record-field" v-if="record.employeeId">
          <el-input-number v-model="record.pieceQuantity" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="计件单价" class="piece-record-field" v-if="record.employeeId">
          <span>¥{{ pieceUnitPrice.toFixed(2) }}</span>
          <span class="price-hint">（来自产品计件单价）</span>
        </el-form-item>
        <el-button
          v-if="form.dailyRecords.length > 1"
          link type="danger"
          @click="form.dailyRecords.splice(idx, 1)"
          class="piece-record-remove"
        >移除</el-button>
      </div>

      <el-button type="primary" link @click="addPieceRecord" style="margin-left: 100px">
        + 添加计件员工
      </el-button>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleComplete">确认入库</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { productionOrderApi, type ProductionOrder } from '@/api/productionOrder'
import { employeeApi } from '@/api/employee'

interface PieceRecord {
  employeeId: number | undefined
  pieceQuantity: number
}

const props = defineProps<{
  modelValue: boolean
  order: ProductionOrder | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:modelValue', v) })

const submitting = ref(false)
const formRef = ref<FormInstance>()
const pieceEmployees = ref<any[]>([])

const form = reactive({
  quantity: 1,
  remark: '',
  dailyRecords: [{ employeeId: undefined as number | undefined, pieceQuantity: 1 }] as PieceRecord[]
})

const rules: FormRules = {
  quantity: [{ required: true, message: '请输入完工数量', trigger: 'blur' }]
}

const pieceUnitPrice = computed(() => props.order?.product?.unitPrice || 0)

const loadPieceEmployees = async () => {
  try {
    const res = await employeeApi.getList({ page: 1, pageSize: 1000, status: 'active' })
    pieceEmployees.value = res.list
  } catch { /* ignore */ }
}

const addPieceRecord = () => {
  form.dailyRecords.push({ employeeId: undefined, pieceQuantity: 1 })
}

const initForm = () => {
  form.quantity = 1
  form.remark = ''
  form.dailyRecords = [{ employeeId: undefined, pieceQuantity: 1 }]
  loadPieceEmployees()
}

const handleComplete = async () => {
  if (!props.order || !formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true

    // 过滤出有效计件记录
    const validRecords = form.dailyRecords.filter(r => r.employeeId && r.pieceQuantity > 0)

    const data: any = {
      quantity: form.quantity,
      remark: form.remark || undefined
    }

    if (validRecords.length > 0) {
      data.dailyRecords = validRecords.map(r => ({
        employeeId: r.employeeId,
        totalAmount: r.pieceQuantity * pieceUnitPrice.value,
        items: [{
          productId: props.order!.productId,
          quantity: r.pieceQuantity,
          unitPrice: pieceUnitPrice.value,
          amount: r.pieceQuantity * pieceUnitPrice.value
        }]
      }))
    }

    await productionOrderApi.completeProduction(props.order.id, data)
    ElMessage.success('完工入库成功')
    visible.value = false
    emit('success')
  } catch (error: any) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.complete-header {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.8;
}
.complete-header strong {
  color: var(--color-text-primary);
}
.piece-record-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px dashed var(--border-color-light);
}
.piece-record-row:first-child {
  border-top: none;
  padding-top: 0;
}
.piece-record-field {
  flex: 1;
  margin-bottom: 0 !important;
}
.piece-record-remove {
  margin-top: 6px;
  flex-shrink: 0;
}
.price-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
