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
      class="btn btn-restart"
      :disabled="status === 'stopped' || loading"
      @click="restartServer"
    >
      重启服务
    </button>
    <button
      class="btn btn-browser"
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
  gap: 10px;
}

.btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  color: #fff;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn:not(:disabled):hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.btn-start { background: #22c55e; }
.btn-stop { background: #ef4444; }
.btn-restart { background: #f59e0b; }
.btn-browser { background: #6366f1; }
</style>
