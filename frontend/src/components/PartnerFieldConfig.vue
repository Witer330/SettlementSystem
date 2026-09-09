<template>
  <div>
  <el-drawer v-model="visible" title="字段配置" size="400px" :append-to-body="true">
    <div class="pfc-tip">控制表单字段的可见性和是否必填</div>

    <div v-for="tab in tabs" :key="tab.key" class="pfc-section">
      <h4 class="pfc-section-title">{{ tab.label }}</h4>
      <div v-for="field in tabFields(tab.key)" :key="field.key" class="pfc-item" :class="{ 'pfc-item--hidden': !field.visible }">
        <span class="pfc-label">{{ field.label }}</span>
        <!-- 自定义字段显示额外信息 -->
        <template v-if="tab.key === 'custom'">
          <el-tag size="small" type="info" style="margin:0 2px">{{ field.key }}</el-tag>
          <span style="font-size:11px;color:var(--color-text-muted)">{{ typeLabel(field.type) }}</span>
          <el-tag v-if="fieldRefs[field.key]?.includes('salesOrder')" size="small" type="success" effect="plain" style="margin:0 2px">销货</el-tag>
          <el-tag v-if="fieldRefs[field.key]?.includes('purchaseOrder')" size="small" type="warning" effect="plain" style="margin:0 2px">采购</el-tag>
          <span v-if="!fieldRefs[field.key]" style="font-size:11px;color:var(--color-text-muted);margin:0 4px">未引用</span>
          <el-button link type="primary" size="small" @click="openEditDialog(field.key)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDeleteCustomField(field.key)">删除</el-button>
        </template>
        <span class="pfc-spacer" />
        <span class="pfc-toggle-label">可见</span>
        <el-switch v-model="field.visible" size="small" @change="onVisibleChange(field)" />
        <span class="pfc-toggle-label" style="margin-left:12px">必填</span>
        <el-switch v-model="field.required" size="small" :disabled="!field.visible" />
      </div>
    </div>

    <div style="margin-top:8px">
      <el-button size="small" style="width:100%" @click="openAddDialog">
        <el-icon><Plus /></el-icon>新增自定义字段
      </el-button>
    </div>

    <template #footer>
      <el-button size="small" @click="handleReset">恢复默认</el-button>
      <el-button size="small" @click="visible = false">取消</el-button>
      <el-button size="small" type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-drawer>

  <!-- 新增/编辑自定义字段对话框 -->
  <el-dialog v-model="fieldDialogVisible" :title="editingKey ? '编辑自定义字段' : '新增自定义字段'" width="480px" :append-to-body="true">
    <el-form :model="editField" label-width="70px">
      <el-form-item label="标签" required>
        <el-input v-model="editField.label" placeholder="中文显示，如 付款条件" />
      </el-form-item>
      <el-form-item label="类型" required>
        <el-select v-model="editField.type" style="width:100%" @change="onEditTypeChange">
          <el-option label="文本" value="input" />
          <el-option label="数字" value="number" />
          <el-option label="下拉选择" value="select" />
          <el-option label="多行文本" value="textarea" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="editField.type === 'select'" label="选项">
        <div class="opt-area">
          <el-tag v-for="(opt, idx) in editOptions" :key="idx" closable size="small" style="margin:2px 4px 2px 0" @close="removeOption(idx)">{{ opt }}</el-tag>
          <div v-if="editOptions.length === 0" style="font-size:12px;color:var(--color-text-muted);padding:4px 0">暂未添加选项</div>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <el-input v-model="optInput" placeholder="输入选项内容" size="small" @keyup.enter="addOption" />
          <el-button size="small" @click="addOption">添加</el-button>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="fieldDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingField" @click="handleSaveField">确定</el-button>
    </template>
  </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { FieldDef } from '@/composables/useFieldConfig'
import { partnerCustomFieldApi, type PartnerCustomField } from '@/api/partnerCustomField'
import { settingApi } from '@/api/setting'

const props = defineProps<{
  modelValue: boolean
  fields: FieldDef[]
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  save: [fields: FieldDef[]]
  reset: []
}>()

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const localFields = ref<FieldDef[]>([])
const saving = ref(false)

const tabs = [
  { key: 'basic', label: '基本信息' },
  { key: 'contact', label: '联系方式' },
  { key: 'extra', label: '附加信息' },
  { key: 'custom', label: '自定义' }
]

const tabFields = (tabKey: string) => localFields.value.filter(f => f.tab === tabKey)
function onVisibleChange(field: FieldDef) { if (!field.visible) field.required = false }

// ============ 自定义字段 ============
const customFields = ref<PartnerCustomField[]>([])
const fieldRefs = reactive<Record<string, string[]>>({})

// 新增/编辑对话框
const fieldDialogVisible = ref(false)
const savingField = ref(false)
const editingKey = ref('')
const editField = ref({ label: '', type: 'input' as string })
const editOptions = ref<string[]>([])
const optInput = ref('')

function parseOptions(options?: string | null): string[] {
  if (!options) return []
  try { return JSON.parse(options) } catch { return [] }
}

// 将 API 返回的自定义字段合并到 localFields 中
function mergeCustomIntoFields() {
  // 先移除之前合并的 custom tab 字段
  localFields.value = localFields.value.filter(f => f.tab !== 'custom')
  for (const cf of customFields.value) {
    // 检查是否已有保存的可见/必填配置
    const saved = localFields.value.find(f => f.key === cf.key)
    localFields.value.push({
      key: cf.key,
      label: cf.label,
      type: cf.type === 'textarea' ? 'input' : cf.type as FieldDef['type'],
      tab: 'custom',
      visible: saved?.visible ?? true,
      required: saved?.required ?? false
    })
  }
}

async function loadCustomFields() {
  try { customFields.value = await partnerCustomFieldApi.getFields() }
  catch { customFields.value = [] }
  // 检测引用
  Object.keys(fieldRefs).forEach(k => delete fieldRefs[k])
  try {
    const soConfig = await settingApi.getTyped<{ fields?: Array<{ key: string }> } | null>('salesOrder.headerFields')
    if (soConfig?.fields) {
      const soKeys = new Set(soConfig.fields.map(f => f.key))
      for (const cf of customFields.value) {
        if (soKeys.has(cf.key)) {
          if (!fieldRefs[cf.key]) fieldRefs[cf.key] = []
          fieldRefs[cf.key].push('salesOrder')
        }
      }
    }
  } catch {}
  try {
    const poConfig = await settingApi.getTyped<{ fields?: Array<{ key: string }> } | null>('purchaseOrder.headerFields')
    if (poConfig?.fields) {
      const poKeys = new Set(poConfig.fields.map(f => f.key))
      for (const cf of customFields.value) {
        if (poKeys.has(cf.key)) {
          if (!fieldRefs[cf.key]) fieldRefs[cf.key] = []
          fieldRefs[cf.key].push('purchaseOrder')
        }
      }
    }
  } catch {}
  mergeCustomIntoFields()
}

const typeLabel = (t: string) => ({ input: '文本', number: '数字', select: '下拉', textarea: '多行' } as Record<string, string>)[t] || t

function onEditTypeChange() { if (editField.value.type !== 'select') editOptions.value = [] }

function addOption() {
  const v = optInput.value.trim()
  if (!v) return
  if (editOptions.value.includes(v)) { ElMessage.warning('选项已存在'); return }
  editOptions.value.push(v)
  optInput.value = ''
}
function removeOption(idx: number) { editOptions.value.splice(idx, 1) }

function openAddDialog() {
  editingKey.value = ''
  editField.value = { label: '', type: 'input' }
  editOptions.value = []
  optInput.value = ''
  fieldDialogVisible.value = true
}

function openEditDialog(key: string) {
  const cf = customFields.value.find(f => f.key === key)
  if (!cf) return
  editingKey.value = key
  editField.value = { label: cf.label, type: cf.type }
  editOptions.value = parseOptions(cf.options)
  optInput.value = ''
  fieldDialogVisible.value = true
}

async function handleSaveField() {
  if (!editField.value.label) { ElMessage.warning('请输入标签'); return }
  savingField.value = true
  try {
    const data: any = { label: editField.value.label, type: editField.value.type }
    if (editField.value.type === 'select' && editOptions.value.length > 0) {
      data.options = JSON.stringify(editOptions.value)
    } else if (editField.value.type === 'select') {
      data.options = null
    }
    if (editingKey.value) {
      const cf = customFields.value.find(f => f.key === editingKey.value)
      if (cf) await partnerCustomFieldApi.updateField(cf.id, data)
      ElMessage.success('更新成功')
    } else {
      const existingCount = customFields.value.length
      let idx = existingCount + 1
      while (customFields.value.find(f => f.key === `cf_${idx}`)) idx++
      data.key = `cf_${idx}`
      await partnerCustomFieldApi.createField(data)
      ElMessage.success('自定义字段已添加')
    }
    fieldDialogVisible.value = false
    loadCustomFields()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally { savingField.value = false }
}

async function handleDeleteCustomField(key: string) {
  const cf = customFields.value.find(f => f.key === key)
  if (!cf) return
  try {
    await ElMessageBox.confirm(`删除"${cf.label}"将同时清除所有往来单位中该字段的值，确认删除？`, '确认删除', { type: 'warning' })
    await partnerCustomFieldApi.deleteField(cf.id)
    ElMessage.success('已删除')
    loadCustomFields()
  } catch { /* 取消 */ }
}

watch(() => props.modelValue, (v) => {
  if (v) {
    localFields.value = JSON.parse(JSON.stringify(props.fields))
    loadCustomFields()
  }
})

async function handleSave() {
  saving.value = true
  try {
    // 保存时排除 custom tab 字段（它们的定义在 API 中，可见/必填已在 localFields 中）
    const allFields = localFields.value
    emit('save', allFields)
    visible.value = false
  } finally { saving.value = false }
}

function handleReset() {
  // 移除自定义字段，恢复内置默认
  localFields.value = localFields.value.filter(f => f.tab !== 'custom')
  emit('reset')
  visible.value = false
}
</script>

<style scoped>
.pfc-tip { font-size: 12px; color: var(--color-text-muted, #8898aa); margin-bottom: 16px; }
.pfc-section { margin-bottom: 12px; }
.pfc-section-title { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.pfc-item { display: flex; align-items: center; gap: 4px; padding: 5px 6px; border-radius: 6px; margin-bottom: 2px; transition: opacity 0.2s; }
.pfc-item--hidden { opacity: 0.45; }
.pfc-label { font-size: 13px; color: var(--color-text-primary, #303133); min-width: 52px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pfc-spacer { flex: 1; }
.pfc-toggle-label { font-size: 11px; color: var(--color-text-secondary); width: 20px; text-align: center; flex-shrink: 0; }
.opt-area { min-height: 28px; padding: 4px 0; }
</style>
