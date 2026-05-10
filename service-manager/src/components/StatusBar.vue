<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

interface Status {
  running: boolean
  pid: number | null
  backend_port: number
  unhealthy: boolean
  memory_mb: number
  cpu_percent: number
}

const props = defineProps<{
  status: 'stopped' | 'running' | 'unhealthy' | 'starting'
  pid: number | null
  uptime: number
  port: number
}>()

const memory = ref(0)
const cpu = ref(0)
const dbConnected = ref(false)

let pollTimer: ReturnType<typeof setInterval>

onMounted(() => {
  poll()
  pollTimer = setInterval(poll, 3000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})

async function poll() {
  if (props.status === 'running') {
    try {
      const s = await invoke<Status>('get_server_status')
      memory.value = s.memory_mb
      cpu.value = s.cpu_percent
    } catch { /* ignore */ }
    try {
      dbConnected.value = await invoke<boolean>('get_db_status')
    } catch { dbConnected.value = false }
  } else {
    memory.value = 0
    cpu.value = 0
    dbConnected.value = false
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}时${m}分`
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    running: '运行中',
    stopped: '已停止',
    unhealthy: '异常',
    starting: '启动中'
  }
  return map[s] || s
}

function statusTagClass(s: string): string {
  const map: Record<string, string> = {
    running: 'tag-success',
    stopped: 'tag-danger',
    unhealthy: 'tag-warning',
    starting: 'tag-muted'
  }
  return map[s] || 'tag-muted'
}
</script>

<template>
  <div class="card status-card">
    <div class="status-row">
      <div class="status-dot" :class="status"></div>
      <span class="tag" :class="statusTagClass(status)">{{ statusLabel(status) }}</span>
    </div>
    <div class="info-grid">
      <div class="info-item">
        <span class="text-xs info-label">端口</span>
        <span class="text-small info-value text-mono-small">{{ port }}</span>
      </div>
      <div class="info-item" v-if="pid">
        <span class="text-xs info-label">PID</span>
        <span class="text-small info-value text-mono-small">{{ pid }}</span>
      </div>
      <div class="info-item" v-if="status === 'running'">
        <span class="text-xs info-label">运行时间</span>
        <span class="text-small info-value">{{ formatUptime(uptime) }}</span>
      </div>
      <div class="info-item" v-if="status === 'running'">
        <span class="text-xs info-label">内存占用</span>
        <span class="text-small info-value text-mono-small">{{ memory }} MB</span>
      </div>
      <div class="info-item" v-if="status === 'running'">
        <span class="text-xs info-label">CPU</span>
        <span class="text-small info-value text-mono-small">{{ cpu.toFixed(1) }}%</span>
      </div>
      <div class="info-item" v-if="status === 'running'">
        <span class="text-xs info-label">数据库</span>
        <span class="text-small info-value db-status">
          <span class="db-dot" :class="{ ok: dbConnected }"></span>
          {{ dbConnected ? '已连接' : '未连接' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.running {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
}

.status-dot.stopped { background: var(--color-danger); }
.status-dot.unhealthy { background: var(--color-warning); }
.status-dot.starting {
  background: var(--color-primary);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-6);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.db-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.db-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-danger);
}

.db-dot.ok {
  background: var(--color-success);
  box-shadow: 0 0 4px rgba(52, 211, 153, 0.5);
}
</style>
