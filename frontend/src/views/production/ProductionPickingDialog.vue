<template>
  <el-dialog
    :model-value="visible"
    title="生产领料"
    width="700px"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="loadPickingItems"
  >
    <div v-if="order" class="picking-header">
      <span>工单号：<strong>{{ order.orderNo }}</strong></span>
      <span style="margin-left: 16px">产品：<strong>{{ order.product?.name }}</strong></span>
    </div>

    <el-table :data="pickingItems" stripe style="margin-top: 12px">
      <el-table-column label="物料编码" width="120">
        <template #default="{ row }">{{ row.material?.code || '-' }}</template>
      </el-table-column>
      <el-table-column label="物料名称" width="140">
        <template #default="{ row }">{{ row.material?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="规格" width="100">
        <template #default="{ row }">{{ row.material?.specification || '-' }}</template>
      </el-table-column>
      <el-table-column label="单位" width="60">
        <template #default="{ row }">{{ row.material?.unit || '-' }}</template>
      </el-table-column>
      <el-table-column label="计划用量" width="90">
        <template #default="{ row }">{{ row.plannedQty }}</template>
      </el-table-column>
      <el-table-column label="已领" width="70">
        <template #default="{ row }">{{ row.pickedQty }}</template>
      </el-table-column>
      <el-table-column label="本次领料" width="120">
        <template #default="{ row }">
          <el-input-number
            v-model="pickQtyMap[row.id]"
            :min="0"
            :max="row.plannedQty - row.pickedQty"
            :precision="0"
            size="small"
            controls-position="right"
            style="width: 100px"
          />
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="pickingItems.length === 0" description="暂未生成领料清单，请先在工单列表点击【生成领料】" />

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!hasPickQty" @click="handlePick">
        确认领料
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { productionOrderApi, type ProductionOrder, type ProductionPickingItem } from '@/api/productionOrder'

const props = defineProps<{
  modelValue: boolean
  order: ProductionOrder | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:modelValue', v) })

const submitting = ref(false)
const pickingItems = ref<ProductionPickingItem[]>([])
const pickQtyMap = ref<Record<number, number>>({})

const hasPickQty = computed(() =>
  Object.values(pickQtyMap.value).some((v: number) => v > 0)
)

const loadPickingItems = async () => {
  if (!props.order) return
  try {
    const detail = await productionOrderApi.getDetail(props.order.id)
    pickingItems.value = detail.pickingItems || []
    pickQtyMap.value = {}
    pickingItems.value.forEach(item => {
      pickQtyMap.value[item.id] = Math.max(0, item.plannedQty - item.pickedQty)
    })
  } catch { /* ignore */ }
}

const handlePick = async () => {
  if (!props.order) return
  try {
    submitting.value = true
    const items = Object.entries(pickQtyMap.value)
      .filter(([, qty]) => (qty as number) > 0)
      .map(([itemId, pickedQty]) => ({
        itemId: Number(itemId),
        pickedQty: pickedQty as number
      }))
    if (items.length === 0) {
      ElMessage.warning('请输入领料数量')
      return
    }
    await productionOrderApi.pickMaterials(props.order.id, { items })
    ElMessage.success('领料成功')
    visible.value = false
    emit('success')
  } catch (error: any) {
    ElMessage.error(error.message || '领料失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.picking-header {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.picking-header strong {
  color: var(--color-text-primary);
}
</style>
