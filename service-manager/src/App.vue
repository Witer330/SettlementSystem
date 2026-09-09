<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import ServiceCard from './components/ServiceCard.vue'
import SystemConfig from './components/SystemConfig.vue'
import SettingsPanel from './components/SettingsPanel.vue'

// ── 状态 ──

interface BackendState {
  status: 'stopped' | 'running' | 'unhealthy' | 'starting'
  pid: number | null
  port: number
  uptime: number
  memory: number
  cpu: number
}
interface ProxyState {
  status: 'stopped' | 'running' | 'starting'
  pid: number | null
  port: number
  uptime: number
}
interface DbState {
  status: 'disconnected' | 'connected' | 'checking'
  configured: boolean
  connected: boolean
  path: string
}

const backend = reactive<BackendState>({ status: 'stopped', pid: null, port: 0, uptime: 0, memory: 0, cpu: 0 })
const proxy = reactive<ProxyState>({ status: 'stopped', pid: null, port: 0, uptime: 0 })
const database = reactive<DbState>({ status: 'disconnected', configured: false, connected: false, path: '' })

const showSettings = ref(false)
const loading = ref(false)
const portConflict = ref<number>()

let statusTimer: ReturnType<typeof setInterval>

// ── 计算 ──

const allRunning = computed(() => backend.status === 'running' && proxy.status === 'running')
const allStopped = computed(() => backend.status === 'stopped' && proxy.status === 'stopped')

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}时${m}分`
}

// ── 卡片数据 ──

const backendInfo = computed(() => {
  const items: Array<{ label: string; value: string; mono?: boolean }> = []
  if (backend.port) items.push({ label: '端口', value: String(backend.port), mono: true })
  if (backend.pid) items.push({ label: 'PID', value: String(backend.pid), mono: true })
  if (backend.status === 'running' && backend.uptime > 0) items.push({ label: '运行时间', value: formatUptime(backend.uptime) })
  if (backend.status === 'running') {
    items.push({ label: '内存', value: `${backend.memory} MB`, mono: true })
    items.push({ label: 'CPU', value: `${backend.cpu.toFixed(1)}%`, mono: true })
  }
  return items
})

const backendActions = computed(() => {
  if (backend.status === 'running' || backend.status === 'unhealthy') {
    return [
      { id: 'restart-backend', label: '重启', type: 'restart' as const, disabled: loading.value },
      { id: 'stop-backend', label: '停止', type: 'stop' as const, disabled: loading.value },
    ]
  }
  return [{ id: 'start-backend', label: '启动', type: 'start' as const, disabled: loading.value }]
})

const proxyInfo = computed(() => {
  const items: Array<{ label: string; value: string; mono?: boolean }> = []
  if (proxy.port) items.push({ label: '端口', value: String(proxy.port), mono: true })
  if (proxy.pid) items.push({ label: 'PID', value: String(proxy.pid), mono: true })
  if (proxy.status === 'running' && proxy.uptime > 0) items.push({ label: '运行时间', value: formatUptime(proxy.uptime) })
  return items
})

const proxyActions = computed(() => {
  const backendDown = backend.status !== 'running'
  if (proxy.status === 'running') {
    return [
      { id: 'restart-proxy', label: '重启', type: 'restart' as const, disabled: loading.value },
      { id: 'stop-proxy', label: '停止', type: 'stop' as const, disabled: loading.value },
    ]
  }
  return [{ id: 'start-proxy', label: '启动', type: 'start' as const, disabled: loading.value || backendDown }]
})

const dbInfo = computed(() => {
  const items: Array<{ label: string; value: string; mono?: boolean }> = []
  if (database.configured) {
    items.push({ label: '路径', value: database.path, mono: true })
  }
  return items
})

// SQLite 无需操作按钮
const dbActions = computed(() => [] as Array<{ id: string; label: string; type: 'start'; disabled: boolean }>)

// ── 刷新状态 ──

async function refreshStatus() {
  try {
    const s = await invoke<{
      backend: { running: boolean; pid: number | null; port: number; unhealthy: boolean; memory_mb: number; cpu_percent: number; uptime: number }
      proxy: { running: boolean; pid: number | null; port: number; uptime: number }
      database: { configured: boolean; connected: boolean; path: string }
    }>('get_all_services_status')

    // 后端
    if (s.backend.running) {
      backend.status = s.backend.unhealthy ? 'unhealthy' : 'running'
    } else {
      backend.status = 'stopped'
    }
    backend.pid = s.backend.pid
    backend.port = s.backend.port
    backend.uptime = s.backend.uptime
    backend.memory = Math.round(s.backend.memory_mb)
    backend.cpu = s.backend.cpu_percent

    // 代理
    proxy.status = s.proxy.running ? 'running' : 'stopped'
    proxy.pid = s.proxy.pid
    proxy.port = s.proxy.port
    proxy.uptime = s.proxy.uptime

    // 数据库
    database.configured = s.database.configured
    database.connected = s.database.connected
    database.path = s.database.path
    database.status = s.database.connected ? 'connected' : 'disconnected'
  } catch {
    // 忽略
  }
}

// ── 操作 ──

async function doAction(action: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>) {
  loading.value = true
  try {
    await action
    setTimeout(refreshStatus, 1000)
  } catch (e) {
    console.error('操作失败:', e)
  } finally {
    loading.value = false
  }
}

async function handleAction(id: string) {
  loading.value = true
  try {
    switch (id) {
      case 'start-backend': await invoke('start_backend'); break
      case 'stop-backend': await invoke('stop_backend'); break
      case 'start-proxy': await invoke('start_proxy'); break
      case 'stop-proxy': await invoke('stop_proxy'); break
      case 'restart-backend': await invoke('restart_backend'); break
      case 'restart-proxy': await invoke('restart_proxy'); break
    }
    setTimeout(refreshStatus, 1000)
  } catch (e) {
    console.error('操作失败:', e)
  } finally {
    loading.value = false
  }
}

async function startAll() {
  loading.value = true
  try { await invoke('start_all') } catch (e) { console.error('启动失败:', e) }
  finally { loading.value = false }
  setTimeout(refreshStatus, 1500)
}

async function stopAll() {
  loading.value = true
  try { await invoke('stop_all') } catch (e) { console.error('停止失败:', e) }
  finally { loading.value = false }
  setTimeout(refreshStatus, 1000)
}

async function openBrowser() {
  await invoke('open_browser')
}

// ── 更新进度 ──

interface UpdateProgressEvent {
  step: string
  percent: number
  error: string | null
}

const updating = ref(false)
const updateStep = ref('')
const updatePercent = ref(0)

// 更新检查与触发
interface UpdateCheckData {
  current_version: string
  has_update: boolean
  remote_version: {
    version: string
    release_notes?: string
    size: number
    has_deps: boolean
    db_migration: boolean
    has_manager_update: boolean
  } | null
}
const updateCheckResult = ref<UpdateCheckData | null>(null)
const checkingUpdate = ref(false)
const updateError = ref('')
let downloadPollTimer: ReturnType<typeof setInterval> | null = null

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function handleCheckUpdate() {
  checkingUpdate.value = true
  updateError.value = ''
  updateCheckResult.value = null
  try {
    const result = await invoke<UpdateCheckData>('check_oss_update')
    updateCheckResult.value = result
  } catch (e: any) {
    updateError.value = typeof e === 'string' ? e : (e.message || '检查更新失败')
  } finally {
    checkingUpdate.value = false
  }
}

async function handleStartUpdate() {
  if (!updateCheckResult.value?.has_update) return
  updateError.value = ''

  try {
    // 触发下载（异步，立即返回）
    invoke('download_oss_update')
    updating.value = true
    updateStep.value = '正在下载...'
    updatePercent.value = 0

    // 轮询下载状态
    downloadPollTimer = setInterval(async () => {
      try {
        const state = await invoke<{
          status: string
          progress: number
          error: string
          update_dir?: string
        }>('get_oss_update_state')

        updatePercent.value = state.progress

        switch (state.status) {
          case 'downloading':
            updateStep.value = '正在下载更新包...'
            break
          case 'verifying':
            updateStep.value = '正在校验更新包...'
            break
          case 'extracting':
            updateStep.value = '正在解压...'
            break
          case 'ready':
            if (downloadPollTimer) { clearInterval(downloadPollTimer); downloadPollTimer = null }
            updateStep.value = '正在应用更新...'
            updatePercent.value = 95
            // 应用更新
            try {
              await invoke('apply_oss_update', { updateDir: state.update_dir })
              updateStep.value = '更新完成，正在重启...'
              updatePercent.value = 100
              setTimeout(() => {
                updating.value = false
                updateStep.value = ''
                updatePercent.value = 0
                updateCheckResult.value = null
                refreshStatus()
              }, 2000)
            } catch (e: any) {
              updateError.value = typeof e === 'string' ? e : (e.message || '应用更新失败')
              updating.value = false
            }
            break
          case 'failed':
            if (downloadPollTimer) { clearInterval(downloadPollTimer); downloadPollTimer = null }
            updateError.value = state.error || '下载失败'
            updating.value = false
            break
        }
      } catch {
        // 继续轮询
      }
    }, 500)
  } catch (e: any) {
    updateError.value = typeof e === 'string' ? e : (e.message || '启动更新失败')
  }
}

function clearUpdateCheck() {
  updateCheckResult.value = null
  updateError.value = ''
}

// ── 生命周期 ──

onMounted(async () => {
  await refreshStatus()
  statusTimer = setInterval(refreshStatus, 3000)

  await listen<number>('port-conflict', (event) => {
    portConflict.value = event.payload
    showSettings.value = true
  })

  await listen('auto-start-trigger', async () => {
    if (allStopped.value) {
      try { await invoke('start_all') } catch { /* ignore */ }
      setTimeout(refreshStatus, 2000)
    }
  })

  // 监听更新进度
  await listen<UpdateProgressEvent>('update-progress', (event) => {
    updating.value = true
    updateStep.value = event.payload.step
    updatePercent.value = event.payload.percent
    if (event.payload.percent >= 100) {
      setTimeout(() => {
        updating.value = false
        updateStep.value = ''
        updatePercent.value = 0
        refreshStatus()
      }, 2000)
    }
  })
})

onUnmounted(() => {
  clearInterval(statusTimer)
})

function onSettingsClose() {
  showSettings.value = false
  portConflict.value = undefined
}

async function onRestart() {
  showSettings.value = false
  portConflict.value = undefined
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
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 0-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z"/>
        </svg>
      </button>
    </header>

    <SettingsPanel v-if="showSettings" :port-conflict="portConflict" @close="onSettingsClose" @restart="onRestart" />

    <template v-else>
      <!-- 更新进度卡片（更新时显示） -->
      <div v-if="updating" class="card update-progress-card">
        <div class="update-progress-header">
          <span class="text-h3">正在更新</span>
          <span class="text-mono-small" style="color: var(--color-text-muted)">{{ updatePercent }}%</span>
        </div>
        <div class="update-progress-bar">
          <div class="update-progress-fill" :style="{ width: updatePercent + '%' }"></div>
        </div>
        <p class="text-small" style="color: var(--color-text-secondary); text-align: center; margin-top: 8px">
          {{ updateStep }}
        </p>
        <p class="text-xs" style="color: var(--color-text-muted); text-align: center; margin-top: 4px">
          请勿关闭窗口
        </p>
      </div>

      <!-- 正常界面（非更新时显示） -->
      <template v-if="!updating">
      <!-- 快捷操作栏 -->
      <div class="quick-actions card">
        <button class="btn btn-start" :disabled="allRunning || loading" @click="startAll">一键启动</button>
        <button class="btn btn-stop" :disabled="allStopped || loading" @click="stopAll">一键停止</button>
        <button class="btn btn-white" :disabled="proxy.status !== 'running'" @click="openBrowser">打开浏览器</button>
      </div>

      <!-- 服务卡片 -->
      <div class="service-cards">
        <ServiceCard
          title="后端服务"
          subtitle="Node.js"
          :status="backend.status"
          :info-items="backendInfo"
          :actions="backendActions"
          @action="handleAction"
        />
        <ServiceCard
          title="代理服务"
          subtitle="Reverse Proxy"
          :status="proxy.status"
          :info-items="proxyInfo"
          :actions="proxyActions"
          @action="handleAction"
        />
      </div>

      <ServiceCard
        title="数据库"
        subtitle="SQLite"
        :status="database.status"
        :info-items="dbInfo"
        :actions="dbActions"
        @action="handleAction"
      />

      <!-- 系统更新 -->
      <div class="card update-card">
        <div class="update-card-header">
          <span class="text-body" style="font-weight: var(--font-weight-600)">系统更新</span>
          <span v-if="updateCheckResult" class="text-mono-small" style="color: var(--color-text-muted)">
            当前 {{ updateCheckResult.current_version }}
          </span>
        </div>

        <!-- 未检查 / 检查中 -->
        <div v-if="!updateCheckResult && !checkingUpdate" class="update-card-body">
          <p class="text-small" style="color: var(--color-text-secondary); margin: 0">点击检查是否有新版本</p>
          <button class="btn btn-white" style="margin-top: 8px" @click="handleCheckUpdate" :disabled="updating">
            检查更新
          </button>
        </div>
        <div v-if="checkingUpdate" class="update-card-body">
          <p class="text-small" style="color: var(--color-text-muted); margin: 0">正在检查更新...</p>
        </div>

        <!-- 有结果 -->
        <div v-if="updateCheckResult" class="update-card-body">
          <template v-if="updateCheckResult.has_update">
            <div class="update-info">
              <span class="text-small" style="color: var(--color-text-secondary)">最新版本</span>
              <span class="text-body" style="font-weight: var(--font-weight-600); color: var(--color-primary)">
                {{ updateCheckResult.remote_version!.version }}
              </span>
            </div>
            <div class="update-info" v-if="updateCheckResult.remote_version!.release_notes">
              <span class="text-small" style="color: var(--color-text-secondary)">更新内容</span>
              <span class="text-small">{{ updateCheckResult.remote_version!.release_notes }}</span>
            </div>
            <div class="update-info">
              <span class="text-small" style="color: var(--color-text-secondary)">大小</span>
              <span class="text-mono-small">{{ formatSize(updateCheckResult.remote_version!.size) }}</span>
            </div>
            <div class="update-info">
              <span class="text-small" style="color: var(--color-text-secondary)">包含依赖更新</span>
              <span class="text-mono-small">{{ updateCheckResult.remote_version!.has_deps ? '是' : '否' }}</span>
            </div>
            <div class="update-actions">
              <button class="btn btn-primary" style="flex:1" @click="handleStartUpdate" :disabled="updating">
                立即更新
              </button>
              <button class="btn btn-white" @click="handleCheckUpdate" :disabled="updating || checkingUpdate">
                重新检查
              </button>
            </div>
          </template>
          <template v-else>
            <p class="text-small" style="color: var(--color-success); margin: 0">已是最新版本</p>
            <button class="btn btn-white" style="margin-top: 8px" @click="handleCheckUpdate" :disabled="updating">
              重新检查
            </button>
          </template>
        </div>

        <p v-if="updateError" class="text-xs" style="color: var(--color-danger); margin: 8px 0 0">{{ updateError }}</p>
      </div>

      <SystemConfig @config-changed="onRestart" />
      </template>
    </template>
  </div>
</template>

<style>
.manager {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.header h1 {
  color: var(--color-text-primary);
}

.quick-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.quick-actions .btn {
  flex: 1;
  padding: 8px 16px;
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

.service-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Update Card */
.update-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.update-card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.update-card-body {
  display: flex;
  flex-direction: column;
}

.update-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
}

.update-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

/* Update Progress */
.update-progress-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
}

.update-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.update-progress-bar {
  height: 8px;
  background: var(--bg-canvas);
  border-radius: 4px;
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}
</style>
