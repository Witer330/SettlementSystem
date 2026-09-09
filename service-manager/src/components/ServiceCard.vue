<script setup lang="ts">
interface InfoItem { label: string; value: string; mono?: boolean }
interface Action { id: string; label: string; type: 'start' | 'stop' | 'restart' | 'open' | 'test'; disabled: boolean }

defineProps<{
  title: string
  subtitle: string
  status: 'stopped' | 'running' | 'unhealthy' | 'starting' | 'disconnected' | 'checking' | 'connected'
  infoItems: InfoItem[]
  actions: Action[]
}>()

defineEmits<{ action: [id: string] }>()

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    running: '运行中', stopped: '已停止', unhealthy: '异常',
    starting: '启动中', disconnected: '未连接', checking: '检查中', connected: '已连接'
  }
  return map[s] || s
}

function statusTagClass(s: string): string {
  const map: Record<string, string> = {
    running: 'tag-success', stopped: 'tag-danger', unhealthy: 'tag-warning',
    starting: 'tag-muted', disconnected: 'tag-danger', checking: 'tag-muted', connected: 'tag-success'
  }
  return map[s] || 'tag-muted'
}

function actionBtnClass(type: string): string {
  const map: Record<string, string> = {
    start: 'btn-start', stop: 'btn-stop', restart: 'btn-restart',
    open: 'btn-white', test: 'btn-primary'
  }
  return map[type] || 'btn-white'
}
</script>

<template>
  <div class="card service-card">
    <div class="card-header">
      <div class="card-title-group">
        <div class="card-title">{{ title }}</div>
        <div class="card-subtitle">{{ subtitle }}</div>
      </div>
      <div class="status-row">
        <span class="status-dot" :class="status"></span>
        <span class="tag" :class="statusTagClass(status)">{{ statusLabel(status) }}</span>
      </div>
    </div>

    <div class="info-grid" v-if="infoItems.length > 0">
      <div class="info-item" v-for="item in infoItems" :key="item.label">
        <span class="text-xs info-label">{{ item.label }}</span>
        <span class="text-small info-value" :class="{ 'text-mono-small': item.mono }">{{ item.value }}</span>
      </div>
    </div>

    <div class="card-actions" v-if="actions.length > 0">
      <button
        v-for="action in actions"
        :key="action.id"
        class="btn"
        :class="actionBtnClass(action.type)"
        :disabled="action.disabled"
        @click="$emit('action', action.id)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.service-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.card-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-540);
  color: var(--color-text-primary);
}

.card-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.running, .status-dot.connected {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
}
.status-dot.stopped, .status-dot.disconnected { background: var(--color-danger); }
.status-dot.unhealthy { background: var(--color-warning); }
.status-dot.starting, .status-dot.checking {
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
  gap: var(--space-3) var(--space-5);
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

.card-actions {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-color-light);
}

.card-actions .btn {
  flex: 1;
  padding: 6px 12px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-480);
}

.btn-start {
  background: var(--color-success);
  color: #fff;
}
.btn-start:hover:not(:disabled) { filter: brightness(1.1); }

.btn-stop {
  background: var(--color-danger);
  color: #fff;
}
.btn-stop:hover:not(:disabled) { filter: brightness(1.1); }

.btn-restart {
  background: var(--color-warning);
  color: #000;
}
.btn-restart:hover:not(:disabled) { filter: brightness(1.1); }
</style>
