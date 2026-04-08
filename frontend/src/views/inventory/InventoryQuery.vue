<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="text-h2">库存查询</h1>
    </div>

    <el-card class="page-content">
      <el-empty description="功能开发中..." />
    </el-card>
  </div>
</template>

<script setup lang="ts">
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
