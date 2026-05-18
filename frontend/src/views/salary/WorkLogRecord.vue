<template>
  <div class="work-log-record">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          工时录入
        </h1>
        <p class="page-description">
          记录员工的每日工时，用于工资核算
        </p>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
        @click="handleCreate"
      >
        新增工时
      </el-button>
    </div>

    <!-- Filter Bar -->
    <el-card
      class="search-card"
      shadow="never"
    >
      <el-form
        :model="searchForm"
        inline
      >
        <el-form-item label="员工">
          <el-select
            v-model="searchForm.employeeId"
            placeholder="全部员工"
            clearable
            filterable
            style="width: 160px"
          >
            <el-option
              v-for="emp in activeEmployees"
              :key="emp.id"
              :label="emp.name"
              :value="emp.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :icon="Search"
            @click="handleSearch"
          >
            搜索
          </el-button>
          <el-button
            :icon="Refresh"
            @click="handleReset"
          >
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Data Table -->
    <el-card
      class="table-card"
      shadow="never"
    >
      <el-table
        v-loading="loading"
        :data="recordList"
        stripe
        style="width: 100%"
      >
        <el-table-column width="50" align="center">
          <template #default="{ row }">
            <el-button link :icon="rowRevealed[row.id] ? View : Hide" @click="toggleRowReveal(row.id)" />
          </template>
        </el-table-column>
        <el-table-column
          label="日期"
          width="120"
        >
          <template #default="{ row }">
            {{ formatDate(row.date) }}
          </template>
        </el-table-column>
        <el-table-column
          label="员工"
          width="130"
        >
          <template #default="{ row }">
            {{ row.employee?.name || '-' }}
            <span style="font-size:11px;color:var(--color-text-secondary)">
              ({{ row.employee?.code || '' }})
            </span>
          </template>
        </el-table-column>
        <el-table-column
          label="工时(小时)"
          width="110"
        >
          <template #default="{ row }">
            {{ row.hours }}
          </template>
        </el-table-column>
        <el-table-column
          label="时薪(元)"
          width="100"
        >
          <template #default="{ row }">
            <span class="clickable-amount" @click="toggleItemReveal(row.id, 'rate')">{{ maskAmount(row.employee?.hourlyRate, { visible: rowRevealed[row.id] || itemRevealed[`${row.id}-rate`] }) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="小计(元)"
          width="110"
        >
          <template #default="{ row }">
            <span class="subtotal">
              <span class="clickable-amount" @click="toggleItemReveal(row.id, 'subtotal')">{{ maskAmount((row.hours || 0) * (row.employee?.hourlyRate || 0), { visible: rowRevealed[row.id] || itemRevealed[`${row.id}-subtotal`] }) }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="remark"
          label="备注"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          label="操作"
          width="150"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :icon="Edit"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              link
              type="danger"
              :icon="Delete"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
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

    <!-- Form Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="460px"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <el-form-item
          label="员工"
          prop="employeeId"
        >
          <el-select
            v-model="form.employeeId"
            placeholder="选择员工"
            filterable
            style="width: 100%"
            :disabled="isEdit"
          >
            <el-option
              v-for="emp in activeEmployees"
              :key="emp.id"
              :label="`${emp.name} (${emp.code})`"
              :value="emp.id"
            />
            <template #empty>
              <div class="select-empty-tip">暂无时薪员工，请先在员工管理中添加</div>
            </template>
          </el-select>
        </el-form-item>
        <el-form-item
          label="日期"
          prop="date"
        >
          <el-date-picker
            v-model="form.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item
          label="工时"
          prop="hours"
        >
          <el-input-number
            v-model="form.hours"
            :min="0.5"
            :max="24"
            :step="0.5"
            :precision="1"
            style="width: 100%"
          >
            <template #suffix>
              小时
            </template>
          </el-input-number>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            placeholder="备注信息"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete } from '@element-plus/icons-vue'
import { workLogApi, type WorkLog } from '@/api/workLog'
import { employeeApi } from '@/api/employee'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'
import { View, Hide } from '@element-plus/icons-vue'

const { maskAmount } = useAmountPrivacy()

const loading = ref(false)
const recordList = ref<WorkLog[]>([])
const activeEmployees = ref<any[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增工时')
const isEdit = ref(false)
const currentId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const dateRange = ref<string[]>([])

const searchForm = reactive({ employeeId: undefined as number | undefined })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const form = reactive({
  employeeId: undefined as number | undefined,
  date: '',
  hours: 8,
  remark: ''
})

const rules: FormRules = {
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  hours: [{ required: true, message: '请输入工时', trigger: 'blur' }]
}

const formatDate = (date: string) => new Date(date).toLocaleDateString('zh-CN')

// 单据级 + 明细级揭示
const rowRevealed = reactive<Record<number, boolean>>({})
const toggleRowReveal = (id: number) => { rowRevealed[id] = !rowRevealed[id] }
const itemRevealed = reactive<Record<string, boolean>>({})
const toggleItemReveal = (logId: number, field: string) => {
  const key = `${logId}-${field}`
  itemRevealed[key] = !itemRevealed[key]
}

const loadRecordList = async () => {
  try {
    loading.value = true
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (searchForm.employeeId) params.employeeId = searchForm.employeeId
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const res = await workLogApi.getList(params)
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
    activeEmployees.value = res.list
  } catch { /* ignore */ }
}

const handleSearch = () => { pagination.page = 1; loadRecordList() }
const handleReset = () => {
  searchForm.employeeId = undefined
  dateRange.value = []
  pagination.page = 1
  loadRecordList()
}
const handlePageChange = (p: number) => { pagination.page = p; loadRecordList() }
const handleSizeChange = () => { pagination.page = 1; loadRecordList() }

const handleCreate = () => {
  isEdit.value = false
  dialogTitle.value = '新增工时'
  currentId.value = null
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row: WorkLog) => {
  isEdit.value = true
  dialogTitle.value = '编辑工时'
  currentId.value = row.id
  form.employeeId = row.employeeId
  form.date = row.date?.slice(0, 10)
  form.hours = row.hours
  form.remark = row.remark || ''
  dialogVisible.value = true
}

const handleDelete = async (row: WorkLog) => {
  try {
    await ElMessageBox.confirm('确定删除该工时记录吗？', '确认删除', { type: 'warning' })
    await workLogApi.delete(row.id)
    ElMessage.success('删除成功')
    loadRecordList()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除失败')
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const data = {
      employeeId: form.employeeId!,
      date: form.date,
      hours: form.hours,
      remark: form.remark || undefined
    }
    if (isEdit.value && currentId.value) {
      await workLogApi.update(currentId.value, data)
      ElMessage.success('更新成功')
    } else {
      await workLogApi.create(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadRecordList()
  } catch (error: any) {
    if (error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  form.employeeId = undefined
  form.date = ''
  form.hours = 8
  form.remark = ''
}

onMounted(() => {
  loadEmployees()
  loadRecordList()
})
</script>

<style scoped>
.work-log-record {
  padding: var(--space-6);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}
.header-content { flex: 1; }
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
.search-card, .table-card { margin-bottom: var(--space-6); }
.subtotal {
  font-weight: var(--font-weight-600);
  color: var(--color-primary);
}
.pagination { display: flex; justify-content: flex-end; margin-top: var(--space-6); }

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
