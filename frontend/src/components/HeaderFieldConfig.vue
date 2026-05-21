<template>
  <el-drawer v-model="visible" title="表头字段配置" size="340px" :append-to-body="true">
    <div class="hfc-tip">拖拽调整顺序，开关控制显隐</div>
    <!-- 每行字段数 -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <span style="font-size:13px;color:var(--color-text-secondary)">每行字段数</span>
      <el-input-number v-model="localPerRow" :min="1" :max="6" size="small" controls-position="right" style="width:100px" />
    </div>
    <draggable
      v-model="localFields"
      item-key="key"
      handle=".hfc-drag"
      animation="200"
      ghost-class="hfc-ghost"
    >
      <template #item="{ element }">
        <div class="hfc-item" :class="{ 'hfc-item--hidden': !element.visible }">
          <el-icon class="hfc-drag"><Rank /></el-icon>
          <span class="hfc-label">{{ element.label }}</span>
          <span class="hfc-spacer" />
          <el-tag v-if="element.type === 'display'" size="small" type="info">只读</el-tag>
          <el-switch v-model="element.visible" size="small" />
        </div>
      </template>
    </draggable>
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

const props = defineProps<{
  modelValue: boolean
  fields: HeaderFieldDef[]
  perRow: number
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  save: [fields: HeaderFieldDef[], perRow: number]
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
.hfc-tip { font-size: 12px; color: var(--color-text-muted, #8898aa); margin-bottom: 12px; }
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
