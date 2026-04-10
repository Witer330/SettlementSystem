<template>
  <div class="employee-list">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">员工管理</h1>
        <p class="page-description">管理企业员工档案、工种和部门信息</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">
        新增员工
      </el-button>
    </div>

    <!-- Search Bar -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="员工姓名或工号"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="searchForm.status"
            placeholder="全部状态"
            clearable
            style="width: 120px"
          >
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Data Table -->
    <el-card class="table-card" shadow="never">
      <el-table
        v-loading="loading"
        :data="employeeList"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="code" label="工号" width="120" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column label="部门" width="150">
          <template #default="{ row }">
            {{ row.department?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="jobType" label="工种" width="120" />
        <el-table-column label="计费方式" width="100">
          <template #default="{ row }">
            <el-tag :type="row.payType === 'piece' ? 'primary' : 'success'" size="small">
              {{ row.payType === 'piece' ? '计件' : '时薪' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时薪" width="100">
          <template #default="{ row }">
            <span v-if="row.payType === 'piece'">-</span>
            <span v-else>¥{{ row.hourlyRate.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
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

    <!-- Employee Form Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="工号" prop="code">
          <el-input v-model="formData.code" placeholder="请输入工号" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="部门" prop="departmentId">
          <el-select
            v-model="formData.departmentId"
            placeholder="请选择部门"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="dept in departmentList"
              :key="dept.id"
              :label="dept.name"
              :value="dept.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="工种" prop="jobType">
          <el-input v-model="formData.jobType" placeholder="请输入工种" />
        </el-form-item>
        <el-form-item label="计费方式" prop="payType">
          <el-radio-group v-model="formData.payType" @change="handlePayTypeChange">
            <el-radio label="hourly">时薪</el-radio>
            <el-radio label="piece">计件</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="时薪" prop="hourlyRate" v-if="formData.payType === 'hourly'">
          <el-input-number
            v-model="formData.hourlyRate"
            :min="0"
            :precision="2"
            :step="0.01"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio label="active">启用</el-radio>
            <el-radio label="inactive">禁用</el-radio>
          </el-radio-group>
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
import { employeeApi, type Employee } from '../../api/employee';
import { departmentApi, type Department } from '../../api/department';

// Data
const loading = ref(false);
const employeeList = ref<Employee[]>([]);
const departmentList = ref<Department[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref('新增员工');
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref<FormInstance>();

const searchForm = reactive({
  keyword: '',
  status: ''
});

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
});

const formData = reactive({
  id: 0,
  code: '',
  name: '',
  departmentId: null as number | null,
  jobType: '',
  payType: 'hourly' as 'hourly' | 'piece',
  hourlyRate: 0,
  pieceRate: 0,
  status: 'active'
});

// 计费方式变更处理
const handlePayTypeChange = (value: 'hourly' | 'piece') => {
  if (value === 'hourly') {
    formData.hourlyRate = formData.hourlyRate || 0;
    formData.pieceRate = 0;
  } else {
    formData.pieceRate = formData.pieceRate || 0;
    formData.hourlyRate = 0;
  }
};

const formRules: FormRules = {
  code: [{ required: true, message: '请输入工号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  jobType: [{ required: true, message: '请输入工种', trigger: 'blur' }]
};

// Methods
const loadDepartmentList = async () => {
  try {
    const departments = await departmentApi.getList();
    departmentList.value = departments.filter(d => d.status === 'active');
  } catch (error: any) {
    ElMessage.error(error.message || '加载部门列表失败');
  }
};

const loadEmployeeList = async () => {
  try {
    loading.value = true;
    const response = await employeeApi.getList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined
    });
    employeeList.value = response.list;
    pagination.total = response.total;
  } catch (error: any) {
    ElMessage.error(error.message || '加载员工列表失败');
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.page = 1;
  loadEmployeeList();
};

const handleReset = () => {
  searchForm.keyword = '';
  searchForm.status = '';
  pagination.page = 1;
  loadEmployeeList();
};

const handlePageChange = (page: number) => {
  pagination.page = page;
  loadEmployeeList();
};

const handleSizeChange = (size: number) => {
  pagination.pageSize = size;
  pagination.page = 1;
  loadEmployeeList();
};

const handleCreate = () => {
  dialogMode.value = 'create';
  dialogTitle.value = '新增员工';
  Object.assign(formData, {
    id: 0,
    code: '',
    name: '',
    departmentId: null,
    jobType: '',
    payType: 'hourly',
    hourlyRate: 0,
    pieceRate: 0,
    status: 'active'
  });
  dialogVisible.value = true;
};

const handleEdit = (row: Employee) => {
  dialogMode.value = 'edit';
  dialogTitle.value = '编辑员工';
  Object.assign(formData, {
    id: row.id,
    code: row.code,
    name: row.name,
    departmentId: row.departmentId || null,
    jobType: row.jobType,
    payType: row.payType || 'hourly',
    hourlyRate: row.hourlyRate,
    pieceRate: row.pieceRate || 0,
    status: row.status
  });
  dialogVisible.value = true;
};

const handleDelete = async (row: Employee) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除员工"${row.name}"吗？`,
      '确认删除',
      {
        type: 'warning'
      }
    );

    await employeeApi.delete(row.id);
    ElMessage.success('删除成功');
    loadEmployeeList();
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

    if (dialogMode.value === 'create') {
      await employeeApi.create(formData);
      ElMessage.success('创建成功');
    } else {
      await employeeApi.update(formData.id, formData);
      ElMessage.success('更新成功');
    }

    dialogVisible.value = false;
    loadEmployeeList();
  } catch (error: any) {
    if (error !== false) {
      ElMessage.error(error.message || '提交失败');
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

// Lifecycle
onMounted(() => {
  loadDepartmentList();
  loadEmployeeList();
});
</script>

<style scoped>
.employee-list {
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

.search-card {
  margin-bottom: var(--spacing-6);
}

.table-card {
  margin-bottom: var(--spacing-6);
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-6);
}
</style>
