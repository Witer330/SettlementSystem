<template>
  <div class="page-container">
    <div class="page-header">
      <h1>物料管理</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新增物料
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
        <el-select v-model="queryParams.category" placeholder="分类" clearable style="width: 140px" @change="loadData">
          <el-option label="原材料" value="原材料" />
          <el-option label="辅料" value="辅料" />
          <el-option label="包装材料" value="包装材料" />
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
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="specification" label="规格" width="120" />
        <el-table-column prop="unit" label="基本单位" width="80" />
        <el-table-column prop="defaultUnit" label="默认使用单位" width="120">
          <template #default="{ row }">{{ row.defaultUnit || row.unit }}</template>
        </el-table-column>
        <el-table-column prop="safeStock" label="安全库存" width="100" />
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
            <el-button
              v-if="row.status !== 'archived'"
              link type="danger"
              @click="handleArchive(row)"
            >归档</el-button>
            <el-button
              v-else
              link type="success"
              @click="handleRestore(row)"
            >恢复</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑物料' : '新增物料'" width="620px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="编码" prop="code"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select v-model="form.category" style="width:100%"><el-option label="原材料" value="原材料" /><el-option label="辅料" value="辅料" /><el-option label="包装材料" value="包装材料" /></el-select>
        </el-form-item>
        <el-form-item label="规格"><el-input v-model="form.specification" /></el-form-item>
        <el-form-item label="基本单位" prop="unit"><el-input v-model="form.unit" placeholder="如 个、kg、米" /></el-form-item>
        <el-form-item label="默认使用单位">
          <el-select v-model="form.defaultUnit" placeholder="默认使用单位" clearable style="width:100%">
            <el-option :label="`基本单位（${form.unit || '个'}）`" :value="form.unit" />
            <el-option v-for="pkg in pkgSpecs" :key="pkg.unitName" :label="`${pkg.name}（${pkg.unitName}）`" :value="pkg.unitName" />
          </el-select>
        </el-form-item>
        <el-form-item label="条码"><el-input v-model="form.barcode" /></el-form-item>
        <el-form-item label="安全库存"><el-input-number v-model="form.safeStock" :min="0" style="width:100%" /></el-form-item>
      </el-form>

      <div v-if="isEdit" style="margin-top:12px">
        <h4 style="margin-bottom:8px">包装规格 <el-button size="small" @click="addPkgRow">+ 添加</el-button></h4>
        <el-table :data="pkgSpecs" border size="small" style="width:100%">
          <el-table-column label="包装名" min-width="80"><template #default="{ row }"><el-input v-model="row.name" size="small" placeholder="小箱" /></template></el-table-column>
          <el-table-column label="单位" width="80"><template #default="{ row }"><el-input v-model="row.unitName" size="small" placeholder="箱" /></template></el-table-column>
          <el-table-column label="换算比" width="140"><template #default="{ row }"><span style="margin-right:4px">1{{ row.unitName || '箱' }} =</span><el-input-number v-model="row.ratio" :min="1" size="small" style="width:70px" />{{ form.unit || '个' }}</template></el-table-column>
          <el-table-column label="默认" width="60" align="center"><template #default="{ row }"><el-radio v-model="defaultPkgIndex" :value="pkgSpecs.indexOf(row)" size="small" /></template></el-table-column>
          <el-table-column width="50" align="center"><template #default="{ $index }"><el-button link type="danger" size="small" @click="pkgSpecs.splice($index, 1)">✕</el-button></template></el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { materialApi, type Material } from '@/api/material'
import { pkgSpecApi } from '@/api/pkgSpec'
import { confirmAndArchive, confirmAndRestore } from '@/composables/useArchive'

const loading = ref(false)
const submitting = ref(false)
const pkgSpecs = ref<Array<{ name: string; unitName: string; ratio: number }>>([])
const defaultPkgIndex = ref(0)
function addPkgRow() { pkgSpecs.value.push({ name: '', unitName: '箱', ratio: 1 }) }
const tableData = ref<Material[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const formRef = ref<FormInstance>()
const includeArchived = ref(false)

const queryParams = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  category: ''
})

const form = reactive({
  name: '',
  code: '',
  category: '',
  specification: '',
  unit: '',
  defaultUnit: '' as string | null,
  barcode: '',
  safeStock: 0
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入物料名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入物料编码', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }]
}

const statusLabel = (s: string) => s === 'active' ? '启用' : s === 'inactive' ? '停用' : s === 'archived' ? '已归档' : s
const statusTagType = (s: string): 'success' | 'info' | 'warning' => s === 'active' ? 'success' : s === 'archived' ? 'warning' : 'info'

const loadData = async () => {
  loading.value = true
  try {
    const res = await materialApi.getList({ ...queryParams, includeArchived: includeArchived.value })
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const openDialog = async (row?: Material) => {
  isEdit.value = !!row
  editId.value = row?.id || 0
  form.name = row?.name || ''; form.code = row?.code || ''; form.category = row?.category || ''
  form.specification = row?.specification || ''; form.unit = row?.unit || ''
  form.defaultUnit = row?.defaultUnit || null; form.barcode = row?.barcode || ''; form.safeStock = row?.safeStock || 0
  pkgSpecs.value = []; defaultPkgIndex.value = 0
  if (row?.id) {
    try {
      const specs = await pkgSpecApi.getList('material', row.id)
      pkgSpecs.value = specs.map((s: any) => ({ name: s.name, unitName: s.unitName, ratio: s.ratio }))
      defaultPkgIndex.value = specs.findIndex((s: any) => s.isDefault)
    } catch {}
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  submitting.value = true
  try {
    if (isEdit.value) {
      await materialApi.update(editId.value, { ...form })
      if (pkgSpecs.value.length > 0) {
        await pkgSpecApi.save('material', editId.value, pkgSpecs.value.map((s, i) => ({ ...s, isDefault: i === defaultPkgIndex.value })))
      }
      ElMessage.success('更新成功')
    } else {
      await materialApi.create({ ...form })
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

const handleArchive = (row: Material) =>
  confirmAndArchive({
    entityLabel: '物料',
    entityName: row.name,
    onArchive: () => materialApi.delete(row.id),
    onSuccess: loadData
  })

const handleRestore = (row: Material) =>
  confirmAndRestore({
    entityLabel: '物料',
    entityName: row.name,
    onRestore: () => materialApi.restore(row.id),
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
}
</style>
