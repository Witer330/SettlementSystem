<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="800px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="员工" prop="employeeId">
            <el-select
              v-model="formData.employeeId"
              placeholder="请选择员工"
              style="width: 100%"
              filterable
            >
              <el-option
                v-for="employee in employees"
                :key="employee.id"
                :label="employee.name"
                :value="employee.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="日期" prop="date">
            <el-date-picker
              v-model="formData.date"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="生产明细" prop="items">
        <div class="items-container">
          <div v-for="(item, index) in formData.items" :key="index" class="item-row">
            <el-select
              v-model="item.specId"
              placeholder="选择规格"
              style="width: 250px"
              @change="handleSpecChange(item)"
            >
              <el-option
                v-for="spec in specs"
                :key="spec.id"
                :label="`${spec.product?.name}-${spec.name}`"
                :value="spec.id"
              />
            </el-select>
            <el-input-number
              v-model="item.quantity"
              :min="1"
              placeholder="数量"
              style="width: 150px"
            />
            <span class="item-unit-price" v-if="item.unitPrice"
              >¥{{ item.unitPrice.toFixed(2) }}/件</span
            >
            <el-button type="danger" :icon="Delete" circle @click="removeItem(index)" />
          </div>
          <el-button type="primary" :icon="Plus" size="small" @click="addItem"
            >添加明细</el-button
          >
        </div>
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { dailyPieceApi, type DailyPieceRecord } from '../../api/dailyPiece'
import { type ProductSpec } from '../../api/spec'

const props = defineProps<{
  modelValue: boolean
  title: string
  mode: 'create' | 'edit'
  record?: DailyPieceRecord | null
  employees: any[]
  specs: ProductSpec[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const formRef = ref<FormInstance>()

const formData = reactive({
  id: 0,
  employeeId: undefined as number | undefined,
  date: '',
  items: [] as Array<{
    specId: number | undefined
    quantity: number
    unitPrice: number
  }>,
  remark: ''
})

const formRules: FormRules = {
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  items: [
    {
      validator: (value: any, callback: any) => {
        if (!value || value.length === 0) {
          callback(new Error('请添加至少一条生产明细'))
        } else if (value.some((item: any) => !item.specId || !item.quantity)) {
          callback(new Error('请完善所有明细信息'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]
}

const handleSpecChange = (item: any) => {
  const spec = props.specs.find((s) => s.id === item.specId)
  if (spec && spec.specPrice) {
    item.unitPrice = spec.specPrice.unitPrice
  }
}

const addItem = () => {
  formData.items.push({
    specId: undefined,
    quantity: 1,
    unitPrice: 0
  })
}

const removeItem = (index: number) => {
  formData.items.splice(index, 1)
}

const resetForm = () => {
  Object.assign(formData, {
    id: 0,
    employeeId: undefined,
    date: '',
    items: [{ specId: undefined, quantity: 1, unitPrice: 0 }],
    remark: ''
  })
}

const initForm = () => {
  if (props.mode === 'create') {
    resetForm()
  } else if (props.record) {
    Object.assign(formData, {
      id: props.record.id,
      employeeId: props.record.employeeId,
      date: props.record.date.split('T')[0],
      items:
        props.record.items?.map((item) => ({
          specId: item.specId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })) || [],
      remark: props.record.remark || ''
    })
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) initForm()
  }
)

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    const data = {
      employeeId: formData.employeeId!,
      date: formData.date,
      items: formData.items.map((item) => ({
        specId: item.specId!,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })),
      remark: formData.remark
    }

    if (props.mode === 'create') {
      await dailyPieceApi.createRecord(data)
      ElMessage.success('创建成功')
    } else {
      await dailyPieceApi.updateRecord(formData.id, data)
      ElMessage.success('更新成功')
    }

    emit('update:modelValue', false)
    emit('success')
  } catch (error: any) {
    if (error !== false) {
      ElMessage.error(error.message || '提交失败')
    }
  }
}
</script>

<style scoped>
.items-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  width: 100%;
}

.item-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.item-unit-price {
  color: var(--color-primary);
  font-weight: var(--font-weight-550);
  min-width: 80px;
}
</style>
