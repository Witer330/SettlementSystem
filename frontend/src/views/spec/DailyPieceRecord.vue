<template>
  <div class="daily-piece-record">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">每日计件录入</h1>
        <p class="page-description">记录员工每日的计件生产情况</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">
        新增记录
      </el-button>
    </div>

    <!-- Search Bar -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="员工">
          <el-select v-model="searchForm.employeeId" placeholder="全部员工" clearable style="width: 150px" filterable>
            <el-option
              v-for="employee in employees"
              :key="employee.id"
              :label="employee.name"
              :value="employee.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="searchForm.date"
            type="date"
            placeholder="选择日期"
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

    <!-- Data Table -->
    <el-card class="table-card" shadow="never">
      <el-table v-loading="loading" :data="recordList" stripe style="width: 100%">
        <el-table-column prop="date" label="日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.date) }}
          </template>
        </el-table-column>
        <el-table-column label="员工" width="120">
          <template #default="{ row }">
            {{ row.employee?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="生产明细" min-width="300">
          <template #default="{ row }">
            <div class="detail-list">
              <div v-for="item in row.items" :key="item.id" class="detail-item">
                <span class="spec-name">{{ item.spec?.product?.name }}-{{ item.spec?.name }}</span>
                <span class="spec-quantity">{{ item.quantity }}件</span>
                <span class="spec-amount">¥{{ item.amount.toFixed(2) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="总金额" width="120">
          <template #default="{ row }">
            <span class="total-amount">¥{{ row.totalAmount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
</el-table>

      <!-- Pagination -->
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

    <!-- Record Form Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="员工" prop="employeeId">
              <el-select v-model="formData.employeeId" placeholder="请选择员工" style="width: 100%" filterable>
                <el-option
                  v-for="employee in employees"
                  :key="employee.id"
                  :label="employee.name"
                  :value="employee.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="日期" prop="date">
              <el-date-picker
                v-model="formData.date"
                type="date"
                placeholder="选择日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="生产明细" prop="items">
          <div class="items-container">
            <div v-for="(item, index) in formData.items" :key="index" class="item-row">
              <el-select v-model="item.specId" placeholder="选择规格" style="width: 250px" @change="handleSpecChange(item)">
                <el-option
                  v-for="spec in specs"
                  :key="spec.id"
                  :label="`${spec.product?.name}-${spec.name}`"
                  :value="spec.id"
                />
              </el-select>
              <el-input-number v-model="item.quantity" :min="1" placeholder="数量" style="width: 150px" />
              <span class="item-unit-price" v-if="item.unitPrice">¥{{ item.unitPrice.toFixed(2) }}/件</span>
              <el-button type="danger" :icon="Delete" circle @click="removeItem(index)" />
            </div>
            <el-button type="primary" :icon="Plus" size="small" @click="addItem">添加明细</el-button>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注" />
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
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Search, Refresh, Edit, Delete } from '@element-plus/icons-vue';
import { dailyPieceApi, type DailyPieceRecord } from '../../api/dailyPiece';
import { employeeApi } from '../../api/employee';
import { specApi, type ProductSpec } from '../../api/spec';

const loading = ref(false);
const recordList = ref<DailyPieceRecord[]>([]);
const employees = ref<any[]>([]);
const specs = ref<ProductSpec[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref('新增记录');
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref<FormInstance>();

const searchForm = reactive({
  employeeId: undefined as number | undefined,
  date: ''
});

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
});

const formData = reactive({
  id: 0,
  employeeId: undefined as number | undefined,
  date: '',
  items: [] as Array<{
    specId: number | undefined;
quantity: number;
unitPrice: number;
  }>,
  remark: ''
});

const formRules: FormRules = {
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  items: [{
    validator: (value: any, callback: any) => {
      if (!value || value.length === 0) {
        callback(new Error('请添加至少一条生产明细'));
      } else if (value.some((item: any) => !item.specId || !item.quantity)) {
        callback(new Error('请完善所有明细信息'));
      } else {
        callback();
      }
    },
    trigger: 'change'
  }]
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN');
};

const loadRecordList = async () => {
  try {
    loading.value = true;
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize
    };
    if (searchForm.employeeId) params.employeeId = searchForm.employeeId;
    if (searchForm.date) params.date = searchForm.date;

    const response = await dailyPieceApi.getRecords(params);
    recordList.value = response.list;
    pagination.total = response.total;
  } catch (error: any) {
    ElMessage.error(error.message || '加载记录列表失败');
  } finally {
    loading.value = false;
  }
};

const loadEmployees = async () => {
  try {
    const response = await employeeApi.getList({ page: 1, pageSize: 1000, status: 'active' });
    employees.value = response.list.filter((emp: any) => emp.payType === 'piece');
  } catch (error: any) {
    ElMessage.error(error.message || '加载员工列表失败');
  }
};

const loadSpecs = async () => {
  try {
    specs.value = await specApi.getSpecs({ status: 'active' });
  } catch (error: any) {
    ElMessage.error(error.message || '加载规格列表失败');
  }
};

const handleSearch = () => {
  pagination.page = 1;
  loadRecordList();
};

const handleReset = () => {
  searchForm.employeeId = undefined;
  searchForm.date = '';
  pagination.page = 1;
  loadRecordList();
};

const handlePageChange = (page: number) => {
  pagination.page = page;
  loadRecordList();
};

const handleSizeChange = (size: number) => {
  pagination.pageSize = size;
  pagination.page = 1;
  loadRecordList();
};

const handleSpecChange = (item: any) => {
  const spec = specs.value.find(s => s.id === item.specId);
  if (spec && spec.specPrice) {
    item.unitPrice = spec.specPrice.unitPrice;
  }
};

const addItem = () => {
  formData.items.push({
    specId: undefined,
    quantity: 1,
    unitPrice: 0
  });
};

const removeItem = (index: number) => {
  formData.items.splice(index, 1);
};

const handleCreate = () => {
  dialogMode.value = 'create';
  dialogTitle.value = '新增记录';
  Object.assign(formData, {
    id: 0,
    employeeId: undefined,
    date: '',
    items: [{ specId: undefined, quantity: 1, unitPrice: 0 }],
    remark: ''
  });
  dialogVisible.value = true;
};

const handleEdit = (row: DailyPieceRecord) => {
  dialogMode.value = 'edit';
  dialogTitle.value = '编辑记录';
  Object.assign(formData, {
    id: row.id,
    employeeId: row.employeeId,
    date: row.date.split('T')[0],
    items: row.items?.map(item => ({
      specId: item.specId,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    })) || [],
    remark: row.remark || ''
  });
  dialogVisible.value = true;
};

const handleDelete = async (row: DailyPieceRecord) => {
  try {
    await ElMessageBox.confirm(`确定要删除${formatDate(row.date)}的记录吗？`, '确认删除', { type: 'warning' });
    await dailyPieceApi.deleteRecord(row.id);
    ElMessage.success('删除成功');
    loadRecordList();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败');
    }
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();

    const data = {
      employeeId: formData.employeeId!,
      date: formData.date,
      items: formData.items.map(item => ({
        specId: item.specId!,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })),
      remark: formData.remark
    };

    if (dialogMode.value === 'create') {
      await dailyPieceApi.createRecord(data);
      ElMessage.success('创建成功');
    } else {
      await dailyPieceApi.updateRecord(formData.id, data);
      ElMessage.success('更新成功');
    }

    dialogVisible.value = false;
    loadRecordList();
  } catch (error: any) {
    if (error !== false) {
      ElMessage.error(error.message || '提交失败');
    }
  }
};

onMounted(() => {
  loadEmployees();
  loadSpecs();
  loadRecordList();
});
</script>

<style scoped>
.daily-piece-record {
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

.search-card,
.table-card {
  margin-bottom: var(--spacing-6);
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.detail-item {
  display: flex;
  gap: var(--spacing-3);
  font-size: var(--font-size-sm);
}

.spec-name {
  flex: 1;
  color: var(--color-text-primary);
}

.spec-quantity {
  color: var(--color-text-secondary);
}

.spec-amount {
  color: var(--color-success);
  font-weight: var(--font-weight-550);
}

.total-amount {
  font-weight: var(--font-weight-700);
  color: var(--color-primary);
  font-size: var(--font-size-lg);
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-6);
}

.items-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  width: 100%;
}

.item-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.item-unit-price {
  color: var(--color-primary);
  font-weight: var(--font-weight-550);
  min-width: 80px;
}
</style>
