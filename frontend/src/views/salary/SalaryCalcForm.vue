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
      <el-form-item label="员工范围">
        <el-select
          :model-value="form.employeeScope"
          placeholder="全部员工"
          clearable
          style="width: 180px"
          @update:model-value="$emit('update:employeeScope', $event)"
        >
          <el-option label="全部员工" value="all" />
          <el-option label="时薪员工" value="hourly" />
          <el-option label="计件员工" value="piece" />
        </el-select>
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
    employeeScope: 'all' | 'hourly' | 'piece'
  }
  loading: boolean
}>()

defineEmits<{
  'update:period': [value: string]
  'update:employeeScope': [value: 'all' | 'hourly' | 'piece']
  calculate: []
}>()
</script>

<style scoped>
.form-card {
  margin-bottom: var(--space-6);
}
</style>
