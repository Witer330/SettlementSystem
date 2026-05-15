<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  status: 'stopped' | 'running' | 'unhealthy' | 'starting'
}>()

const emit = defineEmits<{
  refresh: []
}>()

const loading = ref(false)

async function invoke(cmd: string, args?: Record<string, unknown>) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

async function startServer() {
  loading.value = true
  try {
    await invoke('start_server')
    setTimeout(() => emit('refresh'), 1000)
  } catch (e) {
    console.error('启动失败:', e)
  } finally {
    loading.value = false
  }
}

async function stopServer() {
  loading.value = true
  try {
    await invoke('stop_server')
    setTimeout(() => emit('refresh'), 1000)
  } catch (e) {
    console.error('停止失败:', e)
  } finally {
    loading.value = false
  }
}

async function restartServer() {
  loading.value = true
  try {
    await invoke('restart_server')
    setTimeout(() => emit('refresh'), 2000)
  } catch (e) {
    console.error('重启失败:', e)
  } finally {
    loading.value = false
  }
}

async function openBrowser() {
  await invoke('open_browser')
}

async function detachServer() {
  loading.value = true
  try {
    await invoke('detach_server')
    setTimeout(() => emit('refresh'), 500)
  } catch (e) {
    console.error('脱管失败:', e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="control-panel">
    <button
      class="btn btn-start"
      :disabled="status === 'running' || status === 'starting' || loading"
      @click="startServer"
    >
      启动服务
    </button>
    <button
      class="btn btn-stop"
      :disabled="status === 'stopped' || loading"
      @click="stopServer"
    >
      停止服务
    </button>
    <button
      class="btn btn-detach"
      :disabled="status === 'stopped' || loading"
      @click="detachServer"
      title="停止管理但服务继续在后台运行"
    >
      脱管
    </button>
    <button
      class="btn btn-restart"
      :disabled="status === 'stopped' || loading"
      @click="restartServer"
    >
      重启服务
    </button>
    <button
      class="btn btn-white"
      :disabled="status !== 'running'"
      @click="openBrowser"
    >
      打开浏览器
    </button>
  </div>
</template>

<style scoped>
.control-panel {
  display: flex;
  gap: var(--space-2);
}

.btn {
  flex: 1;
  padding: 8px 16px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-480);
}

.btn-start {
  background: var(--color-success);
  color: #fff;
}

.btn-start:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-stop {
  background: var(--color-danger);
  color: #fff;
}

.btn-stop:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-detach {
  background: var(--color-warning);
  color: #000;
}

.btn-detach:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-restart {
  background: var(--color-warning);
  color: #000;
}

.btn-restart:hover:not(:disabled) {
  filter: brightness(1.1);
}
</style>
