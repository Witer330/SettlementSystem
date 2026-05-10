<script setup lang="ts">
defineProps<{
  status: 'stopped' | 'running' | 'unhealthy' | 'starting'
  pid: number | null
  uptime: number
  port: number
}>()

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
</script>

<template>
  <div class="status-card">
    <div class="status-row">
      <div class="status-dot" :class="status"></div>
      <span class="status-text">{{ statusLabel(status) }}</span>
    </div>
    <div class="info-grid">
      <div class="info-item">
        <span class="label">端口</span>
        <span class="value">{{ port }}</span>
      </div>
      <div class="info-item" v-if="pid">
        <span class="label">PID</span>
        <span class="value">{{ pid }}</span>
      </div>
      <div class="info-item" v-if="status === 'running'">
        <span class="label">运行时间</span>
        <span class="value">{{ formatUptime(uptime) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-card {
  background: #16213e;
  border-radius: 12px;
  padding: 16px 20px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.running { background: #4ade80; box-shadow: 0 0 8px #4ade8080; }
.status-dot.stopped { background: #f87171; }
.status-dot.unhealthy { background: #fbbf24; }
.status-dot.starting { background: #60a5fa; animation: pulse 1s infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-text {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.info-grid {
  display: flex;
  gap: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
}

.value {
  font-size: 14px;
  color: #ccc;
  font-variant-numeric: tabular-nums;
}
</style>
