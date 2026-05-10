<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import StatusBar from './components/StatusBar.vue'
import ControlPanel from './components/ControlPanel.vue'
import LogViewer from './components/LogViewer.vue'

const serverStatus = ref<'stopped' | 'running' | 'unhealthy' | 'starting'>('stopped')
const pid = ref<number | null>(null)
const uptime = ref(0)
const port = ref(4000)

let statusTimer: ReturnType<typeof setInterval>

onMounted(async () => {
  await refreshStatus()
  statusTimer = setInterval(refreshStatus, 3000)
})

onUnmounted(() => {
  clearInterval(statusTimer)
})

async function refreshStatus() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const status = await invoke<{ running: boolean; pid: number | null; uptime: number }>('get_server_status')
    serverStatus.value = status.running ? 'running' : 'stopped'
    pid.value = status.pid
    uptime.value = status.uptime
  } catch {
    serverStatus.value = 'stopped'
    pid.value = null
    uptime.value = 0
  }
}
</script>

<template>
  <div class="manager">
    <header class="header">
      <h1>SettlementSystem</h1>
      <span class="subtitle">服务管理器</span>
    </header>

    <StatusBar
      :status="serverStatus"
      :pid="pid"
      :uptime="uptime"
      :port="port"
    />

    <ControlPanel
      :status="serverStatus"
      @refresh="refreshStatus"
    />

    <LogViewer />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
  overflow: hidden;
  user-select: none;
}

.manager {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.header h1 {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.subtitle {
  font-size: 13px;
  color: #888;
}
</style>
