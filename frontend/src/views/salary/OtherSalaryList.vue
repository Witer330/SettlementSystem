<template>
  <div class="other-salary">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">其他工资</h1>
        <p class="page-description">录入奖金、绩效、一次性任务费等额外工资项</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新增记录</el-button>
    </div>

    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="员工">
          <el-select v-model="searchForm.employeeId" placeholder="全部员工" clearable filterable style="width: 160px">
            <el-option v-for="emp in employees" :key="emp.id" :label="emp.name" :value="emp.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 130px">
            <el-option label="奖金" value="bonus" />
            <el-option label="绩效" value="performance" />
            <el-option label="一次性任务" value="task" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table v-loading="loading" :data="recordList" stripe>
        <el-table-column label="日期" width="120">
          <template #default="{ row }">{{ new Date(row.date).toLocaleDateString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column label="员工" width="140">
          <template #default="{ row }">
            {{ row.employee?.name || '-' }}
            <span style="font-size:11px;color:var(--color-text-secondary)">({{ row.employee?.code || '' }})</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.type)" size="small">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="130">
          <template #default="{ row }">
            <span class="amount">¥{{ row.amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="员工" prop="employeeId">
          <el-select v-model="form.employeeId" placeholder="选择员工" filterable style="width: 100%" :disabled="isEdit">
            <el-option v-for="emp in employees" :key="emp.id" :label="`${emp.name} (${emp.code})`" :value="emp.id" />
            <template #empty><div class="select-empty-tip">暂无员工，请先在员工管理中添加</div></template>
          </el-select>
        </el-form-item>
        <el-form-item label="日期" prop="date">
          <el-date-picker v-model="form.date" type="date" placeholder="选择日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="选择类型" style="width: 100%">
            <el-option label="奖金" value="bonus" />
            <el-option label="绩效" value="performance" />
            <el-option label="一次性任务" value="task" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="如：完成XX项目奖励" />
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
import { Plus, Search, Refresh, Edit, Delete } from '@element-plus/icons-vue'
import { otherSalaryApi, type OtherSalary } from '@/api/otherSalary'
import { employeeApi } from '@/api/employee'

const loading = ref(false)
const recordList = ref<OtherSalary[]>([])
const employees = ref<any[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增其他工资')
const isEdit = ref(false)
const currentId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const dateRange = ref<string[]>([])

const searchForm = reactive({ employeeId: undefined as number | undefined, type: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const form = reactive({
  employeeId: undefined as number | undefined,
  date: '',
  type: 'task' as string,
  amount: 0,
  remark: ''
})

const rules: FormRules = {
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }]
}

const typeLabel = (t: string) => ({ bonus: '奖金', performance: '绩效', task: '一次性任务' } as Record<string, string>)[t] || t
const typeTagType = (t: string) => ({ bonus: 'danger', performance: 'warning', task: 'primary' } as Record<string, string>)[t] || 'info'

const loadRecords = async () => {
  try {
    loading.value = true
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (searchForm.employeeId) params.employeeId = searchForm.employeeId
    if (searchForm.type) params.type = searchForm.type
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const res = await otherSalaryApi.getList(params)
    recordList.value = res.list
    pagination.total = res.total
  } catch (error: any) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const loadEmployees = async () => {
  try {
    const res = await employeeApi.getList({ page: 1, pageSize: 1000, status: 'active' })
    employees.value = res.list
  } catch { /* ignore */ }
}

const handleSearch = () => { pagination.page = 1; loadRecords() }
const handleReset = () => { searchForm.employeeId = undefined; searchForm.type = ''; dateRange.value = []; pagination.page = 1; loadRecords() }
const handlePageChange = (p: number) => { pagination.page = p; loadRecords() }
const handleSizeChange = () => { pagination.page = 1; loadRecords() }

const handleCreate = () => {
  isEdit.value = false; dialogTitle.value = '新增其他工资'; currentId.value = null; resetForm(); dialogVisible.value = true
}

const handleEdit = (row: OtherSalary) => {
  isEdit.value = true; dialogTitle.value = '编辑其他工资'; currentId.value = row.id
  form.employeeId = row.employeeId; form.date = row.date?.slice(0, 10)
  form.type = row.type; form.amount = row.amount; form.remark = row.remark || ''
  dialogVisible.value = true
}

const handleDelete = async (row: OtherSalary) => {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '确认删除', { type: 'warning' })
    await otherSalaryApi.delete(row.id)
    ElMessage.success('删除成功')
    loadRecords()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const data = { employeeId: form.employeeId!, date: form.date, type: form.type, amount: form.amount, remark: form.remark || undefined }
    if (isEdit.value && currentId.value) {
      await otherSalaryApi.update(currentId.value, data)
      ElMessage.success('更新成功')
    } else {
      await otherSalaryApi.create(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadRecords()
  } catch (error: any) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  form.employeeId = undefined; form.date = ''; form.type = 'task'; form.amount = 0; form.remark = ''
}

onMounted(() => { loadEmployees(); loadRecords() })
</script>

<style scoped>
.other-salary { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
.header-content { flex: 1; }
.page-title { margin: 0; font-size: var(--font-size-h1); font-weight: var(--font-weight-700); color: var(--color-text-primary); margin-bottom: var(--space-2); }
.page-description { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.search-card, .table-card { margin-bottom: var(--space-6); }
.amount { font-weight: var(--font-weight-600); color: var(--color-primary); }
.pagination { display: flex; justify-content: flex-end; margin-top: var(--space-6); }
</style>
