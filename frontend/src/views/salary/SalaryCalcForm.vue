<template>
  <el-card class="form-card" shadow="never">
    <el-form :model="form" inline>
      <el-form-item label="结算周期">
        <el-date-picker
          :model-value="form.period"
          type="month"
          placeholder="选择月份"
          format="YYYY-MM"
          value-format="YYYY-MM"
          @update:model-value="$emit('update:period', $event)"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="$emit('calculate')">
          开始计算
        </el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  form: {
    period: string
  }
  loading: boolean
}>()

defineEmits<{
  'update:period': [value: string]
  calculate: []
}>()
</script>

<style scoped>
.form-card {
  margin-bottom: var(--space-6);
}
</style>
