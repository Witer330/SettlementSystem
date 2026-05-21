<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder || `请选择${roleLabel}`"
    :size="size"
    :disabled="disabled"
    :clearable="clearable"
    filterable
    style="width: 100%"
    @update:model-value="handleChange"
  >
    <el-option
      v-for="p in partners"
      :key="p.id"
      :label="p.name"
      :value="p.id"
    >
      <span style="float: left">{{ p.name }}</span>
      <span style="float: right; color: var(--el-text-color-secondary); font-size: 12px">{{ p.code }}</span>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { partnerApi, type Partner } from '@/api/partner'

const props = withDefaults(defineProps<{
  modelValue?: number | null
  role: 'customer' | 'supplier'
  size?: 'large' | 'default' | 'small'
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
}>(), {
  size: 'default',
  disabled: false,
  clearable: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void
  (e: 'change', partner: Partner | null): void
}>()

const partners = ref<Partner[]>([])

const roleLabel = computed(() => props.role === 'customer' ? '客户' : '供应商')

const loadPartners = async () => {
  const params: any = { page: 1, pageSize: 1000, status: 'active' }
  if (props.role === 'customer') params.isCustomer = true
  else params.isSupplier = true
  const res = await partnerApi.getList(params)
  partners.value = res.list
}

const handleChange = (val: number | null) => {
  emit('update:modelValue', val)
  const partner = partners.value.find(p => p.id === val) || null
  emit('change', partner)
}

onMounted(loadPartners)
defineExpose({ reload: loadPartners })
</script>
