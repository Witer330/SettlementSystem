<template>
  <div class="page-container">
    <div class="page-header">
      <h1>BOM 管理</h1>
    </div>

    <div class="bom-layout">
      <!-- 左侧产品列表 -->
      <el-card shadow="never" class="product-panel">
        <template #header>
          <span>产品列表</span>
        </template>
        <el-input
          v-model="productKeyword"
          placeholder="搜索产品"
          clearable
          style="margin-bottom: 12px"
        />
        <div class="product-list">
          <div
            v-for="p in filteredProducts"
            :key="p.id"
            class="product-item"
            :class="{ active: selectedProductId === p.id }"
            @click="selectProduct(p.id)"
          >
            <span class="product-code">{{ p.code }}</span>
            <span class="product-name">{{ p.name }}</span>
          </div>
          <el-empty v-if="filteredProducts.length === 0" description="暂无产品" :image-size="60" />
        </div>
      </el-card>

      <!-- 右侧 BOM 明细 -->
      <el-card shadow="never" class="bom-panel">
        <template #header>
          <div class="bom-header">
            <span>{{ selectedProduct ? `物料清单 - ${selectedProduct.name}` : '请选择产品' }}</span>
            <el-button v-if="selectedProductId" type="primary" size="small" @click="openAddDialog">
              <el-icon><Plus /></el-icon>添加物料
            </el-button>
          </div>
        </template>

        <el-table :data="bomItems" stripe v-loading="bomLoading" border>
          <el-table-column prop="material.code" label="编码" width="120" />
          <el-table-column prop="material.name" label="物料名称" min-width="150" />
          <el-table-column prop="material.unit" label="单位" width="80" />
          <el-table-column prop="quantity" label="用量" width="120" />
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!selectedProductId" description="请在左侧选择一个产品" />
        <el-empty v-else-if="bomItems.length === 0 && !bomLoading" description="暂无物料清单" />
      </el-card>
    </div>

    <!-- 添加物料对话框 -->
    <el-dialog v-model="addDialogVisible" title="添加 BOM 物料" width="420px">
      <el-form ref="addFormRef" :model="addForm" :rules="addRules" label-width="70px">
        <el-form-item label="物料" prop="materialId">
          <el-select v-model="addForm.materialId" placeholder="选择物料" filterable style="width: 100%">
            <el-option v-for="m in materials" :key="m.id" :label="`${m.code} - ${m.name}`" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="用量" prop="quantity">
          <el-input-number v-model="addForm.quantity" :min="0.01" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addSubmitting" @click="handleAddSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { productApi, type Product } from '@/api/product'
import { materialApi, type Material } from '@/api/material'
import { bomApi, type BomItem } from '@/api/bom'

const products = ref<Product[]>([])
const materials = ref<Material[]>([])
const bomItems = ref<BomItem[]>([])
const selectedProductId = ref<number | null>(null)
const selectedProduct = computed(() => products.value.find(p => p.id === selectedProductId.value) || null)
const productKeyword = ref('')
const bomLoading = ref(false)

const addDialogVisible = ref(false)
const addSubmitting = ref(false)
const addFormRef = ref<FormInstance>()
const addForm = reactive({ materialId: 0, quantity: 1 })
const addRules: FormRules = {
  materialId: [{ required: true, message: '请选择物料', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入用量', trigger: 'blur' }]
}

const filteredProducts = computed(() => {
  if (!productKeyword.value) return products.value
  const kw = productKeyword.value.toLowerCase()
  return products.value.filter(p => p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw))
})

const selectProduct = async (id: number) => {
  selectedProductId.value = id
  bomLoading.value = true
  try {
    bomItems.value = await bomApi.getByProduct(id)
  } catch {
    bomItems.value = []
  } finally {
    bomLoading.value = false
  }
}

const openAddDialog = () => {
  addForm.materialId = 0
  addForm.quantity = 1
  addDialogVisible.value = true
}

const handleAddSubmit = async () => {
  await addFormRef.value?.validate()
  addSubmitting.value = true
  try {
    await bomApi.addItem(selectedProductId.value!, { materialId: addForm.materialId, quantity: addForm.quantity })
    ElMessage.success('添加成功')
    addDialogVisible.value = false
    selectProduct(selectedProductId.value!)
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    addSubmitting.value = false
  }
}

const handleDelete = async (row: BomItem) => {
  await ElMessageBox.confirm(`确定要删除物料"${row.material?.name}"吗？`, '确认删除', { type: 'warning' })
  await bomApi.deleteItem(row.id)
  ElMessage.success('删除成功')
  selectProduct(selectedProductId.value!)
}

onMounted(async () => {
  try {
    const res = await productApi.getList({ page: 1, pageSize: 1000 })
    products.value = res.list
  } catch {}
  try {
    const res = await materialApi.getList({ page: 1, pageSize: 1000 })
    materials.value = res.list
  } catch {}
})
</script>

<style scoped>
.page-container {
  padding: var(--space-6);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}
.page-header h1 {
  margin: 0;
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-600);
}
.bom-layout {
  display: flex;
  gap: var(--space-4);
  min-height: calc(100vh - 200px);
}
.product-panel {
  width: 280px;
  flex-shrink: 0;
}
.bom-panel {
  flex: 1;
}
.bom-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.product-list {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
}
.product-item {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}
.product-item:hover {
  background: var(--bg-elevated);
}
.product-item.active {
  background: var(--bg-elevated);
  font-weight: 500;
}
.product-code {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  min-width: 60px;
}
.product-name {
  color: var(--color-text-primary);
}
</style>
