<template>
  <div class="salary-calculation">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">工资计算</h1>
        <p class="page-description">根据员工计费方式计算当月工资</p>
      </div>
      <el-button @click="showReport = true">
        <el-icon><DataAnalysis /></el-icon>查看报表
      </el-button>
    </div>

    <!-- Calculate Form -->
    <SalaryCalcForm
      :form="calcForm"
      :loading="calculating"
      @update:period="calcForm.period = $event"
      @calculate="handleCalculate"
    />

    <!-- Salary Bills List -->
    <el-card class="bills-card" shadow="never">
      <div class="bills-header">
        <h2>工资单列表</h2>
      </div>

      <el-table :data="salaryBills" v-loading="loadingBills" stripe>
        <el-table-column width="50" align="center">
          <template #default="{ row }">
            <el-button
              link
              :icon="rowRevealed[row.id] ? View : Hide"
              @click="toggleRowReveal(row.id)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="period" label="结算周期" width="120" />
        <el-table-column label="员工" width="150">
          <template #default="{ row }">
            {{ row.employee?.name }} ({{ row.employee?.code }})
          </template>
        </el-table-column>
        <el-table-column label="时薪金额" width="120">
          <template #default="{ row }">
            <div v-if="(row.hourlyAmount ?? 0) > 0">
              <div>{{ row.hourlyHours }}小时</div>
              <div class="amount clickable-amount" @click="toggleItemReveal(row.id, 'hourly')">{{ maskAmount(row.hourlyAmount ?? 0, { visible: rowRevealed[row.id] || itemRevealed[`${row.id}-hourly`] }) }}</div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="计件金额" width="120">
          <template #default="{ row }">
            <div v-if="(row.pieceAmount ?? 0) > 0">
              <div>{{ row.pieceCount }}件</div>
              <div class="amount clickable-amount" @click="toggleItemReveal(row.id, 'piece')">{{ maskAmount(row.pieceAmount ?? 0, { visible: rowRevealed[row.id] || itemRevealed[`${row.id}-piece`] }) }}</div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="其他工资" width="120">
          <template #default="{ row }">
            <div v-if="(row.otherAmount ?? 0) > 0">
              <div>{{ row.otherCount }}项</div>
              <div class="amount clickable-amount" @click="toggleItemReveal(row.id, 'other')">{{ maskAmount(row.otherAmount ?? 0, { visible: rowRevealed[row.id] || itemRevealed[`${row.id}-other`] }) }}</div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="总金额" width="120">
          <template #default="{ row }">
            <span class="total-amount clickable-amount" @click="toggleItemReveal(row.id, 'total')">{{ maskAmount(row.totalAmount ?? 0, { visible: rowRevealed[row.id] || itemRevealed[`${row.id}-total`] }) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="billStatusType(row.status)" size="small">
              {{ billStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewBillDetail(row.id)"> 查看明细 </el-button>
            <el-button
              v-if="row.status === 'pending'"
              link type="success"
              @click="approveBill(row)"
            >
              审核
            </el-button>
            <el-button
              v-if="row.status === 'approved'"
              link type="warning"
              @click="revokeBill(row)"
            >
              反审
            </el-button>
            <el-button
              v-if="row.status === 'approved'"
              link type="success"
              @click="issueBill(row)"
            >
              发放
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              link type="danger"
              @click="deleteBill(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          v-model:current-page="billsPagination.page"
          v-model:page-size="billsPagination.pageSize"
          :total="billsPagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleBillsSizeChange"
          @current-change="handleBillsPageChange"
        />
      </div>
    </el-card>

    <!-- Bill Detail Dialog -->
    <SalaryBillDetail
      v-model="detailDialogVisible"
      :bill="currentBill"
      @approve="approveCurrentBill"
      @revoke="revokeCurrentBill"
      @issue="issueCurrentBill"
    />

    <ReportDialog v-model="showReport" report-type="salary" title="工资报表" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, View, Hide } from '@element-plus/icons-vue'
import { salaryApi, type SalaryBill } from '../../api/salary'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'
import SalaryCalcForm from './SalaryCalcForm.vue'
import SalaryBillDetail from './SalaryBillDetail.vue'
import ReportDialog from '@/components/ReportDialog.vue'

const showReport = ref(false)
const calculating = ref(false)
const loadingBills = ref(false)

const { maskAmount } = useAmountPrivacy()

// 单据级：每行一个揭示状态（key = bill.id）
const rowRevealed = reactive<Record<number, boolean>>({})
const toggleRowReveal = (id: number) => { rowRevealed[id] = !rowRevealed[id] }

// 明细级：每个金额一个揭示状态（key = `${bill.id}-${field}`）
const itemRevealed = reactive<Record<string, boolean>>({})
const toggleItemReveal = (id: number, field: string) => {
  const key = `${id}-${field}`
  itemRevealed[key] = !itemRevealed[key]
}

const calcForm = reactive({
  period: ''
})

const salaryBills = ref<SalaryBill[]>([])
const billsPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const detailDialogVisible = ref(false)
const currentBill = ref<SalaryBill | null>(null)

const loadSalaryBills = async () => {
  try {
    loadingBills.value = true
    const response = await salaryApi.getSalaryBills({
      page: billsPagination.page,
      pageSize: billsPagination.pageSize,
      period: calcForm.period || undefined
    })
    salaryBills.value = response.list
    billsPagination.total = response.total
  } catch (error: any) {
    ElMessage.error(error.message || '加载工资单失败')
  } finally {
    loadingBills.value = false
  }
}

onMounted(() => {
  loadSalaryBills()
})

const handleCalculate = async () => {
  if (!calcForm.period) {
    ElMessage.warning('请选择结算周期')
    return
  }

  try {
    calculating.value = true

    await salaryApi.calculateSalary(calcForm.period)
    ElMessage.success('工资计算完成')

    // 计算完成后自动刷新工资单列表，筛选当前周期
    billsPagination.page = 1
    await loadSalaryBills()
  } catch (error: any) {
    ElMessage.error(error.message || '计算失败')
  } finally {
    calculating.value = false
  }
}

const handleBillsPageChange = (page: number) => {
  billsPagination.page = page
  loadSalaryBills()
}

const handleBillsSizeChange = (size: number) => {
  billsPagination.pageSize = size
  billsPagination.page = 1
  loadSalaryBills()
}

const viewBillDetail = async (billId: number) => {
  try {
    const bill = await salaryApi.getSalaryBillDetail(billId)
    currentBill.value = bill
    detailDialogVisible.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '获取工资单详情失败')
  }
}

const approveBill = async (bill: SalaryBill) => {
  try {
    await ElMessageBox.confirm(`确定要审核通过 "${bill.employee?.name}" 的工资单吗？`, '确认审核', {
      type: 'warning'
    })

    await salaryApi.approveSalaryBill(bill.id)
    ElMessage.success('审核成功')
    loadSalaryBills()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '审核失败')
    }
  }
}

const approveCurrentBill = async (bill: SalaryBill) => {
  try {
    await ElMessageBox.confirm(
      `确定要审核通过 "${bill.employee?.name}" 的工资单吗？`,
      '确认审核',
      { type: 'warning' }
    )

    await salaryApi.approveSalaryBill(bill.id)
    ElMessage.success('审核成功')
    detailDialogVisible.value = false
    loadSalaryBills()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '审核失败')
    }
  }
}

const revokeBill = async (bill: SalaryBill) => {
  try {
    await ElMessageBox.confirm(
      `确定要反审 "${bill.employee?.name}" 的工资单吗？反审后工资单将恢复为待审核状态。`,
      '确认反审',
      { type: 'warning' }
    )

    await salaryApi.revokeSalaryBill(bill.id)
    ElMessage.success('反审成功')
    loadSalaryBills()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '反审失败')
    }
  }
}

const revokeCurrentBill = async (bill: SalaryBill) => {
  try {
    await ElMessageBox.confirm(
      `确定要反审 "${bill.employee?.name}" 的工资单吗？反审后关联的计件/工时记录将解锁，可重新修改。`,
      '确认反审',
      { type: 'warning' }
    )

    await salaryApi.revokeSalaryBill(bill.id)
    ElMessage.success('反审成功')
    detailDialogVisible.value = false
    loadSalaryBills()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '反审失败')
    }
  }
}

const billStatusType = (status: string) =>
  ({ pending: 'warning', approved: 'success', issued: 'primary' } as Record<string, string>)[status] || 'info'

const billStatusLabel = (status: string) =>
  ({ pending: '待审核', approved: '已审核', issued: '已发放' } as Record<string, string>)[status] || status

const issueBill = async (bill: SalaryBill) => {
  try {
    await ElMessageBox.confirm(
      `确定要发放 "${bill.employee?.name}" 的工资单吗？发放后数据将固化，不可再反审或修改。`,
      '确认发放',
      { type: 'warning' }
    )

    await salaryApi.issueSalaryBill(bill.id)
    ElMessage.success('发放成功，数据已固化')
    loadSalaryBills()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '发放失败')
    }
  }
}

const issueCurrentBill = async (bill: SalaryBill) => {
  try {
    await ElMessageBox.confirm(
      `确定要发放 "${bill.employee?.name}" 的工资单吗？发放后数据将固化，不可再反审或修改。`,
      '确认发放',
      { type: 'warning' }
    )

    await salaryApi.issueSalaryBill(bill.id)
    ElMessage.success('发放成功，数据已固化')
    detailDialogVisible.value = false
    loadSalaryBills()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '发放失败')
    }
  }
}

const deleteBill = async (bill: SalaryBill) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 "${bill.employee?.name}" 的工资单吗？删除后可修改原始记录并重新计算。`,
      '确认删除',
      { type: 'warning' }
    )

    await salaryApi.deleteSalaryBill(bill.id)
    ElMessage.success('删除成功')
    loadSalaryBills()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}
</script>

<style scoped>
.salary-calculation {
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

.bills-card {
  margin-bottom: var(--space-6);
}

.bills-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.bills-header h2 {
  margin: 0;
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-450);
}

.amount,
.total-amount {
  font-weight: var(--font-weight-550);
  color: var(--color-success);
}

.total-amount {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-700);
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-4);
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
