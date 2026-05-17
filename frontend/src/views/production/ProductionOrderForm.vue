<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑生产工单' : '新增生产工单'"
    width="560px"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="创建方式" v-if="!isEdit">
        <el-radio-group v-model="createMode">
          <el-radio value="manual">手动创建</el-radio>
          <el-radio value="sales">从销售单创建</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="销售单" v-if="createMode === 'sales' && !isEdit" prop="salesOrderId">
        <el-select v-model="form.salesOrderId" placeholder="选择销售单" filterable style="width: 100%" @change="onSalesOrderChange">
          <el-option
            v-for="so in salesOrders"
            :key="so.id"
            :label="`${so.orderNo} - ${so.customer?.name || '无客户'}`"
            :value="so.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="产品" prop="productId">
        <el-select v-model="form.productId" placeholder="选择产品" filterable style="width: 100%" @change="onProductChange">
          <el-option
            v-for="p in products"
            :key="p.id"
            :label="`${p.name} (${p.code})`"
            :value="p.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="计划数量" prop="quantity">
        <el-input-number v-model="form.quantity" :min="1" :precision="0" style="width: 100%" />
      </el-form-item>

      <el-form-item label="开始日期">
        <el-date-picker
          v-model="form.startDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注信息" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { productionOrderApi, type ProductionOrder } from '@/api/productionOrder'
import { salesOrderApi } from '@/api/salesOrder'
import { productApi, type Product } from '@/api/product'

const props = defineProps<{
  modelValue: boolean
  mode: 'create' | 'edit'
  order: ProductionOrder | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:modelValue', v) })

const isEdit = ref(false)
const createMode = ref<'manual' | 'sales'>('manual')
const submitting = ref(false)
const formRef = ref<FormInstance>()
const salesOrders = ref<any[]>([])
const products = ref<Product[]>([])

const form = reactive({
  salesOrderId: undefined as number | undefined,
  productId: undefined as number | undefined,
  quantity: 1,
  startDate: '',
  remark: ''
})

const rules: FormRules = {
  productId: [{ required: true, message: '请选择产品', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入计划数量', trigger: 'blur' }]
}

const loadSalesOrders = async () => {
  try {
    const res = await salesOrderApi.getList({ pageSize: 1000, status: 'confirmed' })
    salesOrders.value = res.list
  } catch { /* ignore */ }
}

const loadProducts = async () => {
  try {
    const res = await productApi.getList({ status: 'active', pageSize: 1000 })
    products.value = res.list
  } catch { /* ignore */ }
}

const onSalesOrderChange = (soId: number) => {
  const so = salesOrders.value.find((s: any) => s.id === soId)
  if (so && so.items && so.items.length > 0) {
    // 选择销售单的第一个产品
    form.productId = so.items[0].productId
    form.quantity = so.items[0].quantity
  }
}

const onProductChange = () => {}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const data: any = {
      productId: form.productId!,
      quantity: form.quantity,
      remark: form.remark || undefined
    }
    if (form.salesOrderId) data.salesOrderId = form.salesOrderId
    if (form.startDate) data.startDate = form.startDate

    if (isEdit.value && props.order) {
      await productionOrderApi.update(props.order.id, data)
      ElMessage.success('更新成功')
    } else {
      await productionOrderApi.create(data)
      ElMessage.success('创建成功')
    }
    handleClose()
    emit('success')
  } catch (error: any) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  form.salesOrderId = undefined
  form.productId = undefined
  form.quantity = 1
  form.startDate = ''
  form.remark = ''
  createMode.value = 'manual'
}

const handleClose = () => {
  visible.value = false
  resetForm()
}

watch(() => props.order, (order) => {
  isEdit.value = props.mode === 'edit'
  if (order && props.mode === 'edit') {
    form.productId = order.productId
    form.quantity = order.quantity
    form.startDate = order.startDate ? order.startDate.slice(0, 10) : ''
    form.remark = order.remark || ''
    form.salesOrderId = order.salesOrderId
  } else {
    resetForm()
  }
}, { immediate: true })

onMounted(() => {
  loadSalesOrders()
  loadProducts()
})
</script>
