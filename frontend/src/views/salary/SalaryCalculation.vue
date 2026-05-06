<template>
  <div class="salary-calculation">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">工资计算</h1>
        <p class="page-description">根据员工计费方式计算当月工资</p>
      </div>
    </div>

    <!-- Calculate Form -->
    <SalaryCalcForm
      :form="calcForm"
      :loading="calculating"
      @update:period="calcForm.period = $event"
      @update:employee-scope="calcForm.employeeScope = $event"
      @calculate="handleCalculate"
    />

    <!-- Results Table -->
    <el-card class="result-card" shadow="never" v-if="calculationResults.length > 0">
      <div class="result-header">
        <h2>计算结果</h2>
        <el-button type="primary" size="small" @click="loadSalaryBills"> 查看工资单 </el-button>
      </div>

      <el-table :data="calculationResults" stripe>
        <el-table-column prop="employeeName" label="员工姓名" width="120" />
        <el-table-column prop="payType" label="计费方式" width="100">
          <template #default="{ row }">
            <el-tag :type="row.payType === 'piece' ? 'success' : 'warning'" size="small">
              {{ row.payType === 'piece' ? '计件' : '时薪' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时薪部分" width="120">
          <template #default="{ row }">
            <div v-if="row.payType === 'hourly'">
              <div>{{ row.hourlyHours }}小时</div>
              <div class="amount">¥{{ row.hourlyAmount.toFixed(2) }}</div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="计件部分" width="120">
          <template #default="{ row }">
            <div v-if="row.payType === 'piece'">
              <div>{{ row.pieceCount }}件</div>
              <div class="amount">¥{{ row.pieceAmount.toFixed(2) }}</div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="总金额" width="120">
          <template #default="{ row }">
            <span class="total-amount">¥{{ (row.totalAmount || row.amount).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'approved' ? 'success' : 'info'" size="small">
              {{ row.status === 'approved' ? '已审核' : '待审核' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewBillDetail(row.billId)">
              查看明细
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Salary Bills List -->
    <el-card class="bills-card" shadow="never" v-if="showBillsList">
      <div class="bills-header">
        <h2>工资单列表</h2>
        <el-button link @click="showBillsList = false">关闭</el-button>
      </div>

      <el-table :data="salaryBills" v-loading="loadingBills" stripe>
        <el-table-column prop="period" label="结算周期" width="120" />
        <el-table-column label="员工" width="150">
          <template #default="{ row }">
            {{ row.employee?.name }} ({{ row.employee?.code }})
          </template>
        </el-table-column>
        <el-table-column label="时薪金额" width="100">
          <template #default="{ row }">
            <span v-if="row.hourlyAmount > 0">¥{{ row.hourlyAmount.toFixed(2) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="计件金额" width="100">
          <template #default="{ row }">
            <span v-if="row.pieceAmount > 0">¥{{ row.pieceAmount.toFixed(2) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="总金额" width="120">
          <template #default="{ row }">
            <span class="total-amount">¥{{ row.totalAmount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'approved' ? 'success' : 'warning'" size="small">
              {{ row.status === 'approved' ? '已审核' : '待审核' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewBillDetail(row.id)"> 查看明细 </el-button>
            <el-button
              v-if="row.status === 'pending'"
              link
              type="success"
              @click="approveBill(row)"
            >
              审核
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
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { salaryApi, type CalculateSalaryResult, type SalaryBill } from '../../api/salary'
import SalaryCalcForm from './SalaryCalcForm.vue'
import SalaryBillDetail from './SalaryBillDetail.vue'

const calculating = ref(false)
const loadingBills = ref(false)
const showBillsList = ref(false)

const calcForm = reactive({
  period: '',
  employeeScope: 'all' as 'all' | 'hourly' | 'piece'
})

const calculationResults = ref<CalculateSalaryResult[]>([])

const salaryBills = ref<SalaryBill[]>([])
const billsPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const detailDialogVisible = ref(false)
const currentBill = ref<SalaryBill | null>(null)

const handleCalculate = async () => {
  if (!calcForm.period) {
    ElMessage.warning('请选择结算周期')
    return
  }

  try {
    calculating.value = true

    const params: any = {}
    if (calcForm.employeeScope !== 'all') {
      params.employeeIds = calcForm.employeeScope
    }

    const response = await salaryApi.calculateSalary(calcForm.period, params)
    calculationResults.value = response

    ElMessage.success('工资计算完成')
  } catch (error: any) {
    ElMessage.error(error.message || '计算失败')
  } finally {
    calculating.value = false
  }
}

const loadSalaryBills = async () => {
  try {
    loadingBills.value = true
    const response = await salaryApi.getSalaryBills({
      page: billsPagination.page,
      pageSize: billsPagination.pageSize,
      period: calcForm.period
    })
    salaryBills.value = response.list
    billsPagination.total = response.total
    showBillsList.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '加载工资单失败')
  } finally {
    loadingBills.value = false
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
    if (showBillsList.value) {
      loadSalaryBills()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '审核失败')
    }
  }
}
</script>

<style scoped>
.salary-calculation {
  padding: var(--spacing-6);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
}

.header-content {
  flex: 1;
}

.page-title {
  margin: 0;
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-700);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.page-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.result-card,
.bills-card {
  margin-bottom: var(--spacing-6);
}

.result-header,
.bills-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-4);
}

.result-header h2,
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
  margin-top: var(--spacing-4);
}
</style>
