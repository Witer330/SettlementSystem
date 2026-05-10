<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const logs = ref<string[]>([])
const logContainer = ref<HTMLElement | null>(null)
const autoScroll = ref(true)

let pollTimer: ReturnType<typeof setInterval>

onMounted(async () => {
  await loadLogs()
  pollTimer = setInterval(loadLogs, 2000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})

async function loadLogs() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const content = await invoke<string>('read_logs')
    if (content) {
      const lines = content.split('\n').filter(l => l.trim())
      logs.value = lines.slice(-100)
      if (autoScroll.value) {
        await nextTick()
        scrollToBottom()
      }
    }
  } catch {
    // 日志文件可能不存在
  }
}

function scrollToBottom() {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}

function onScroll() {
  if (!logContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = logContainer.value
  autoScroll.value = scrollHeight - scrollTop - clientHeight < 30
}
</script>

<template>
  <div class="card log-viewer">
    <div class="log-header">
      <span class="text-small" style="color: var(--color-text-secondary)">运行日志</span>
      <button class="btn btn-sm btn-white" @click="scrollToBottom; autoScroll = true">滚到底部</button>
    </div>
    <div
      ref="logContainer"
      class="log-content"
      @scroll="onScroll"
    >
      <div v-if="logs.length === 0" class="log-empty text-small">暂无日志</div>
      <div v-for="(line, i) in logs" :key="i" class="log-line text-xs">{{ line }}</div>
    </div>
  </div>
</template>

<style scoped>
.log-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: var(--space-3);
}

.log-content {
  flex: 1;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
}

.log-empty {
  color: var(--color-text-muted);
  text-align: center;
  padding: 40px 0;
}

.log-line {
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

.log-content::-webkit-scrollbar {
  width: 6px;
}

.log-content::-webkit-scrollbar-track {
  background: transparent;
}

.log-content::-webkit-scrollbar-thumb {
  background: var(--bg-muted);
  border-radius: 3px;
}
</style>
