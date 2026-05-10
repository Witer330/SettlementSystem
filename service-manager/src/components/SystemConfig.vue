<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { ElMessage } from 'element-plus'
import { CopyDocument, Edit, Check } from '@element-plus/icons-vue'

const emit = defineEmits<{
  configChanged: []
}>()

interface Config {
  proxy_port: number
  host: string
}

const config = reactive<Config>({ proxy_port: 4000, host: '0.0.0.0' })
const lanIp = ref('127.0.0.1')
const portEditing = ref(false)
const portSaving = ref(false)
const autoStart = ref(false)
const autoStartLoading = ref(false)

const localUrl = computed(() => `http://localhost:${config.proxy_port}`)
const lanUrl = computed(() => `http://${lanIp.value}:${config.proxy_port}`)

onMounted(async () => {
  try {
    const c = await invoke<Config>('get_config')
    config.proxy_port = c.proxy_port
    config.host = c.host
  } catch { /* ignore */ }
  try {
    lanIp.value = await invoke<string>('get_lan_ip')
  } catch { /* ignore */ }
  try {
    autoStart.value = await invoke<boolean>('is_autostart_enabled')
  } catch { /* ignore */ }
})

function copyUrl(url: string) {
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

async function savePort() {
  portSaving.value = true
  try {
    const available = await invoke<boolean>('check_port', { port: config.proxy_port })
    if (!available) {
      ElMessage.warning('端口被占用，请更换')
      return
    }
    await invoke('save_config', { newConfig: { proxy_port: config.proxy_port, host: config.host } })
    ElMessage.success('配置已保存，重启服务后生效')
    portEditing.value = false
    emit('configChanged')
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    portSaving.value = false
  }
}

async function toggleAutoStart(val: boolean) {
  autoStartLoading.value = true
  try {
    if (val) {
      await invoke('enable_autostart')
      ElMessage.success('已启用开机自启动')
    } else {
      await invoke('disable_autostart')
      ElMessage.success('已关闭开机自启动')
    }
  } catch (e: any) {
    autoStart.value = !val // 回滚开关状态
    ElMessage.error(e?.message || '操作失败')
  } finally {
    autoStartLoading.value = false
  }
}
</script>

<template>
  <div class="card config-panel">
    <div class="panel-header">
      <span class="text-h3">系统配置与连接</span>
    </div>

    <!-- 网络连接 -->
    <div class="section">
      <div class="section-title text-xs">网络连接</div>

      <div class="url-row">
        <div class="url-info">
          <span class="text-xs url-label">本地访问</span>
          <span class="text-small text-mono-small url-value">{{ localUrl }}</span>
        </div>
        <button class="btn btn-sm btn-white" @click="copyUrl(localUrl)">
          <el-icon :size="14"><CopyDocument /></el-icon>
        </button>
      </div>

      <div class="url-row">
        <div class="url-info">
          <span class="text-xs url-label">局域网访问</span>
          <span class="text-small text-mono-small url-value">{{ lanUrl }}</span>
        </div>
        <button class="btn btn-sm btn-white" @click="copyUrl(lanUrl)">
          <el-icon :size="14"><CopyDocument /></el-icon>
        </button>
      </div>
    </div>

    <!-- 配置控制 -->
    <div class="section">
      <div class="section-title text-xs">配置控制</div>

      <!-- 开机自启动 -->
      <div class="control-row">
        <span class="text-small control-label">开机自动启动</span>
        <el-switch
          v-model="autoStart"
          size="small"
          :loading="autoStartLoading"
          @change="toggleAutoStart"
        />
      </div>

      <!-- 端口配置 -->
      <div class="control-row port-row">
        <span class="text-small control-label">服务端口</span>
        <div class="port-input-group">
          <el-input-number
            v-model="config.proxy_port"
            :min="1024"
            :max="65535"
            :disabled="!portEditing"
            size="small"
            controls-position="right"
            class="port-input"
          />
          <button
            v-if="!portEditing"
            class="btn btn-sm btn-white"
            @click="portEditing = true"
          >
            <el-icon :size="14"><Edit /></el-icon>
          </button>
          <button
            v-else
            class="btn btn-sm btn-primary"
            :disabled="portSaving"
            @click="savePort"
          >
            <el-icon :size="14"><Check /></el-icon>
            保存并应用
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-color-light);
}

.section {
  margin-top: var(--space-4);
}

.section-title {
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-3);
}

.url-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-canvas);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
}

.url-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.url-label {
  color: var(--color-text-muted);
}

.url-value {
  color: var(--color-text-primary);
}

.control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
}

.control-label {
  color: var(--color-text-secondary);
}

.port-row {
  flex-wrap: wrap;
  gap: var(--space-2);
}

.port-input-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.port-input {
  width: 120px;
}

/* Element Plus 深色主题覆盖 */
:deep(.el-input-number.is-disabled .el-input__wrapper) {
  background-color: var(--bg-canvas);
  box-shadow: 0 0 0 1px var(--border-color) inset;
}

:deep(.el-input-number.is-disabled .el-input__inner) {
  color: var(--color-text-muted);
}

:deep(.el-input-number.is-disabled .el-input-number__decrease),
:deep(.el-input-number.is-disabled .el-input-number__increase) {
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
}

:deep(.el-switch.is-checked .el-switch__core) {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

:deep(.el-input__wrapper) {
  background-color: var(--bg-canvas);
  box-shadow: 0 0 0 1px var(--border-color) inset;
}

:deep(.el-input__inner) {
  color: var(--color-text-primary);
}

:deep(.el-input-number__decrease),
:deep(.el-input-number__increase) {
  background-color: var(--bg-elevated);
  border-color: var(--border-color);
  color: var(--color-text-secondary);
}
</style>
