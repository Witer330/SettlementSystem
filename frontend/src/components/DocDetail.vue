<template>
  <div class="dd-body" @focusin="onFocusIn">
    <el-table v-if="items.length > 0" :data="items" border size="small" style="width:100%">
      <!-- # -->
      <el-table-column label="#" width="44" align="center">
        <template #default="{ $index }">{{ $index + 1 }}</template>
      </el-table-column>

      <!-- 物料/产品选择 -->
      <el-table-column :label="itemLabel" min-width="260">
        <template #default="{ row: r }">
          <el-select
            :model-value="r[itemField]"
            @update:model-value="onItemSelect($event, r)"
            :placeholder="'编码/名称搜索'"
            filterable size="small" style="width:100%"
            :disabled="readonly || locked"
            @keydown="(e: KeyboardEvent) => nav.onCellKeydown(e)"
          >
            <el-option v-for="opt in options" :key="opt.id" :label="`${opt.code} - ${opt.name}`" :value="opt.id" />
          </el-select>
        </template>
      </el-table-column>

      <!-- 数量 -->
      <el-table-column label="数量" min-width="110">
        <template #default="{ row: r }">
          <el-input-number
            v-model="r.quantity" :min="1" size="small" style="width:100%"
            controls-position="right" :disabled="readonly || locked"
            @keydown="(e: KeyboardEvent) => nav.onCellKeydown(e)"
          />
        </template>
      </el-table-column>

      <!-- 单价 -->
      <el-table-column label="单价" min-width="130">
        <template #default="{ row: r }">
          <div style="display:flex;align-items:center;gap:2px;">
            <el-input-number
              v-model="r.price" :min="0" :precision="2" size="small" style="width:100%"
              :controls="false" :disabled="readonly || locked"
              @keydown="(e: KeyboardEvent) => nav.onCellKeydown(e)"
            />
            <slot name="priceTag" :row="r" />
          </div>
        </template>
      </el-table-column>

      <!-- 已收/已发（条件显示） -->
      <el-table-column v-if="showReceived" :label="receivedLabel" min-width="80" align="center">
        <template #default="{ row: r }">{{ r[receivedField] || 0 }}</template>
      </el-table-column>

      <!-- 小计 -->
      <el-table-column label="小计" min-width="100" align="right">
        <template #default="{ row: r }">
          <slot name="subtotal" :row="r" :amount="(r.quantity||0)*(r.price||0)" />
        </template>
      </el-table-column>

      <!-- 删除 -->
      <el-table-column v-if="!readonly && !locked" width="54" align="center">
        <template #default="{ row: r }">
          <el-button link type="danger" size="small" @click="onRemove(r)">删</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-else class="dd-empty">暂无明细，按 Enter 或点击下方按钮添加</div>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation'

const props = defineProps<{
  items: any[]
  options: any[]
  itemField: string
  itemLabel: string
  receivedLabel: string
  receivedField: string
  showReceived: boolean
  readonly: boolean
  locked: boolean
}>()

const emit = defineEmits<{
  'update:items': [items: any[]]
  addRow: []
  removeRow: [row: any]
  itemSelect: [value: number, row: any]
}>()

async function onRemove(row: any) {
  try { await ElMessageBox.confirm('确定删除该行明细？', '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  emit('removeRow', row)
}

function onItemSelect(value: number, row: any) {
  row[props.itemField] = value
  emit('itemSelect', value, row)
}

function onFocusIn(e: FocusEvent) {
  const el = e.target as HTMLElement
  if (el instanceof HTMLInputElement) { el.select() }
  else { el.querySelector('input')?.select() }
}

const nav = useKeyboardNavigation({
  items: props.items as any,
  addItemRow: () => emit('addRow'),
  removeItem: (row: any) => emit('removeRow', row),
  saveDraft: async () => {},
  submit: async () => {},
  editableCols: [1, 2, 3]
})
</script>

<style scoped>
.dd-body {
  overflow-y: auto;
  min-height: 0;
  padding: 12px 20px;
  background: var(--el-bg-color, #fff);
}
.dd-empty { display: flex; align-items: center; justify-content: center; padding: 60px 20px; color: var(--color-text-muted, #8898aa); font-size: 14px; }
</style>
