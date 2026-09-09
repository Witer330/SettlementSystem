<template>
  <el-drawer v-model="visible" title="表头字段配置" size="380px" :append-to-body="true">
    <!-- 每行字段数 -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <span style="font-size:13px;color:var(--color-text-secondary)">每行字段数</span>
      <el-input-number v-model="localPerRow" :min="1" :max="6" size="small" controls-position="right" style="width:100px" />
    </div>

    <!-- 预设字段 -->
    <div class="hfc-section-title">预设字段（拖拽排序，开关显隐）</div>
    <draggable v-model="localFields" item-key="key" handle=".hfc-drag" animation="200" ghost-class="hfc-ghost">
      <template #item="{ element }">
        <div class="hfc-item" :class="{ 'hfc-item--hidden': !element.visible }">
          <el-icon class="hfc-drag"><Rank /></el-icon>
          <span class="hfc-label">{{ element.label }}</span>
          <span class="hfc-spacer" />
          <el-tag v-if="element.source === 'partner'" size="small" type="success" effect="plain">往来</el-tag>
          <el-tag v-else-if="element.type === 'display'" size="small" type="info">只读</el-tag>
          <el-switch v-model="element.visible" size="small" />
        </div>
      </template>
    </draggable>

    <!-- 往来字段 -->
    <div class="hfc-section-title" style="margin-top:16px">往来字段（勾选后加入表头）</div>
    <div v-if="partnerFields.length === 0" style="font-size:12px;color:var(--color-text-muted);padding:8px 0">暂无往来字段，请先在往来管理中定义</div>
    <div v-for="pf in partnerFields" :key="pf.key" class="hfc-item">
      <span class="hfc-label">{{ pf.label }}</span>
      <span class="hfc-spacer" />
      <el-tag size="small" :type="pf.type === 'select' ? 'warning' : ''">{{ pf.type === 'select' ? '下拉' : pf.type === 'number' ? '数字' : '文本' }}</el-tag>
      <el-switch :model-value="isPartnerChecked(pf.key)" size="small" @update:model-value="(v: boolean) => togglePartner(pf, v)" />
    </div>

    <template #footer>
      <el-button size="small" @click="handleReset">恢复默认</el-button>
      <el-button size="small" @click="visible = false">取消</el-button>
      <el-button size="small" type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Rank } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import type { HeaderFieldDef } from '@/composables/useHeaderFields'
import type { PartnerCustomField } from '@/api/partnerCustomField'

const props = defineProps<{
  modelValue: boolean
  fields: HeaderFieldDef[]
  perRow: number
  partnerFields: PartnerCustomField[]
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  save: [fields: HeaderFieldDef[], perRow: number]
  'toggle-partner': [pf: PartnerCustomField, add: boolean]
  reset: []
}>()

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const localFields = ref<HeaderFieldDef[]>([])
const localPerRow = ref(3)
const saving = ref(false)

watch(() => props.modelValue, (v) => {
  if (v) {
    localFields.value = JSON.parse(JSON.stringify(props.fields))
    localPerRow.value = props.perRow
  }
})

function isPartnerChecked(pfKey: string): boolean {
  return localFields.value.some(f => f.key === 'pf_' + pfKey)
}

function togglePartner(pf: PartnerCustomField, add: boolean) {
  emit('toggle-partner', pf, add)
  // 立即更新本地列表以反映变化
  if (add) {
    const hd: HeaderFieldDef = {
      key: 'pf_' + pf.key,
      label: pf.label,
      type: pf.type === 'number' ? 'number' : pf.type === 'select' ? 'select' : 'input',
      options: pf.options ? JSON.parse(pf.options) : undefined,
      visible: true,
      source: 'partner'
    }
    if (!localFields.value.some(f => f.key === hd.key)) localFields.value.push(hd)
  } else {
    const idx = localFields.value.findIndex(f => f.key === 'pf_' + pf.key)
    if (idx >= 0) localFields.value.splice(idx, 1)
  }
}

async function handleSave() {
  saving.value = true
  try {
    emit('save', localFields.value, localPerRow.value)
    visible.value = false
  } finally {
    saving.value = false
  }
}

function handleReset() {
  emit('reset')
  visible.value = false
}
</script>

<style scoped>
.hfc-section-title { font-size: 13px; font-weight: 500; color: var(--color-text-secondary, #425466); margin-bottom: 8px; }
.hfc-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px; margin-bottom: 4px;
  background: var(--bg-muted, #f5f7fa); transition: all 0.2s;
}
.hfc-item--hidden { opacity: 0.45; }
.hfc-drag { cursor: grab; color: var(--color-text-muted, #c0c4cc); font-size: 16px; }
.hfc-drag:active { cursor: grabbing; }
.hfc-label { font-size: 13px; color: var(--color-text-primary, #303133); }
.hfc-spacer { flex: 1; }
.hfc-ghost { opacity: 0.4; background: var(--color-primary-light, #ecf0ff); }
</style>
