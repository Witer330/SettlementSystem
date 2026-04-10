<template>
  <div class="spec-list">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">产品规格管理</h1>
        <p class="page-description">管理产品规格和计件单价</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">
        新增规格
      </el-button>
    </div>

    <!-- Search Bar -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="产品">
          <el-select v-model="searchForm.productId" placeholder="全部产品" clearable style="width: 200px">
            <el-option
              v-for="product in products"
              :key="product.id"
              :label="product.name"
              :value="product.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Data Table -->
    <el-card class="table-card" shadow="never">
      <el-table v-loading="loading" :data="specList" stripe style="width: 100%">
        <el-table-column prop="code" label="规格编码" width="150" />
        <el-table-column label="产品" width="150">
          <template #default="{ row }">
            {{ row.product?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="name" label="规格名称" width="180" />
        <el-table-column label="规格参数" width="200">
          <template #default="{ row }">
            <div v-if="formattedDimensions(row)">
              <div class="param-item">尺寸: {{ formattedDimensions(row) }}</div>
            </div>
            <div v-if="formattedMaterial(row)">
              <div class="param-item">材质: {{ formattedMaterial(row) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="difficulty" label="复杂度" width="100">
          <template #default="{ row }">
            <el-tag :type="difficultyType(row.difficulty)" size="small">
              {{ difficultyText(row.difficulty) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="基础价格" width="120">
          <template #default="{ row }">
            ¥{{ row.basePrice.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="单价" width="120">
          <template #default="{ row }">
            <span class="unit-price">¥{{ (row.unitPrice || row.specPrice?.unitPrice || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="RefreshRight" @click="handleRecalculate(row)">
              重新计价
            </el-button>
            <el-button link type="primary" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Spec Form Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="产品" prop="productId">
          <el-select v-model="formData.productId" placeholder="请选择产品" style="width: 100%">
            <el-option
              v-for="product in products"
              :key="product.id"
              :label="product.name"
              :value="product.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="规格编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入规格编码" />
        </el-form-item>
        <el-form-item label="规格名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入规格名称" />
        </el-form-item>
        <el-form-item label="基础价格" prop="basePrice">
          <el-input-number v-model="formData.basePrice" :min="0" :precision="2" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-divider>规格参数</el-divider>
        <el-form-item label="尺寸参数">
          <el-input v-model="formData.dimensions" placeholder='如 {"d.diameter": 100, "length": 20}' />
        </el-form-item>
        <el-form-item label="材质参数">
          <el-input v-model="formData.material" placeholder='如 {"type": "steel", "thickness": 2}' />
        </el-form-item>
        <el-form-item label="工艺参数">
          <el-input v-model="formData.craft" placeholder='如 {"surface": "galvanized", "precision": "H7"}' />
        </el-form-item>
        <el-form-item label="复杂度" prop="difficulty">
          <el-select v-model="formData.difficulty" placeholder="请选择复杂度" style="width: 100%">
            <el-option label="简单" value="easy" />
            <el-option label="中等" value="medium" />
            <el-option label="困难" value="hard" />
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
import { Plus, Search, Refresh, RefreshRight, Edit, Delete } from '@element-plus/icons-vue';
import { specApi, type ProductSpec } from '../../api/spec';
import { productApi } from '../../api/product';

const loading = ref(false);
const specList = ref<ProductSpec[]>([]);
const products = ref<any[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref('新增规格');
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref<FormInstance>();

const searchForm = reactive({
  productId: undefined as number | undefined,
  status: ''
});

const formData = reactive({
  id: 0,
  productId: undefined as number | undefined,
  code: '',
  name: '',
  dimensions: '{}',
  material: '{}',
  craft: '{}',
  difficulty: 'medium',
  basePrice: 0,
  status: 'active'
});

const formRules: FormRules = {
  productId: [{ required: true, message: '请选择产品', trigger: 'change' }],
  code: [{ required: true, message: '请输入规格编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入规格名称', trigger: 'blur' }],
  difficulty: [{ required: true, message: '请选择复杂度', trigger: 'change' }]
};

const formattedDimensions = (spec: ProductSpec) => {
  try {
    const dims = typeof spec.dimensions === 'string' ? JSON.parse(spec.dimensions) : spec.dimensions;
    const parts = [];
    if (dims.diameter) parts.push(`Φ${dims.diameter}`);
    if (dims.length) parts.push(`×${dims.length}`);
    return parts.length > 0 ? parts.join('') : '-';
  } catch {
    return '-';
  }
};

const formattedMaterial = (spec: ProductSpec) => {
  try {
    const mat = typeof spec.material === 'string' ? JSON.parse(spec.material) : spec.material;
    return mat.type || '-';
  } catch {
    return '-';
  }
};

const difficultyType = (difficulty: string) => {
  const map: Record<string, any> = { easy: 'success', medium: 'warning', hard: 'danger' };
  return map[difficulty] || 'info';
};

const difficultyText = (difficulty: string) => {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };
  return map[difficulty] || difficulty;
};

const loadSpecList = async () => {
  try {
    loading.value = true;
    const params: any = {};
    if (searchForm.productId) params.productId = searchForm.productId;
    if (searchForm.status) params.status = searchForm.status;

    specList.value = await specApi.getSpecs(params);
  } catch (error: any) {
    ElMessage.error(error.message || '加载规格列表失败');
  } finally {
    loading.value = false;
  }
};

const loadProducts = async () => {
  try {
    const response = await productApi.getList({ page: 1, pageSize: 1000 });
    products.value = response.list;
  } catch (error: any) {
    ElMessage.error(error.message || '加载产品列表失败');
  }
};

const handleSearch = () => {
  loadSpecList();
};

const handleReset = () => {
  searchForm.productId = undefined;
  searchForm.status = '';
  loadSpecList();
};

const handleCreate = () => {
  dialogMode.value = 'create';
  dialogTitle.value = '新增规格';
  Object.assign(formData, {
    id: 0,
    productId: undefined,
    code: '',
    name: '',
    dimensions: '{}',
    material: '{}',
    craft: '{}',
    difficulty: 'medium',
    basePrice: 0,
    status: 'active'
  });
  dialogVisible.value = true;
};

const handleEdit = (row: ProductSpec) => {
  dialogMode.value = 'edit';
  dialogTitle.value = '编辑规格';
  Object.assign(formData, {
    id: row.id,
    productId: row.productId,
    code: row.code,
    name: row.name,
    dimensions: typeof row.dimensions === 'string' ? row.dimensions : JSON.stringify(row.dimensions),
    material: typeof row.material === 'string' ? row.material : JSON.stringify(row.material),
    craft: typeof row.craft === 'string' ? row.craft : JSON.stringify(row.craft),
    difficulty: row.difficulty,
    basePrice: row.basePrice,
    status: row.status
  });
  dialogVisible.value = true;
};

const handleDelete = async (row: ProductSpec) => {
  try {
    await ElMessageBox.confirm(`确定要删除规格"${row.name}"吗？`, '确认删除', { type: 'warning' });
    await specApi.deleteSpec(row.id);
    ElMessage.success('删除成功');
    loadSpecList();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败');
    }
  }
};

const handleRecalculate = async (row: ProductSpec) => {
  try {
    await specApi.recalculatePrice(row.id);
    ElMessage.success('重新计价成功');
    loadSpecList();
  } catch (error: any) {
    ElMessage.error(error.message || '重新计价失败');
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();

    const data = {
      productId: formData.productId!,
      code: formData.code,
      name: formData.name,
      dimensions: formData.dimensions,
      material: formData.material,
      craft: formData.craft,
      difficulty: formData.difficulty,
      basePrice: formData.basePrice,
      status: formData.status
    };

    if (dialogMode.value === 'create') {
      await specApi.createSpec(data);
      ElMessage.success('创建成功');
    } else {
      await specApi.updateSpec(formData.id, data);
      ElMessage.success('更新成功');
    }

    dialogVisible.value = false;
    loadSpecList();
  } catch (error: any) {
    if (error !== false) {
      ElMessage.error(error.message || '提交失败');
    }
  }
};

onMounted(() => {
  loadProducts();
  loadSpecList();
});
</script>

<style scoped>
.spec-list {
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

.param-item {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.unit-price {
  font-weight: var(--font-weight-600);
  color: var(--color-primary);
}
</style>
