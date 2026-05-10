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

async function invoke(cmd: string) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd)
}

async function loadLogs() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const content = await invoke<string>('read_logs')
    if (content) {
      const lines = content.split('\n').filter(l => l.trim())
      // 只保留最近 100 行
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
  <div class="log-viewer">
    <div class="log-header">
      <span class="log-title">运行日志</span>
      <button class="log-btn" @click="scrollToBottom; autoScroll = true">滚到底部</button>
    </div>
    <div
      ref="logContainer"
      class="log-content"
      @scroll="onScroll"
    >
      <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
      <div v-for="(line, i) in logs" :key="i" class="log-line">{{ line }}</div>
    </div>
  </div>
</template>

<style scoped>
.log-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0f0f23;
  border-radius: 12px;
  overflow: hidden;
  min-height: 0;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #16213e;
}

.log-title {
  font-size: 13px;
  font-weight: 500;
  color: #aaa;
}

.log-btn {
  background: none;
  border: 1px solid #333;
  color: #888;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.log-btn:hover {
  color: #ccc;
  border-color: #555;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 16px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.log-empty {
  color: #555;
  text-align: center;
  padding: 40px 0;
}

.log-line {
  color: #a0a0a0;
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
  background: #333;
  border-radius: 3px;
}
</style>
