<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="700px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
      <el-form-item label="产品" prop="productId">
        <el-select v-model="formData.productId" placeholder="请选择产品" style="width: 100%">
          <el-option
            v-for="product in products"
            :key="product.id"
            :label="product.name"
            :value="product.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="规格编码" prop="code">
        <el-input v-model="formData.code" placeholder="请输入规格编码" />
      </el-form-item>
      <el-form-item label="规格名称" prop="name">
        <el-input v-model="formData.name" placeholder="请输入规格名称" />
      </el-form-item>
      <el-form-item label="基础价格" prop="basePrice">
        <el-input-number
          v-model="formData.basePrice"
          :min="0"
          :precision="2"
          :step="0.01"
          style="width: 100%"
        />
      </el-form-item>
      <el-divider>规格参数</el-divider>
      <el-form-item label="尺寸参数">
        <el-input
          v-model="formData.dimensions"
          placeholder='如 {"d.diameter": 100, "length": 20}'
        />
      </el-form-item>
      <el-form-item label="材质参数">
        <el-input
          v-model="formData.material"
          placeholder='如 {"type": "steel", "thickness": 2}'
        />
      </el-form-item>
      <el-form-item label="工艺参数">
        <el-input
          v-model="formData.craft"
          placeholder='如 {"surface": "galvanized", "precision": "H7"}'
        />
      </el-form-item>
      <el-form-item label="复杂度" prop="difficulty">
        <el-select v-model="formData.difficulty" placeholder="请选择复杂度" style="width: 100%">
          <el-option label="简单" value="easy" />
          <el-option label="中等" value="medium" />
          <el-option label="困难" value="hard" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio label="active">启用</el-radio>
          <el-radio label="inactive">禁用</el-radio>
        </el-radio-group>
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
import { specApi, type ProductSpec } from '../../api/spec'

const props = defineProps<{
  modelValue: boolean
  title: string
  mode: 'create' | 'edit'
  spec?: ProductSpec | null
  products: any[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const formRef = ref<FormInstance>()

const formData = reactive({
  id: 0,
  productId: undefined as number | undefined,
  code: '',
  name: '',
  dimensions: '{}',
  material: '{}',
  craft: '{}',
  difficulty: 'medium',
  basePrice: 0,
  status: 'active'
})

const formRules: FormRules = {
  productId: [{ required: true, message: '请选择产品', trigger: 'change' }],
  code: [{ required: true, message: '请输入规格编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入规格名称', trigger: 'blur' }],
  difficulty: [{ required: true, message: '请选择复杂度', trigger: 'change' }]
}

const resetForm = () => {
  Object.assign(formData, {
    id: 0,
    productId: undefined,
    code: '',
    name: '',
    dimensions: '{}',
    material: '{}',
    craft: '{}',
    difficulty: 'medium',
    basePrice: 0,
    status: 'active'
  })
}

const initForm = () => {
  if (props.mode === 'create') {
    resetForm()
  } else if (props.spec) {
    Object.assign(formData, {
      id: props.spec.id,
      productId: props.spec.productId,
      code: props.spec.code,
      name: props.spec.name,
      dimensions:
        typeof props.spec.dimensions === 'string'
          ? props.spec.dimensions
          : JSON.stringify(props.spec.dimensions),
      material:
        typeof props.spec.material === 'string'
          ? props.spec.material
          : JSON.stringify(props.spec.material),
      craft:
        typeof props.spec.craft === 'string'
          ? props.spec.craft
          : JSON.stringify(props.spec.craft),
      difficulty: props.spec.difficulty,
      basePrice: props.spec.basePrice,
      status: props.spec.status
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
      productId: formData.productId!,
      code: formData.code,
      name: formData.name,
      dimensions: formData.dimensions,
      material: formData.material,
      craft: formData.craft,
      difficulty: formData.difficulty,
      basePrice: formData.basePrice,
      status: formData.status
    }

    if (props.mode === 'create') {
      await specApi.createSpec(data)
      ElMessage.success('创建成功')
    } else {
      await specApi.updateSpec(formData.id, data)
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
