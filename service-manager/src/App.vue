<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import StatusBar from './components/StatusBar.vue'
import ControlPanel from './components/ControlPanel.vue'
import SystemConfig from './components/SystemConfig.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const serverStatus = ref<'stopped' | 'running' | 'unhealthy' | 'starting'>('stopped')
const pid = ref<number | null>(null)
const uptime = ref(0)
const port = ref(4000)
const showSettings = ref(false)
const portConflict = ref<number>()

let statusTimer: ReturnType<typeof setInterval>

onMounted(async () => {
  await loadConfig()
  await refreshStatus()
  statusTimer = setInterval(refreshStatus, 3000)

  await listen<number>('port-conflict', (event) => {
    portConflict.value = event.payload
    showSettings.value = true
  })

  // 计划任务 --autostart 模式：自动启动前后端服务
  await listen('auto-start-trigger', async () => {
    if (serverStatus.value === 'stopped') {
      try {
        serverStatus.value = 'starting'
        await invoke('start_server')
        setTimeout(refreshStatus, 2000)
      } catch {
        serverStatus.value = 'stopped'
      }
    }
  })
})

onUnmounted(() => {
  clearInterval(statusTimer)
})

async function loadConfig() {
  try {
    const config = await invoke<{ proxy_port: number }>('get_config')
    port.value = config.proxy_port
  } catch {
    port.value = 4000
  }
}

async function refreshStatus() {
  try {
    const status = await invoke<{ running: boolean; pid: number | null; backend_port: number; uptime: number }>('get_server_status')
    serverStatus.value = status.running ? 'running' : 'stopped'
    pid.value = status.pid
    uptime.value = status.uptime || 0
  } catch {
    serverStatus.value = 'stopped'
    pid.value = null
    uptime.value = 0
  }
}

function onSettingsClose() {
  showSettings.value = false
  portConflict.value = undefined
}

async function onRestart() {
  showSettings.value = false
  portConflict.value = undefined
  await loadConfig()
  await refreshStatus()
}
</script>

<template>
  <div class="manager">
    <header class="header">
      <div class="header-left">
        <h1 class="text-h3">SettlementSystem</h1>
        <span class="text-mono-small" style="color: var(--color-text-muted)">SERVICE MANAGER</span>
      </div>
      <button class="btn btn-icon btn-white" @click="showSettings = !showSettings" title="设置">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z"/>
        </svg>
      </button>
    </header>

    <SettingsPanel
      v-if="showSettings"
      :port-conflict="portConflict"
      @close="onSettingsClose"
      @restart="onRestart"
    />

    <template v-else>
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

      <SystemConfig @config-changed="onRestart" />
    </template>
  </div>
</template>

<style>
.manager {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.header h1 {
  color: var(--color-text-primary);
}
</style>
