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
    <el-card class="form-card" shadow="never">
      <el-form :model="calcForm" inline>
        <el-form-item label="结算周期">
          <el-date-picker
            v-model="calcForm.period"
            type="month"
            placeholder="选择月份"
            format="YYYY-MM"
            value-format="YYYY-MM"
          />
        </el-form-item>
        <el-form-item label="员工范围">
          <el-select v-model="calcForm.employeeScope" placeholder="全部员工" clearable style="width: 180px">
            <el-option label="全部员工" value="all" />
            <el-option label="时薪员工" value="hourly" />
            <el-option label="计件员工" value="piece" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="calculating" @click="handleCalculate">
            开始计算
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Results Table -->
    <el-card class="result-card" shadow="never" v-if="calculationResults.length > 0">
      <div class="result-header">
        <h2>计算结果</h2>
        <el-button type="primary" size="small" @click="loadSalaryBills">
          查看工资单
        </el-button>
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
            <el-button
              link
              type="primary"
              @click="viewBillDetail(row.billId)"
            >
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
            <el-button
              link
              type="primary"
              @click="viewBillDetail(row.id)"
            >
              查看明细
            </el-button>
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
    <el-dialog
      v-model="detailDialogVisible"
      title="工资单明细"
      width="900px"
      :close-on-click-modal="false"
    >
      <div v-if="currentBill">
        <el-descriptions :column="2" border class="bill-info">
          <el-descriptions-item label="员工">{{ currentBill.employee?.name }}</el-descriptions-item>
          <el-descriptions-item label="工号">{{ currentBill.employee?.code }}</el-descriptions-item>
          <el-descriptions-item label="结算周期">{{ currentBill.period }}</el-descriptions-item>
          <el-descriptions-item label="计费方式">
            {{ currentBill.employee?.payType === 'piece' ? '计件' : '时薪' }}
          </el-descriptions-item>
          <el-descriptions-item label="总工时">{{ currentBill.hourlyHours }}小时</el-descriptions-item>
          <el-descriptions-item label="总件数">{{ currentBill.pieceCount }}件</el-descriptions-item>
          <el-descriptions-item label="时薪金额">¥{{ currentBill.hourlyAmount.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="计件金额">¥{{ currentBill.pieceAmount.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="总金额" :span="2">
            <span class="total-amount">¥{{ currentBill.totalAmount.toFixed(2) }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <h3 class="detail-title">明细记录</h3>
        <el-table :data="currentBill.details" stripe max-height="300">
          <el-table-column prop="date" label="日期" width="120">
            <template #default="{ row }">
              {{ formatDate(row.date) }}
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.type === 'piece' ? 'success' : 'warning'" size="small">
                {{ row.type === 'piece' ? '计件' : '时薪' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="产品/工序" width="180">
            <template #default="{ row }">
              <span v-if="row.type === 'piece'">
                {{ row.product?.name }} - {{ row.process?.name }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="100">
            <template #default="{ row }">
              {{ row.quantity }}{{ row.type === 'hourly' ? '小时' : '件' }}
            </template>
          </el-table-column>
          <el-table-column prop="unitPrice" label="单价" width="100">
            <template #default="{ row }">
              ¥{{ row.unitPrice.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">
              <span class="amount">¥{{ row.amount.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" show-overflow-tooltip />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          v-if="currentBill?.status === 'pending'"
          type="primary"
          @click="approveCurrentBill"
        >
          审核通过
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Operation } from '@element-plus/icons-vue';
import { salaryApi, type CalculateSalaryResult, type SalaryBill } from '../../api/salary';

// Data
const calculating = ref(false);
const loadingBills = ref(false);
const showBillsList = ref(false);

const calcForm = reactive({
  period: '',
  employeeScope: 'all' as 'all' | 'hourly' | 'piece'
});

const calculationResults = ref<CalculateSalaryResult[]>([]);

const salaryBills = ref<SalaryBill[]>([]);
const billsPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
});

const detailDialogVisible = ref(false);
const currentBill = ref<SalaryBill | null>(null);

// Methods
const handleCalculate = async () => {
  if (!calcForm.period) {
    ElMessage.warning('请选择结算周期');
    return;
  }

  try {
    calculating.value = true;

    const params: any = {};
    if (calcForm.employeeScope !== 'all') {
      params.employeeIds = calcForm.employeeScope;
    }

    const response = await salaryApi.calculateSalary(calcForm.period, params);
    calculationResults.value = response;

    ElMessage.success('工资计算完成');
  } catch (error: any) {
    ElMessage.error(error.message || '计算失败');
  } finally {
    calculating.value = false;
  }
};

const loadSalaryBills = async () => {
  try {
    loadingBills.value = true;
    const response = await salaryApi.getSalaryBills({
      page: billsPagination.page,
      pageSize: billsPagination.pageSize,
      period: calcForm.period
    });
    salaryBills.value = response.list;
    billsPagination.total = response.total;
    showBillsList.value = true;
  } catch (error: any) {
    ElMessage.error(error.message || '加载工资单失败');
  } finally {
    loadingBills.value = false;
  }
};

const handleBillsPageChange = (page: number) => {
  billsPagination.page = page;
  loadSalaryBills();
};

const handleBillsSizeChange = (size: number) => {
  billsPagination.pageSize = size;
  billsPagination.page = 1;
  loadSalaryBills();
};

const viewBillDetail = async (billId: number) => {
  try {
    const bill = await salaryApi.getSalaryBillDetail(billId);
    currentBill.value = bill;
    detailDialogVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error.message || '获取工资单详情失败');
  }
};

const approveBill = async (bill: SalaryBill) => {
  try {
    await ElMessageBox.confirm(
      `确定要审核通过 "${bill.employee?.name}" 的工资单吗？`,
      '确认审核',
      { type: 'warning' }
    );

    await salaryApi.approveSalaryBill(bill.id);
    ElMessage.success('审核成功');
    loadSalaryBills();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '审核失败');
    }
  }
};

const approveCurrentBill = async () => {
  if (!currentBill.value) return;

  try {
    await ElMessageBox.confirm(
      `确定要审核通过 "${currentBill.value.employee?.name}" 的工资单吗？`,
      '确认审核',
      { type: 'warning' }
    );

    await salaryApi.approveSalaryBill(currentBill.value.id);
    ElMessage.success('审核成功');
    detailDialogVisible.value = false;
    if (showBillsList.value) {
      loadSalaryBills();
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '审核失败');
    }
  }
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
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

.form-card {
  margin-bottom: var(--spacing-6);
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

.bill-info {
  margin-bottom: var(--spacing-4);
}

.detail-title {
  margin-bottom: var(--spacing-3);
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-450);
}
</style>
