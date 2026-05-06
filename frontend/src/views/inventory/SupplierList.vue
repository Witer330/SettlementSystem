<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="text-h2">供应商管理</h1>
      <el-button type="primary" class="btn-black">
        <el-icon><Plus /></el-icon>
        新增供应商
      </el-button>
    </div>

    <el-card class="page-content">
      <el-empty description="功能开发中..." />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
</script>

<style scoped>
.page-container {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.page-header h1 {
  margin: 0;
}

.page-content {
  min-height: 400px;
}
</style>
