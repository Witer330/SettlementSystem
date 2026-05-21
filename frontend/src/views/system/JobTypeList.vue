<template>
  <div class="job-type-list">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">工种管理</h1>
        <p class="page-description">管理企业工种信息</p>
      </div>
      <div class="header-actions">
        <el-checkbox v-model="includeArchived" @change="loadJobTypeList">
          显示已归档工种
        </el-checkbox>
        <el-button type="primary" :icon="Plus" @click="handleCreate"> 新增工种 </el-button>
      </div>
    </div>

    <!-- Data Table -->
    <el-card class="table-card" shadow="never">
      <el-table v-loading="loading" :data="jobTypeList" stripe style="width: 100%">
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column label="员工数量" width="100">
          <template #default="{ row }">
            {{ row.employees?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Edit" @click="handleEdit(row)" :disabled="isArchived(row.status)">编辑</el-button>
            <el-button v-if="!isArchived(row.status)" link type="danger" :icon="Delete" @click="handleArchive(row)">归档</el-button>
            <el-button v-else link type="success" @click="handleRestore(row)">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- JobType Form Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="编码" prop="code">
          <el-input v-model="formData.code" placeholder="自动生成" disabled />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入工种名称" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio label="active">启用</el-radio>
            <el-radio label="inactive">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { jobTypeApi, type JobType } from '../../api/jobType'
import { confirmAndArchive, confirmAndRestore } from '@/composables/useArchive'

const loading = ref(false)
const jobTypeList = ref<JobType[]>([])
const includeArchived = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增工种')
const dialogMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()

const formData = reactive({
  id: 0,
  name: '',
  code: '',
  status: 'active'
})

const formRules: FormRules = {
  name: [{ required: true, message: '请输入工种名称', trigger: 'blur' }]
}

const isArchived = (s: string) => s === 'archived' || s === 'deleted'
const statusLabel = (s: string) => {
  if (s === 'active') return '启用'
  if (s === 'inactive') return '禁用'
  if (isArchived(s)) return '已归档'
  return s
}
const statusTagType = (s: string): 'success' | 'info' | 'warning' => {
  if (s === 'active') return 'success'
  if (isArchived(s)) return 'warning'
  return 'info'
}

const loadJobTypeList = async () => {
  try {
    loading.value = true
    const jobTypes = await jobTypeApi.getList({ includeArchived: includeArchived.value })
    jobTypeList.value = jobTypes
  } catch (error: any) {
    ElMessage.error(error.message || '加载工种列表失败')
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  try {
    dialogMode.value = 'create'
    dialogTitle.value = '新增工种'
    const nextCode = await jobTypeApi.getNextCode()
    Object.assign(formData, {
      id: 0,
      name: '',
      code: nextCode,
      status: 'active'
    })
    dialogVisible.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '获取工种编码失败')
  }
}

const handleEdit = (row: JobType) => {
  dialogMode.value = 'edit'
  dialogTitle.value = '编辑工种'
  Object.assign(formData, {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status
  })
  dialogVisible.value = true
}

const handleArchive = (row: JobType) =>
  confirmAndArchive({
    entityLabel: '工种',
    entityName: row.name,
    onArchive: () => jobTypeApi.delete(row.id),
    onSuccess: loadJobTypeList
  })

const handleRestore = (row: JobType) =>
  confirmAndRestore({
    entityLabel: '工种',
    entityName: row.name,
    onRestore: () => jobTypeApi.restore(row.id),
    onSuccess: loadJobTypeList
  })

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    if (dialogMode.value === 'create') {
      await jobTypeApi.create({
        name: formData.name,
        code: formData.code
      })
      ElMessage.success('创建成功')
    } else {
      await jobTypeApi.update(formData.id, {
        name: formData.name,
        code: formData.code,
        status: formData.status
      })
      ElMessage.success('更新成功')
    }

    dialogVisible.value = false
    loadJobTypeList()
  } catch (error: any) {
    if (error !== false) {
      ElMessage.error(error.message || '提交失败')
    }
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadJobTypeList()
})
</script>

<style scoped>
.job-type-list {
  padding: var(--space-6);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.header-content {
  flex: 1;
}

.page-title {
  margin: 0;
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-700);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.page-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.table-card {
  margin-bottom: var(--space-6);
}
</style>
