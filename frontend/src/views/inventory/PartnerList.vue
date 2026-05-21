<template>
  <div class="page-container">
    <div class="page-header">
      <h1>往来管理</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新增往来单位
      </el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索名称、编码或联系人"
          clearable
          style="width: 260px"
          @keyup.enter="loadData"
        />
        <el-select v-model="roleFilter" placeholder="身份" clearable style="width: 140px" @change="loadData">
          <el-option label="客户" value="customer" />
          <el-option label="供应商" value="supplier" />
        </el-select>
        <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 120px" @change="loadData">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
          <el-option label="已归档" value="archived" />
        </el-select>
        <el-switch
          v-model="includeArchived"
          active-text="显示已归档"
          @change="loadData"
        />
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column label="身份" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.isCustomer" type="primary" size="small" style="margin-right:4px">客户</el-tag>
            <el-tag v-if="row.isSupplier" type="warning" size="small">供应商</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contact" label="联系人" width="100" />
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="address" label="地址" min-width="180" show-overflow-tooltip />
        <el-table-column label="信用额度" width="120">
          <template #default="{ row }">
            <span v-if="row.isCustomer && row.creditLimit > 0" class="clickable-amount" @click="toggleItemReveal(row.id)">
              {{ maskAmount(row.creditLimit, { visible: itemRevealed[`${row.id}`] }) }}
            </span>
            <span v-else style="color: var(--color-text-muted)">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" :disabled="row.status === 'archived'">编辑</el-button>
            <el-button v-if="row.status !== 'archived'" link type="danger" @click="handleArchive(row)">归档</el-button>
            <el-button v-else link type="success" @click="handleRestore(row)">恢复</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑往来单位' : '新增往来单位'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="身份" prop="identities" required>
          <el-checkbox-group v-model="form.identities">
            <el-checkbox label="customer">客户</el-checkbox>
            <el-checkbox label="supplier">供应商</el-checkbox>
          </el-checkbox-group>
          <div style="color:var(--color-text-muted); font-size:12px; margin-top:4px">至少选择一种身份；可同时勾选两种</div>
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入编码" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="form.contact" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" placeholder="请输入地址" />
        </el-form-item>
        <el-form-item v-if="form.identities.includes('customer')" label="信用额度">
          <el-input-number v-model="form.creditLimit" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="isEdit" label="状态">
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
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { partnerApi, type Partner } from '@/api/partner'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'
import { confirmAndArchive, confirmAndRestore } from '@/composables/useArchive'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<Partner[]>([])
const total = ref(0)
const includeArchived = ref(false)
const roleFilter = ref<'' | 'customer' | 'supplier'>('')

const { maskAmount } = useAmountPrivacy()
const itemRevealed = reactive<Record<string, boolean>>({})
const toggleItemReveal = (id: number) => {
  const key = `${id}`
  itemRevealed[key] = !itemRevealed[key]
}

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
  contact: '',
  phone: '',
  address: '',
  identities: [] as Array<'customer' | 'supplier'>,
  creditLimit: 0,
  status: 'active'
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  identities: [
    {
      validator: (_rule, value, callback) => {
        if (!Array.isArray(value) || value.length === 0) {
          callback(new Error('至少选择一种身份'))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]
}

const statusLabel = (s: string) => s === 'active' ? '启用' : s === 'inactive' ? '停用' : s === 'archived' ? '已归档' : s
const statusTagType = (s: string): 'success' | 'info' | 'warning' => s === 'active' ? 'success' : s === 'archived' ? 'warning' : 'info'

const listParams = computed(() => {
  const p: any = { ...queryParams, includeArchived: includeArchived.value }
  if (roleFilter.value === 'customer') p.isCustomer = true
  if (roleFilter.value === 'supplier') p.isSupplier = true
  return p
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await partnerApi.getList(listParams.value)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const openDialog = (row?: Partner) => {
  isEdit.value = !!row
  editId.value = row?.id || 0
  form.name = row?.name || ''
  form.code = row?.code || ''
  form.contact = row?.contact || ''
  form.phone = row?.phone || ''
  form.address = row?.address || ''
  form.creditLimit = row?.creditLimit || 0
  form.status = row?.status || 'active'
  form.identities = []
  if (row?.isCustomer) form.identities.push('customer')
  if (row?.isSupplier) form.identities.push('supplier')
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  submitting.value = true
  try {
    const payload: any = {
      name: form.name,
      code: form.code,
      contact: form.contact || null,
      phone: form.phone || null,
      address: form.address || null,
      isCustomer: form.identities.includes('customer'),
      isSupplier: form.identities.includes('supplier'),
      creditLimit: form.identities.includes('customer') ? form.creditLimit : 0
    }
    if (isEdit.value) {
      payload.status = form.status
      await partnerApi.update(editId.value, payload)
      ElMessage.success('更新成功')
    } else {
      await partnerApi.create(payload)
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

const handleArchive = (row: Partner) =>
  confirmAndArchive({
    entityLabel: '往来单位',
    entityName: row.name,
    onArchive: () => partnerApi.delete(row.id),
    onSuccess: loadData
  })

const handleRestore = (row: Partner) =>
  confirmAndRestore({
    entityLabel: '往来单位',
    entityName: row.name,
    onRestore: () => partnerApi.restore(row.id),
    onSuccess: loadData
  })

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
  align-items: center;
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
