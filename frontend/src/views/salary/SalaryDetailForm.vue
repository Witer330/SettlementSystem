<template>
  <div class="detail-form" v-loading="loading">
    <!-- 功能栏 -->
    <div class="ws-toolbar" style="border:none;background:transparent;padding:4px 0">
      <span style="font-size:12px;font-weight:600;color:#999;margin-right:8px">操作</span>
      <el-button size="small" type="primary" :loading="saving" @click="handleSave" :disabled="readonly">保存</el-button>
      <el-button v-if="sheetStatus === 'draft'" size="small" type="success" @click="handleApprove" :disabled="readonly">审核</el-button>
      <el-button v-if="sheetStatus === 'approved'" size="small" type="warning" @click="handleUnapprove">反审</el-button>
      <span class="dab-spacer" />
      <span v-if="sheetNo" style="font-size:13px;color:var(--color-text-secondary);margin-right:12px">{{ sheetNo }}</span>
      <el-tag v-if="sheetId" :type="sheetStatus === 'approved' ? 'success' : 'warning'" size="small">{{ sheetStatus === 'approved' ? '已审核' : '待审核' }}</el-tag>
    </div>

    <!-- 表头 -->
    <div style="display:flex;gap:16px;align-items:center;padding:8px 0;border-bottom:1px solid var(--el-border-color-light);margin-bottom:8px">
      <span style="font-size:13px;color:var(--color-text-muted)">日期</span>
      <el-date-picker v-model="form.batchDate" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" size="small" :disabled="readonly" />
      <span style="font-size:13px;color:var(--color-text-muted);margin-left:16px">备注</span>
      <el-input v-model="form.remark" placeholder="" size="small" style="width:200px" :disabled="readonly" />
      <span style="font-size:13px;color:var(--color-text-muted);margin-left:16px">制单人</span>
      <span style="font-size:13px">{{ form.creator || '系统' }}</span>
      <span style="font-size:13px;color:var(--color-text-muted);margin-left:auto" v-if="sheetCreatedAt">创建 {{ new Date(sheetCreatedAt).toLocaleString('zh-CN') }}</span>
    </div>

    <!-- 明细表 -->
    <el-table :data="form.items" border size="small" style="width:100%">
      <el-table-column label="#" width="40" align="center"><template #default="{ $index }">{{ $index + 1 }}</template></el-table-column>
      <el-table-column label="员工" min-width="120">
        <template #default="{ row: r }">
          <el-select v-model="r.employeeId" filterable size="small" style="width:100%" :disabled="readonly" @change="onEmployeeChange(r)">
            <el-option v-for="e in employees" :key="e.id" :label="`${e.name} (${e.code})`" :value="e.id" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="日期" width="130">
        <template #default="{ row: r }"><el-date-picker v-model="r.date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" size="small" :disabled="readonly" /></template>
      </el-table-column>
      <el-table-column label="类型" width="90">
        <template #default="{ row: r }">
          <el-select v-model="r.type" size="small" :disabled="readonly" @change="onTypeChange(r)">
            <el-option label="计件" value="piece" /><el-option label="计时" value="hourly" /><el-option label="其他" value="other" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="工序/描述" min-width="180">
        <template #default="{ row: r }">
          <el-select v-if="r.type === 'piece'" v-model="r.jobTypeId" filterable size="small" style="width:100%" :disabled="readonly" @change="onJobTypeChange(r)">
            <el-option v-for="j in jobTypes" :key="j.id" :label="`${j.name} (¥${j.unitPrice || 0})`" :value="j.id" />
          </el-select>
          <el-input v-else v-model="r.remark" placeholder="描述" size="small" :disabled="readonly" />
        </template>
      </el-table-column>
      <el-table-column label="数量/h" width="90">
        <template #default="{ row: r }">
          <el-input-number v-if="r.type !== 'other'" v-model="r.quantity" :min="0" size="small" style="width:100%" controls-position="right" :disabled="readonly" @change="calcAmount(r)" />
        </template>
      </el-table-column>
      <el-table-column label="单价" width="90">
        <template #default="{ row: r }">
          <el-input-number v-if="r.type !== 'other'" v-model="r.unitPrice" :min="0" :precision="2" size="small" style="width:100%" controls-position="right" :disabled="readonly" @change="calcAmount(r)" />
          <el-input-number v-else v-model="r.amount" :min="0" :precision="2" size="small" style="width:100%" controls-position="right" :disabled="readonly" />
        </template>
      </el-table-column>
      <el-table-column label="金额" width="100" align="right">
        <template #default="{ row: r }"><b>{{ r.amount.toFixed(2) }}</b></template>
      </el-table-column>
      <el-table-column v-if="!readonly" width="50" align="center"><template #default="{ $index }"><el-button link type="danger" size="small" @click="form.items.splice($index, 1)">✕</el-button></template></el-table-column>
    </el-table>

    <div v-if="!readonly" style="margin-top:8px">
      <el-button size="small" @click="addItem">+ 添加行</el-button>
    </div>

    <!-- 表尾 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:1px solid var(--el-border-color-light)">
      <span style="font-size:13px;color:var(--color-text-muted)">合计金额：<b style="font-size:16px;color:var(--color-text-primary)">¥{{ totalAmount.toFixed(2) }}</b></span>
      <span style="font-size:12px;color:var(--color-text-muted)">制单人：{{ form.creator || '系统' }} | 制单日期：{{ form.batchDate }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { salaryDetailApi } from '@/api/salaryDetail'
import { employeeApi } from '@/api/employee'
import { jobTypeApi } from '@/api/jobType'

const props = defineProps<{ sheetId?: number; isNew?: boolean; readonly?: boolean }>()
const emit = defineEmits<{ success: [sheetNo: string]; cancel: [] }>()

const loading = ref(false); const saving = ref(false)
const sheetId = ref(props.sheetId || 0)
const sheetStatus = ref('draft')
const sheetNo = ref('')
const sheetCreatedAt = ref('')
const readonly = computed(() => props.readonly || sheetStatus.value === 'approved')
const employees = ref<any[]>([])
const jobTypes = ref<any[]>([])

const form = reactive({ batchDate: new Date().toISOString().slice(0, 10), remark: '', creator: '系统', items: [] as any[] } as { batchDate: string; remark: string; creator: string; items: any[] })
const totalAmount = computed(() => form.items.reduce((s, i) => s + (i.amount || 0), 0))

function addItem() { form.items.push({ employeeId: 0, type: 'piece', date: form.batchDate, jobTypeId: 0, quantity: 1, unitPrice: 0, amount: 0, remark: '' }) }
function calcAmount(r: any) { if (r.type !== 'other') r.amount = (r.quantity || 0) * (r.unitPrice || 0) }
function onTypeChange(r: any) { r.jobTypeId = 0; r.quantity = r.type === 'hourly' ? 8 : 1; r.unitPrice = 0; r.amount = 0; calcAmount(r) }
function onJobTypeChange(r: any) { const j = jobTypes.value.find(x => x.id === r.jobTypeId); if (j) { r.unitPrice = j.unitPrice || 0; calcAmount(r) } }
function onEmployeeChange(r: any) { const e = employees.value.find(x => x.id === r.employeeId); if (e && r.type === 'hourly' && !r.unitPrice) { r.unitPrice = e.hourlyRate || 0; calcAmount(r) } }

async function loadSheet() {
  if (!sheetId.value) return
  loading.value = true
  try {
    const s = await salaryDetailApi.getDetail(sheetId.value)
    sheetStatus.value = s.status; sheetNo.value = s.sheetNo; sheetCreatedAt.value = s.createdAt
    form.batchDate = s.batchDate?.slice(0, 10) || form.batchDate; form.remark = s.remark || ''; form.creator = s.creator || '系统'
    form.items = (s.items || []).map((i: any) => ({
      employeeId: i.employeeId, type: i.type, date: i.date?.slice(0, 10) || form.batchDate,
      jobTypeId: 0, productId: i.productId || 0,
      quantity: i.quantity || (i.type === 'hourly' ? i.hours : 1),
      unitPrice: i.unitPrice || 0, amount: i.amount, remark: i.remark || '', id: i.id
    }))
  } finally { loading.value = false }
}

async function handleSave() {
  saving.value = true
  try {
    const items = form.items.filter((i: any) => i.employeeId > 0 && i.amount > 0).map((i: any) => ({
      employeeId: i.employeeId, type: i.type, date: i.date, productId: null,
      quantity: i.type !== 'other' ? i.quantity : null, unitPrice: i.type !== 'other' ? i.unitPrice : null,
      hours: i.type === 'hourly' ? i.quantity : null, amount: i.amount, remark: i.remark
    }))
    if (sheetId.value) { await salaryDetailApi.update(sheetId.value, { items, batchDate: form.batchDate, remark: form.remark }) }
    else { const r = await salaryDetailApi.create({ items, batchDate: form.batchDate, remark: form.remark, creator: '系统' }); sheetId.value = r.id; sheetNo.value = r.sheetNo; sheetStatus.value = r.status }
    ElMessage.success('已保存'); emit('success', sheetNo.value)
  } catch (e: any) { ElMessage.error(e.message) } finally { saving.value = false }
}

async function handleApprove() {
  try { await ElMessageBox.confirm('审核通过后不可编辑，确定？', '审核确认', { type: 'info' }) } catch { return }
  await salaryDetailApi.approve(sheetId.value); sheetStatus.value = 'approved'; ElMessage.success('已审核')
}
async function handleUnapprove() {
  try { await ElMessageBox.confirm('反审后可重新编辑，确定？', '反审确认', { type: 'warning' }) } catch { return }
  try { await salaryDetailApi.unapprove(sheetId.value); sheetStatus.value = 'draft'; ElMessage.success('已反审') } catch (e: any) { ElMessage.error(e.message) }
}

onMounted(async () => {
  const [er, jr] = await Promise.all([
    employeeApi.getList({ page: 1, pageSize: 1000, status: 'active' }),
    jobTypeApi.getList()
  ])
  employees.value = er.list; jobTypes.value = jr
  if (sheetId.value) await loadSheet()
  else if (props.isNew) addItem()
})
</script>

<style scoped>
.detail-form { flex:1; overflow-y:auto; padding: var(--space-4); }
.ws-toolbar { display:flex; align-items:center; gap:6px; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid var(--el-border-color-light); }
.dab-spacer { flex:1; }
</style>
