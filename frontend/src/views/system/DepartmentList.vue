<template>
  <div class="department-list">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">部门管理</h1>
        <p class="page-description">管理企业组织架构和部门信息</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">
        新增部门
      </el-button>
    </div>

    <!-- Data Table -->
    <el-card class="table-card" shadow="never">
      <template #header>
        <div class="table-header">
          <el-checkbox v-model="includeDeleted" @change="loadDepartmentList">
            显示已删除部门
          </el-checkbox>
        </div>
      </template>
      <el-table
        v-loading="loading"
        :data="departmentList"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="code" label="部门编码" width="150" />
        <el-table-column prop="name" label="部门名称" width="200" />
        <el-table-column label="员工数量" width="120">
          <template #default="{ row }">
            {{ row.employees?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : row.status === 'deleted' ? 'danger' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : row.status === 'deleted' ? '已删除' : '禁用' }}
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
            <el-button link type="primary" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Department Form Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="部门编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入部门编码" />
        </el-form-item>
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="上级部门" prop="parentId">
          <el-select v-model="formData.parentId" placeholder="请选择上级部门" clearable>
            <el-option
              v-for="dept in departmentList"
              :key="dept.id"
              :label="dept.name"
              :value="dept.id"
            />
          </el-select>
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
import { Plus, Edit, Delete } from '@element-plus/icons-vue';
import { departmentApi, type Department } from '../../api/department';

const loading = ref(false);
const departmentList = ref<Department[]>([]);
const includeDeleted = ref(false);
const dialogVisible = ref(false);
const dialogTitle = ref('新增部门');
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref<FormInstance>();

const formData = reactive({
  id: 0,
  code: '',
  name: '',
  parentId: undefined as number | undefined,
  status: 'active'
});

const formRules: FormRules = {
  code: [{ required: true, message: '请输入部门编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }]
};

const loadDepartmentList = async () => {
  try {
    loading.value = true;
    departmentList.value = await departmentApi.getList(includeDeleted.value);
  } catch (error: any) {
    ElMessage.error(error.message || '加载部门列表失败');
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  dialogMode.value = 'create';
  dialogTitle.value = '新增部门';
  Object.assign(formData, {
    id: 0,
    code: '',
    name: '',
    parentId: undefined,
    status: 'active'
  });
  dialogVisible.value = true;
};

const handleEdit = (row: Department) => {
  dialogMode.value = 'edit';
  dialogTitle.value = '编辑部门';
  Object.assign(formData, {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId || undefined,
    status: row.status
  });
  dialogVisible.value = true;
};

const handleDelete = async (row: Department) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除部门"${row.name}"吗？`,
      '确认删除',
      {
        type: 'warning'
      }
    );

    await departmentApi.delete(row.id);
    ElMessage.success('删除成功');
    loadDepartmentList();
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
      await departmentApi.create({
        code: formData.code,
        name: formData.name,
        parentId: formData.parentId
      });
      ElMessage.success('创建成功');
    } else {
      await departmentApi.update(formData.id, {
        code: formData.code,
        name: formData.name,
        parentId: formData.parentId,
        status: formData.status
      });
      ElMessage.success('更新成功');
    }

    dialogVisible.value = false;
    loadDepartmentList();
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

onMounted(() => {
  loadDepartmentList();
});
</script>

<style scoped>
.department-list {
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

.table-card {
  margin-bottom: var(--spacing-6);
}

.table-header {
  display: flex;
  align-items: center;
}
</style>
