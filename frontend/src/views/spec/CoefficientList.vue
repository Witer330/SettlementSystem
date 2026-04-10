<template>
  <div class="coefficient-list">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">规格系数配置</h1>
        <p class="page-description">配置计件单价的浮动系数</p>
      </div>
      <div class="header-actions">
        <el-button type="success" :icon="MagicStick" @click="handleInitDefaults">
          初始化默认系数
        </el-button>
        <el-button type="primary" :icon="Plus" @click="handleCreate">
          新增系数
        </el-button>
      </div>
    </div>

    <!-- Coefficient Groups -->
    <div class="coefficient-groups">
      <el-card class="group-card" shadow="never" v-for="(group, type) in groupedCoefficients" :key="type">
        <template #header>
          <div class="group-header">
            <span class="group-title">{{ coefficientTypeNames[type as keyof typeof coefficientTypeNames] }}</span>
            <el-tag size="small">{{ group.length }} 项</el-tag>
          </div>
        </template>

        <el-table :data="group" stripe>
          <el-table-column prop="code" label="代码" width="180" />
          <el-table-column prop="name" label="名称" width="150" />
          <el-table-column label="系数值" width="120">
            <template #default="{ row }">
              <span :class="['coefficient-value', row.value > 0 ? 'positive' : 'zero']">
                {{ row.value > 0 ? '+' : '' }}{{ row.value.toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="priority" label="优先级" width="100" />
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                {{ row.status === 'active' ? '启用' : '禁用' }}
              </el-tag>
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
    </div>

    <!-- Coefficient Form Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="系数类型" prop="type">
          <el-select v-model="formData.type" placeholder="请选择系数类型" style="width: 100%">
            <el-option label="尺寸系数" value="dimension" />
            <el-option label="材质系数" value="material" />
            <el-option label="工艺系数" value="craft" />
            <el-option label="复杂度系数" value="difficulty" />
          </el-select>
        </el-form-item>
        <el-form-item label="系数代码" prop="code">
          <el-input v-model="formData.code" placeholder="如 diameter_gt_100" />
        </el-form-item>
        <el-form-item label="系数名称" prop="name">
          <el-input v-model="formData.name" placeholder="如 直径>100mm" />
        </el-form-item>
        <el-form-item label="系数值" prop="value">
          <el-input-number v-model="formData.value" :precision="2" :step="0.01" style="width: 100%" />
          <div class="form-tip">正值表示加成，负值表示扣减</div>
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-input-number v-model="formData.priority" :min="0" style="width: 100%" />
          <div class="form-tip">数值越大，优先级越高</div>
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
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Edit, Delete, MagicStick } from '@element-plus/icons-vue';
import { coefficientApi, type SpecCoefficient } from '../../api/spec';

const loading = ref(false);
const coefficients = ref<SpecCoefficient[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref('新增系数');
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref<FormInstance>();

const coefficientTypeNames = {
  dimension: '尺寸系数',
  material: '材质系数',
  craft: '工艺系数',
  difficulty: '复杂度系数'
};

const groupedCoefficients = computed(() => {
  const grouped: Record<string, SpecCoefficient[]> = {
    dimension: [],
    material: [],
    craft: [],
    difficulty: []
  };

  coefficients.value.forEach(coeff => {
    if (grouped[coeff.type]) {
      grouped[coeff.type].push(coeff);
    }
  });

  return grouped;
});

const formData = reactive({
  id: 0,
  type: 'dimension',
  code: '',
  name: '',
  value: 0,
  priority: 0,
  status: 'active'
});

const formRules: FormRules = {
  type: [{ required: true, message: '请选择系数类型', trigger: 'change' }],
  code: [{ required: true, message: '请输入系数代码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入系数名称', trigger: 'blur' }],
  value: [{ required: true, message: '请输入系数值', trigger: 'blur' }]
};

const loadCoefficients = async () => {
  try {
    loading.value = true;
    coefficients.value = await coefficientApi.getCoefficients({ status: 'active' });
  } catch (error: any) {
    ElMessage.error(error.message || '加载系数列表失败');
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  dialogMode.value = 'create';
  dialogTitle.value = '新增系数';
  Object.assign(formData, {
    id: 0,
    type: 'dimension',
    code: '',
    name: '',
    value: 0,
    priority: 0,
    status: 'active'
  });
  dialogVisible.value = true;
};

const handleEdit = (row: SpecCoefficient) => {
  dialogMode.value = 'edit';
  dialogTitle.value = '编辑系数';
  Object.assign(formData, row);
  dialogVisible.value = true;
};

const handleDelete = async (row: SpecCoefficient) => {
  try {
    await ElMessageBox.confirm(`确定要删除系数"${row.name}"吗？`, '确认删除', { type: 'warning' });
    await coefficientApi.deleteCoefficient(row.id);
    ElMessage.success('删除成功');
    loadCoefficients();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败');
    }
  }
};

const handleInitDefaults = async () => {
  try {
    await ElMessageBox.confirm('确定要初始化默认系数吗？这将覆盖现有配置。', '确认初始化', { type: 'warning' });
    const result = await coefficientApi.initDefaultCoefficients();
    ElMessage.success(`初始化成功，共创建 ${result.count} 项系数`);
    loadCoefficients();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '初始化失败');
    }
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();

    if (dialogMode.value === 'create') {
      await coefficientApi.createCoefficient({
        type: formData.type,
        code: formData.code,
        name: formData.name,
        value: formData.value,
        priority: formData.priority
      });
      ElMessage.success('创建成功');
    } else {
      await coefficientApi.updateCoefficient(formData.id, {
        name: formData.name,
        value: formData.value,
        priority: formData.priority,
        status: formData.status
      });
      ElMessage.success('更新成功');
    }

    dialogVisible.value = false;
    loadCoefficients();
  } catch (error: any) {
    if (error !== false) {
      ElMessage.error(error.message || '提交失败');
    }
  }
};

onMounted(() => {
  loadCoefficients();
});
</script>

<style scoped>
.coefficient-list {
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

.header-actions {
  display: flex;
  gap: var(--spacing-3);
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

.coefficient-groups {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.group-card {
  border-radius: var(--border-radius-lg);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-title {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-600);
}

.coefficient-value {
  font-weight: var(--font-weight-600);
  font-size: var(--font-size-base);
}

.coefficient-value.positive {
  color: var(--color-success);
}

.coefficient-value.zero {
  color: var(--color-text-regular);
}

.form-tip {
  margin-top: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
