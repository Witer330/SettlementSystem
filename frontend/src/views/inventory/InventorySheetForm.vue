<template>
  <div class="sheet-form" v-loading="loading">
    <div class="ws-toolbar">
      <span style="font-size:12px;font-weight:600;color:#999;margin-right:8px">操作</span>
      <el-button size="small" type="primary" :loading="saving" @click="handleSave" :disabled="readonly || sheetStatus === 'approved'">保存</el-button>
      <el-button v-if="sheetStatus === 'draft'" size="small" type="success" @click="handleApprove" :disabled="readonly">审核</el-button>
      <el-button v-if="sheetStatus === 'approved'" size="small" type="warning" @click="handleUnapprove">反审</el-button>
      <span class="dab-spacer" />
      <el-tag v-if="sheetNo" :type="sheetStatus === 'approved' ? 'success' : 'warning'" size="small">{{ sheetStatus === 'approved' ? '已审核' : '待审核' }}</el-tag>
      <span v-if="sheetNo" style="font-size:13px;color:var(--color-text-secondary);margin-left:8px">{{ sheetNo }}</span>
    </div>

    <!-- 表头 -->
    <div style="display:flex;gap:16px;align-items:center;padding:8px 0;border-bottom:1px solid var(--el-border-color-light);margin-bottom:12px">
      <span style="font-size:13px;color:var(--color-text-muted)">日期</span>
      <el-date-picker v-model="form.date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" size="small" :disabled="readonly" />
      <span style="font-size:13px;color:var(--color-text-muted);margin-left:16px">类型</span>
      <el-tag :type="isInbound ? 'success' : 'danger'" size="small">{{ isInbound ? '入库' : '出库' }}</el-tag>
    </div>

    <!-- 明细 -->
    <el-table :data="form.items" border size="small" style="width:100%">
      <el-table-column label="#" width="40" align="center"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
      <el-table-column label="物料" min-width="200">
        <template #default="{ row: r }">
          <el-select v-model="r.materialId" filterable size="small" style="width:100%" :disabled="readonly" @change="onMaterialChange(r)">
            <el-option v-for="m in materials" :key="m.id" :label="`${m.code} - ${m.name} (${m.unit})`" :value="m.id" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="包装" width="170">
        <template #default="{ row: r }">
          <div style="display:flex;gap:4px;align-items:center">
            <el-select v-model="r.pkgSpec" size="small" placeholder="" clearable style="width:90px" :disabled="readonly" @change="onPkgChange(r)">
              <el-option v-for="s in getPkgSpecs(r.materialId)" :key="s.name" :label="`${s.name} (1=${s.ratio})`" :value="s.name" />
            </el-select>
            <el-input-number v-if="r.pkgSpec" v-model="r.unitRatio" :min="1" size="small" style="width:80px" controls-position="right" :disabled="readonly" />
          </div>
        </template>
      </el-table-column>
      <el-table-column label="数量" width="120">
        <template #default="{ row: r }">
          <div style="display:flex;align-items:center;gap:4px">
            <el-input-number v-model="r.quantity" :min="1" size="small" style="width:80px" controls-position="right" :disabled="readonly" />
            <span style="font-size:11px;color:var(--color-text-muted);white-space:nowrap">{{ r.pkgSpec || getMaterialUnit(r.materialId) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="实际数量" width="90" align="right">
        <template #default="{ row: r }"><b>{{ actualQty(r) }}</b></template>
      </el-table-column>
      <el-table-column label="备注" min-width="120">
        <template #default="{ row: r }"><el-input v-model="r.remark" size="small" placeholder="" :disabled="readonly" /></template>
      </el-table-column>
      <el-table-column v-if="!readonly" width="50" align="center"><template #default="{ $index }"><el-button link type="danger" size="small" @click="form.items.splice($index, 1)">✕</el-button></template></el-table-column>
    </el-table>

    <div v-if="!readonly" style="margin-top:8px"><el-button size="small" @click="addItem">+ 添加行</el-button></div>

    <!-- 表尾 -->
    <div style="display:flex;justify-content:flex-end;margin-top:12px;padding-top:8px;border-top:1px solid var(--el-border-color-light)">
      <span style="font-size:13px;color:var(--color-text-muted)">制单人：系统 | {{ form.date }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { inventoryApi } from '@/api/inventory'
import { materialApi } from '@/api/material'
import { pkgSpecApi } from '@/api/pkgSpec'

const props = defineProps<{ sheetId?: number; isNew?: boolean; sheetType: string; readonly?: boolean }>()
const emit = defineEmits<{ success: [batchNo: string]; cancel: [] }>()

const loading = ref(false); const saving = ref(false)
const isInbound = computed(() => props.sheetType === 'in')
const readonly = computed(() => props.readonly ?? false)
const materials = ref<any[]>([])
const sheetNo = ref('')
const sheetStatus = ref('draft')
const pkgSpecMap = ref<Record<number, Array<{ name: string; unitName: string; ratio: number; isDefault: boolean }>>>({})
function getPkgSpecs(materialId: number) { return pkgSpecMap.value[materialId] || [] }

const form = reactive({ date: new Date().toISOString().slice(0, 10), items: [] as any[] })

function getMaterialUnit(id: number) { return materials.value.find(m => m.id === id)?.unit || '' }
function actualQty(r: any) { return r.pkgSpec && r.unitRatio ? r.quantity * r.unitRatio : r.quantity }

function addItem() { form.items.push({ materialId: 0, quantity: 1, pkgSpec: '', unitRatio: 0, remark: '' }) }
async function onMaterialChange(r: any) {
  if (!r.materialId) return
  if (!pkgSpecMap.value[r.materialId]) {
    try { pkgSpecMap.value[r.materialId] = await pkgSpecApi.getList('material', r.materialId) } catch { pkgSpecMap.value[r.materialId] = [] }
  }
}
function onPkgChange(r: any) {
  if (!r.pkgSpec) { r.unitRatio = 0; return }
  const specs = getPkgSpecs(r.materialId)
  const spec = specs.find(s => s.name === r.pkgSpec)
  r.unitRatio = spec?.ratio || 0
}

async function handleSave() {
  const valid = form.items.filter((i: any) => i.materialId > 0 && i.quantity > 0)
  if (valid.length === 0) { ElMessage.warning('请添加物料明细'); return }
  saving.value = true
  try {
    const batchNo = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Date.now()%100000).padStart(5,'0')}`
    const items = valid.map((item: any) => ({ materialId: item.materialId, quantity: actualQty(item), pkgSpec: item.pkgSpec, unitRatio: item.unitRatio, remark: item.remark }))
    await inventoryApi.batchCreate({ items, type: props.sheetType, batchNo })
    sheetNo.value = batchNo; sheetStatus.value = 'draft'
    ElMessage.success('已保存为草稿，审核后库存生效')
    emit('success', batchNo)
  } catch (e: any) { ElMessage.error(e.message) } finally { saving.value = false }
}

async function handleApprove() {
  try { await ElMessageBox.confirm('审核后库存将更新，确定？', '审核确认', { type: 'info' }) } catch { return }
  try { await inventoryApi.approveBatch(sheetNo.value); sheetStatus.value = 'approved'; ElMessage.success('已审核，库存已更新') } catch (e: any) { ElMessage.error(e.message) }
}
async function handleUnapprove() {
  try { await ElMessageBox.confirm('反审后库存将回退，确定？', '反审确认', { type: 'warning' }) } catch { return }
  try { await inventoryApi.unapproveBatch(sheetNo.value); sheetStatus.value = 'draft'; ElMessage.success('已反审，库存已回退') } catch (e: any) { ElMessage.error(e.message) }
}

onMounted(async () => {
  const r = await materialApi.getList({ page: 1, pageSize: 200, status: 'active' })
  materials.value = r.list
  if (props.isNew) addItem()
})
</script>

<style scoped>
.sheet-form { flex:1; overflow-y:auto; padding: var(--space-4); }
.ws-toolbar { display:flex; align-items:center; gap:6px; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid var(--el-border-color-light); }
.dab-spacer { flex:1; }
</style>
