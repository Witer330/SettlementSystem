<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="600px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
      <el-form-item label="工号" prop="code">
        <el-input v-model="formData.code" placeholder="自动生成" disabled />
      </el-form-item>
      <el-form-item label="姓名" prop="name">
        <el-input v-model="formData.name" placeholder="请输入姓名" />
      </el-form-item>
      <el-form-item label="部门" prop="departmentId">
        <el-select
          v-model="formData.departmentId"
          placeholder="请选择部门"
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="dept in departmentList"
            :key="dept.id"
            :label="dept.name"
            :value="dept.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="工种" prop="jobTypeId">
        <el-select
          v-model="formData.jobTypeId"
          placeholder="请选择工种"
          clearable
          style="width: 100%"
        >
          <el-option v-for="jt in jobTypeList" :key="jt.id" :label="jt.name" :value="jt.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="计费方式" prop="payType">
        <el-radio-group v-model="formData.payType" @change="handlePayTypeChange">
          <el-radio label="hourly">时薪</el-radio>
          <el-radio label="piece">计件</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="时薪" prop="hourlyRate" v-if="formData.payType === 'hourly'">
        <el-input-number
          v-model="formData.hourlyRate"
          :min="0"
          :precision="2"
          :step="0.01"
          style="width: 100%"
        />
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
import { employeeApi, type Employee } from '../../api/employee'
import { type Department } from '../../api/department'
import { type JobType } from '../../api/jobType'

const props = defineProps<{
  modelValue: boolean
  title: string
  mode: 'create' | 'edit'
  employee?: Employee | null
  departmentList: Department[]
  jobTypeList: JobType[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const formRef = ref<FormInstance>()

const formData = reactive({
  id: 0,
  code: '',
  name: '',
  departmentId: null as number | null,
  jobTypeId: null as number | null,
  jobType: '',
  payType: 'hourly' as 'hourly' | 'piece',
  hourlyRate: 0,
  pieceRate: 0,
  status: 'active'
})

const formRules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  jobTypeId: [{ required: true, message: '请选择工种', trigger: 'change' }]
}

const handlePayTypeChange = (value: 'hourly' | 'piece') => {
  if (value === 'hourly') {
    formData.hourlyRate = formData.hourlyRate || 0
    formData.pieceRate = 0
  } else {
    formData.pieceRate = formData.pieceRate || 0
    formData.hourlyRate = 0
  }
}

const resetForm = () => {
  Object.assign(formData, {
    id: 0,
    code: '',
    name: '',
    departmentId: null,
    jobTypeId: null,
    jobType: '',
    payType: 'hourly',
    hourlyRate: 0,
    pieceRate: 0,
    status: 'active'
  })
}

const initForm = async () => {
  if (props.mode === 'create') {
    resetForm()
    try {
      const nextCode = await employeeApi.getNextCode()
      formData.code = nextCode
    } catch (error: any) {
      ElMessage.error(error.message || '获取员工工号失败')
    }
  } else if (props.employee) {
    Object.assign(formData, {
      id: props.employee.id,
      code: props.employee.code,
      name: props.employee.name,
      departmentId: props.employee.departmentId || null,
      jobTypeId: props.employee.jobTypeId || null,
      jobType: props.employee.jobType,
      payType: props.employee.payType || 'hourly',
      hourlyRate: props.employee.hourlyRate,
      pieceRate: props.employee.pieceRate || 0,
      status: props.employee.status
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

    if (props.mode === 'create') {
      await employeeApi.create(formData)
      ElMessage.success('创建成功')
    } else {
      await employeeApi.update(formData.id, formData)
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
