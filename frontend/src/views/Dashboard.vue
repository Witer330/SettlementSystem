<template>
  <div class="dashboard">
    <el-container class="dashboard-container">
      <AppSidebar :is-collapsed="isCollapsed" />

      <el-container class="dashboard-main">
        <AppHeader :is-collapsed="isCollapsed" @toggle-sidebar="toggleSidebar" />

        <el-main class="dashboard-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from './layout/AppSidebar.vue'
import AppHeader from './layout/AppHeader.vue'

const isCollapsed = ref(false)

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<style scoped>
.dashboard {
  height: 100vh;
}

.dashboard-container {
  height: 100%;
}

.dashboard-main {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dashboard-content {
  flex: 1;
  background-color: var(--el-bg-color-page);
  padding: var(--space-6);
  overflow-y: auto;
}

@media (max-width: 768px) {
  .dashboard-main {
    margin-left: 0;
  }
}
</style>
