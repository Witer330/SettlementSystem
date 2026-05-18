<template>
  <div class="page-container">
    <div class="page-header">
      <h1>产品管理</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新增产品
      </el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索名称或编码"
          clearable
          style="width: 240px"
          @keyup.enter="loadData"
        />
        <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 120px" @change="loadData">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="specification" label="规格" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column label="售价" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.price > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }" class="clickable-amount" @click="toggleItemReveal(row.id, 'price')">
              {{ row.price > 0 ? maskAmount(row.price, { visible: itemRevealed[`${row.id}-price`] }) : '未设置' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="计件单价" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.unitPrice > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }" class="clickable-amount" @click="toggleItemReveal(row.id, 'unitPrice')">
              {{ row.unitPrice > 0 ? maskAmount(row.unitPrice, { visible: itemRevealed[`${row.id}-unitPrice`] }) : '未设置' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="queryParams.page"
        v-model:page-size="queryParams.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadData"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑产品' : '新增产品'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入产品名称" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入产品编码" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-input v-model="form.category" placeholder="请输入产品分类" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="form.specification" placeholder="如 Φ100×20" />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="form.unit" placeholder="如 个、件、套" />
        </el-form-item>
        <el-form-item label="售价">
          <el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" placeholder="不填则默认为0（赠品）" />
        </el-form-item>
        <el-form-item label="计件单价">
          <el-input-number v-model="form.unitPrice" :min="0" :precision="2" style="width:100%" placeholder="计件工资单价" />
        </el-form-item>
        <el-form-item label="状态" v-if="isEdit">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { productApi, type Product } from '@/api/product'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<Product[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const formRef = ref<FormInstance>()

const queryParams = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
})

const form = reactive({
  name: '',
  code: '',
  category: '',
  specification: '',
  unit: '',
  price: 0,
  unitPrice: 0,
  status: 'active'
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入产品编码', trigger: 'blur' }],
  category: [{ required: true, message: '请输入产品分类', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await productApi.getList(queryParams)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const openDialog = (row?: Product) => {
  isEdit.value = !!row
  editId.value = row?.id || 0
  form.name = row?.name || ''
  form.code = row?.code || ''
  form.category = row?.category || ''
  form.specification = row?.specification || ''
  form.unit = row?.unit || ''
  form.price = row?.price || 0
  form.unitPrice = row?.unitPrice || 0
  form.status = row?.status || 'active'
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  submitting.value = true
  try {
    if (isEdit.value) {
      await productApi.update(editId.value, { ...form })
      ElMessage.success('更新成功')
    } else {
      await productApi.create({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const { maskAmount } = useAmountPrivacy()

const itemRevealed = reactive<Record<string, boolean>>({})
const toggleItemReveal = (id: number, field: string) => {
  const key = `${id}-${field}`
  itemRevealed[key] = !itemRevealed[key]
}

const handleDelete = async (row: Product) => {
  await ElMessageBox.confirm(`确定要删除产品"${row.name}"吗？`, '确认删除', { type: 'warning' })
  await productApi.delete(row.id)
  ElMessage.success('删除成功')
  loadData()
}

onMounted(() => loadData())
</script>

<style scoped>
.page-container {
  padding: var(--space-6);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}
.page-header h1 {
  margin: 0;
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-600);
}
.filter-bar {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.clickable-amount {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s;
  display: inline-block;
}
.clickable-amount:hover {
  background-color: var(--el-fill-color-light);
}
</style>
