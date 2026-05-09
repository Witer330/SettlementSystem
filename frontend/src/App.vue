<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  // eslint-disable-next-line no-undef
  console.log('结算系统前端已启动')
})
</script>

<style scoped>
#app {
  height: 100vh;
}
</style>
