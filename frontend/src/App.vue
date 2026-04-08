<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  console.log('Settlement System Frontend Started')
})
</script>

<style scoped>
#app {
  height: 100vh;
}
</style>
