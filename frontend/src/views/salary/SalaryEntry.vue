<template>
  <div class="page-container">
    <div class="page-header">
      <h1>工资录入</h1>
      <div class="page-header-actions">
        <el-button type="primary" @click="openNewSheet"><el-icon><Plus /></el-icon>新增明细单</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-select v-model="filters.employeeId" placeholder="员工" clearable filterable style="width:150px" @change="loadData">
          <el-option v-for="e in employees" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
        <el-select v-model="filters.type" placeholder="类型" clearable style="width:120px" @change="loadData">
          <el-option label="计件" value="piece" /><el-option label="计时" value="hourly" /><el-option label="其他" value="other" />
        </el-select>
        <el-date-picker v-model="filters.dateRange" type="month" placeholder="月份" format="YYYY-MM" value-format="YYYY-MM" @change="loadData" />
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:110px" @change="loadData">
          <el-option label="待审核" value="draft" /><el-option label="已审核" value="approved" />
        </el-select>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe style="width:100%">
        <el-table-column prop="sheetNo" label="单号" width="160" />
        <el-table-column label="日期" width="110" align="center"><template #default="{ row }">{{ new Date(row.batchDate).toLocaleDateString('zh-CN') }}</template></el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }"><el-tag :type="row.status === 'approved' ? 'success' : 'warning'" size="small">{{ row.status === 'approved' ? '已审核' : '待审核' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="明细概要" min-width="280"><template #default="{ row }">{{ row.items?.map((i: any) => `${i.employee?.name || '#' + i.employeeId}:${typeLabel(i.type)} ${i.amount}元`).join('；') }}</template></el-table-column>
        <el-table-column label="合计" width="100" align="right"><template #default="{ row }">{{ row.items?.reduce((s: number, i: any) => s + i.amount, 0).toFixed(2) }} 元</template></el-table-column>
        <el-table-column label="制单人" width="80" align="center" prop="creator" />
        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditSheet(row)">查看</el-button>
            <el-button v-if="row.status === 'draft'" link type="success" @click="approveSheet(row)">审核</el-button>
            <el-button v-if="row.status === 'approved'" link type="warning" @click="unapproveSheet(row)">反审</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="loadData" style="margin-top:16px;justify-content:flex-end" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { salaryDetailApi, type SalaryDetailSheet } from '@/api/salaryDetail'
import { employeeApi } from '@/api/employee'
import { useTabStore } from '@/stores/tabs'

const tabStore = useTabStore()
const loading = ref(false)
const tableData = ref<SalaryDetailSheet[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const employees = ref<any[]>([])
const filters = reactive({ employeeId: null as number | null, type: '', dateRange: '', status: '' })

const typeLabel = (t: string) => ({ piece: '计件', hourly: '计时', other: '其他' } as Record<string, string>)[t] || t

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filters.employeeId) params.employeeId = filters.employeeId
    if (filters.type) params.type = filters.type
    if (filters.status) params.status = filters.status
    if (filters.dateRange) { const [y, m] = filters.dateRange.split('-'); params.startDate = `${y}-${m}-01`; params.endDate = new Date(+y, +m, 0).toISOString().slice(0, 10) }
    const r = await salaryDetailApi.getList(params)
    tableData.value = r.list; total.value = r.total
  } finally { loading.value = false }
}

function openNewSheet() { tabStore.addTab('salary-detail', '明细单 - 新建', { isNew: true }) }
function openEditSheet(row: SalaryDetailSheet) { tabStore.addTab('salary-detail', '明细单 - ' + row.sheetNo, { sheetId: row.id }) }

async function approveSheet(row: SalaryDetailSheet) {
  try { await ElMessageBox.confirm(`审核通过"${row.sheetNo}"？`, '审核确认', { type: 'info' }) } catch { return }
  await salaryDetailApi.approve(row.id); ElMessage.success('已审核'); loadData()
}
async function unapproveSheet(row: SalaryDetailSheet) {
  try { await ElMessageBox.confirm(`反审"${row.sheetNo}"？`, '反审确认', { type: 'warning' }) } catch { return }
  try { await salaryDetailApi.unapprove(row.id); ElMessage.success('已反审'); loadData() } catch (e: any) { ElMessage.error(e.message) }
}

onMounted(async () => {
  const emps = new Date().getMonth() + 1
  filters.dateRange = `${new Date().getFullYear()}-${String(emps).padStart(2, '0')}`
  employeeApi.getList({ page: 1, pageSize: 1000, status: 'active' }).then(r => employees.value = r.list)
  loadData()
})
</script>

<style scoped>
.page-container { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.page-header h1 { margin: 0; font-size: var(--font-size-h3); font-weight: var(--font-weight-600); }
.filter-bar { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
</style>
