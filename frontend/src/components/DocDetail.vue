<template>
  <div ref="bodyRef" class="dd-body" @focusin="onFocusIn">
    <!-- 明细/汇总切换 -->
    <div class="dd-mode-bar">
      <el-radio-group v-model="viewMode" size="small" @change="onModeChange">
        <el-radio-button value="detail">明细</el-radio-button>
        <el-radio-button value="summary">汇总</el-radio-button>
      </el-radio-group>
    </div>

    <div class="dd-table-wrap">
    <el-table ref="tableRef" :data="displayItems" border size="small" :height="tableHeight" style="width:100%" @selection-change="onSelectionChange">
      <!-- 批量选择（明细模式） -->
      <el-table-column v-if="viewMode === 'detail' && !readonly && !locked" type="selection" width="40" align="center" />

      <!-- #（明细模式：添加行 + 批量删除） -->
      <el-table-column width="60" align="center">
        <template v-if="viewMode === 'detail'" #header>
          <div style="display:flex;align-items:center;gap:2px;">
            <el-button v-if="!readonly" link size="small" @click="addRowAndScroll" title="添加行">+</el-button>
            <span v-else>#</span>
            <el-button v-if="!readonly && !locked && items.length > 1" link type="danger" size="small" :disabled="selectedRows.length === 0" @click="batchRemove">删<template v-if="selectedRows.length > 0">{{ selectedRows.length }}</template></el-button>
          </div>
        </template>
        <template v-else #header>#</template>
        <template #default="{ $index }">{{ $index + 1 }}</template>
      </el-table-column>

      <!-- 物料/产品 -->
      <el-table-column :label="itemLabel" min-width="260">
        <template #default="{ row: r }">
          <template v-if="viewMode === 'detail'">
            <el-select
              :model-value="r[itemField]"
              @update:model-value="onItemSelect($event, r)"
              placeholder="编码/名称搜索"
              filterable size="small" style="width:100%"
              :disabled="readonly || locked"
              @keydown="(e: KeyboardEvent) => nav.onCellKeydown(e)"
            >
              <el-option v-for="opt in options" :key="opt.id" :label="`${opt.code} - ${opt.name}`" :value="opt.id" />
            </el-select>
          </template>
          <template v-else>
            <span class="dd-readonly-cell">{{ r.productName || '—' }}</span>
          </template>
        </template>
      </el-table-column>

      <!-- 数量 -->
      <el-table-column label="数量" min-width="110">
        <template #default="{ row: r }">
          <el-input-number
            v-if="viewMode === 'detail'"
            v-model="r.quantity" :min="1" size="small" style="width:100%"
            controls-position="right" :disabled="readonly || locked"
            @keydown="(e: KeyboardEvent) => nav.onCellKeydown(e)"
          />
          <span v-else class="dd-readonly-cell" style="text-align:right;display:block">{{ r.quantity }}</span>
        </template>
      </el-table-column>

      <!-- 单价 -->
      <el-table-column label="单价" min-width="130">
        <template #default="{ row: r }">
          <template v-if="viewMode === 'detail'">
            <div style="display:flex;align-items:center;gap:2px;">
              <el-input-number
                v-model="r.price" :min="0" :precision="2" size="small" style="width:100%"
                :controls="false" :disabled="readonly || locked"
                @keydown="(e: KeyboardEvent) => nav.onCellKeydown(e)"
              />
              <slot name="priceTag" :row="r" />
            </div>
          </template>
          <span v-else class="dd-readonly-cell" style="text-align:right;display:block">{{ r.price.toFixed(2) }}</span>
        </template>
      </el-table-column>

      <!-- 已收/已发 -->
      <el-table-column v-if="showReceived" :label="receivedLabel" min-width="80" align="center">
        <template #default="{ row: r }">{{ r[receivedField] || 0 }}</template>
      </el-table-column>

      <!-- 小计 -->
      <el-table-column label="小计" min-width="100" align="right">
        <template #default="{ row: r }">
          <slot name="subtotal" :row="r" :amount="(r.quantity||0)*(r.price||0)" />
        </template>
      </el-table-column>
    </el-table>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation'

const bodyRef = ref<HTMLElement | null>(null)
const tableRef = ref<any>(null)
const selectedRows = ref<any[]>([])
const viewMode = ref<'detail' | 'summary'>('detail')
const tableHeight = ref<string | number>('100%')

function onModeChange() {
  tableRef.value?.clearSelection()
}

function getProductName(id: number) {
  if (!id) return ''
  const opt = props.options.find((o: any) => o.id === id)
  return opt ? `${opt.code} - ${opt.name}` : ''
}

const displayItems = computed(() => {
  if (viewMode.value === 'detail') return props.items

  // 汇总模式：按产品归并，排除空行
  const map = new Map<number, { quantity: number; totalPrice: number; count: number }>()
  for (const item of props.items) {
    const id = Number(item[props.itemField])
    if (!id) continue
    const existing = map.get(id)
    if (existing) {
      existing.quantity += Number(item.quantity) || 0
      existing.totalPrice += (Number(item.price) || 0) * (Number(item.quantity) || 0)
      existing.count++
    } else {
      map.set(id, {
        quantity: Number(item.quantity) || 0,
        totalPrice: (Number(item.price) || 0) * (Number(item.quantity) || 0),
        count: 1
      })
    }
  }
  return Array.from(map.entries()).map(([id, v]) => ({
    [props.itemField]: id,
    productName: getProductName(id),
    quantity: v.quantity,
    price: v.quantity > 0 ? v.totalPrice / v.quantity : 0
  }))
})

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
  batchRemove: [rows: any[]]
  itemSelect: [value: number, row: any]
}>()

function onSelectionChange(rows: any[]) {
  selectedRows.value = rows
}

async function batchRemove() {
  if (selectedRows.value.length === 0) return
  try { await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 行明细？`, '批量删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  emit('batchRemove', selectedRows.value)
  tableRef.value?.clearSelection()
}

async function onRemove(row: any) {
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

function addRowAndScroll() {
  emit('addRow')
  scrollToBottom()
}

function scrollToBottom() {
  setTimeout(() => {
    const root = bodyRef.value
    if (!root) return
    const rows = root.querySelectorAll('.el-table__body-wrapper tbody tr')
    const lastRow = rows[rows.length - 1] as HTMLElement | null
    if (lastRow) lastRow.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, 200)
}

const nav = useKeyboardNavigation({
  items: props.items as any,
  addItemRow: () => { emit('addRow'); scrollToBottom() },
  removeItem: (row: any) => emit('removeRow', row),
  saveDraft: async () => {},
  submit: async () => {},
  editableCols: [1, 2, 3]
})
</script>

<style scoped>
.dd-body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  padding: 8px 20px 12px;
  background: var(--el-bg-color, #fff);
}
.dd-mode-bar {
  display: flex;
  align-items: center;
  padding-bottom: 8px;
  flex-shrink: 0;
}
.dd-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.dd-readonly-cell {
  font-size: 14px;
  color: var(--color-text-primary, #303133);
}
</style>
