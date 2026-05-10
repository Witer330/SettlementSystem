<template>
  <div class="card settings-panel">
    <div class="settings-header">
      <span class="text-h3">设置</span>
      <button class="btn btn-icon btn-white" @click="$emit('close')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M4.3 3.3a.7.7 0 0 1 .98 0l2.12 2.12 2.12-2.12a.7.7 0 1 1 .98.98L8.38 6.27l2.12 2.12a.7.7 0 0 1-.98.98L7.4 7.25l-2.12 2.12a.7.7 0 0 1-.98-.98l2.12-2.12-2.12-2.12a.7.7 0 0 1 0-.98z"/>
        </svg>
      </button>
    </div>

    <div class="settings-body">
      <!-- 端口冲突警告 -->
      <div v-if="portConflict" class="warning-box">
        <div class="warning-icon">!</div>
        <div class="warning-text">
          <strong style="color: var(--color-warning)">端口 {{ portConflict }} 被占用</strong>
          <p>请修改代理端口后重启服务</p>
        </div>
      </div>

      <!-- 代理端口 -->
      <div class="field">
        <label class="text-xs field-label">代理端口</label>
        <div class="field-row">
          <input
            v-model.number="form.proxy_port"
            type="number"
            min="1024"
            max="65535"
            class="input"
            @input="onPortChange"
          />
          <span v-if="portStatus === 'available'" class="tag tag-success">可用</span>
          <span v-else-if="portStatus === 'occupied'" class="tag tag-danger">被占用</span>
          <span v-else class="tag tag-muted">检测中...</span>
        </div>
        <p class="text-xs hint">用户访问地址：http://localhost:{{ form.proxy_port }}</p>
      </div>

      <!-- 绑定地址 -->
      <div class="field">
        <label class="text-xs field-label">绑定地址</label>
        <select v-model="form.host" class="select">
          <option value="0.0.0.0">0.0.0.0（允许局域网访问）</option>
          <option value="127.0.0.1">127.0.0.1（仅本机）</option>
        </select>
        <p class="text-xs hint">选择 0.0.0.0 后，局域网内其他设备可通过主机 IP 访问</p>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <button class="btn btn-primary save-btn" @click="onSave" :disabled="portStatus === 'occupied'">
          保存配置
        </button>
        <p v-if="saved" class="text-xs save-hint">配置已保存，重启服务后生效</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'restart'): void
}>()

const props = defineProps<{
  portConflict?: number
}>()

interface Config {
  proxy_port: number
  host: string
}

const form = reactive<Config>({
  proxy_port: 4000,
  host: '0.0.0.0'
})

const portStatus = ref<'available' | 'occupied' | 'checking'>('checking')
const saved = ref(false)
let checkTimer: ReturnType<typeof setTimeout> | null = null

async function loadConfig() {
  try {
    const config = await invoke<Config>('get_config')
    form.proxy_port = config.proxy_port
    form.host = config.host
    await checkPort()
  } catch (e) {
    console.error('加载配置失败:', e)
  }
}

async function checkPort() {
  portStatus.value = 'checking'
  try {
    const available = await invoke<boolean>('check_port', { port: form.proxy_port })
    portStatus.value = available ? 'available' : 'occupied'
  } catch {
    portStatus.value = 'checking'
  }
}

function onPortChange() {
  saved.value = false
  if (checkTimer) clearTimeout(checkTimer)
  checkTimer = setTimeout(checkPort, 300)
}

async function onSave() {
  try {
    await invoke('save_config', {
      newConfig: {
        proxy_port: form.proxy_port,
        host: form.host
      }
    })
    saved.value = true
  } catch (e) {
    console.error('保存配置失败:', e)
  }
}

onMounted(loadConfig)
onUnmounted(() => {
  if (checkTimer) clearTimeout(checkTimer)
})
</script>

<style scoped>
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-color-light);
}

.warning-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  margin-top: var(--space-4);
}

.warning-icon {
  width: 24px;
  height: 24px;
  background: var(--color-warning);
  color: #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
}

.warning-text p {
  margin: 2px 0 0;
  color: var(--color-text-secondary);
}

.field {
  margin-top: var(--space-4);
}

.field-label {
  display: block;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.field-row .input {
  flex: 1;
}

.hint {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
}

.actions {
  margin-top: var(--space-5);
}

.save-btn {
  width: 100%;
}

.save-hint {
  margin: var(--space-2) 0 0;
  color: var(--color-success);
  text-align: center;
}
</style>
