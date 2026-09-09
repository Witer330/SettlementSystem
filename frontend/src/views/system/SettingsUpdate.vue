<template>
  <!-- 系统更新 -->
  <el-card class="setting-card" shadow="never">
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:600">系统更新</span>
        <el-button :loading="checkingUpdate" @click="handleCheckUpdate">
          {{ updateInfo ? '重新检查' : '检查更新' }}
        </el-button>
      </div>
    </template>

    <!-- 未检查 -->
    <div v-if="!updateInfo && !checkingUpdate" class="update-empty">
      点击"检查更新"查看是否有新版本
    </div>

    <!-- 检查中 -->
    <div v-if="checkingUpdate" class="update-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在检查更新...</span>
    </div>

    <!-- 有更新 -->
    <div v-if="updateInfo">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="当前版本">{{ updateInfo.currentVersion }}</el-descriptions-item>
        <el-descriptions-item label="最新版本">
          <span v-if="updateInfo.hasUpdate" style="color:var(--el-color-primary);font-weight:600">{{ updateInfo.remoteVersion!.version }}</span>
          <span v-else>已是最新版本</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="updateInfo.hasUpdate && updateInfo.remoteVersion" label="更新内容">
          {{ updateInfo.remoteVersion.releaseNotes || '无' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="updateInfo.hasUpdate && updateInfo.remoteVersion" label="更新包大小">
          {{ formatSize(updateInfo.remoteVersion.size) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="updateInfo.hasUpdate && updateInfo.remoteVersion" label="包含依赖更新">
          {{ updateInfo.remoteVersion.hasDeps ? '是' : '否' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="updateInfo.hasUpdate && updateInfo.remoteVersion" label="包含数据库迁移">
          {{ updateInfo.remoteVersion.dbMigration ? '是（自动备份）' : '否' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 下载/应用进度 -->
      <div v-if="flowActive" style="margin-top:16px">
        <el-progress
          :percentage="flowProgress"
          :status="flowError ? 'exception' : undefined"
          :stroke-width="18"
          :text-inside="true"
          :color="flowStatus === 'done' ? '#67c23a' : '#409eff'"
        />
        <p style="margin-top:8px;color:var(--el-text-color-secondary);font-size:13px">
          <el-icon class="is-loading" v-if="flowStatus !== 'done' && flowStatus !== 'failed'"><Loading /></el-icon>
          {{ flowStatusLabel }}
        </p>
        <p v-if="flowError" style="color:var(--el-color-danger);font-size:13px;margin-top:4px">
          {{ flowError }}
        </p>
      </div>

      <!-- 操作按钮 -->
      <div v-if="updateInfo.hasUpdate && !flowActive" style="margin-top:16px">
        <el-button v-if="isTauri" type="primary" @click="handleUpdate">
          立即更新
        </el-button>
        <el-button v-else type="primary" @click="handleUpdate">
          立即更新
        </el-button>
        <p v-if="!isTauri" style="margin-top:8px;font-size:12px;color:var(--el-text-color-placeholder)">
          提示：下载和应用更新功能仅在桌面管理面板中可用。请点击系统托盘图标打开管理面板。
        </p>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { updateApi, isTauriEnv, type UpdateCheckResult, type DownloadState } from '@/api/update'

const checkingUpdate = ref(false)
const updateInfo = ref<UpdateCheckResult | null>(null)

// 流程状态
const isTauri = ref(false)

type FlowPhase = 'download' | 'verify' | 'extract' | 'apply' | 'restart' | 'done' | 'failed'
const flowPhase = ref<FlowPhase>('download')
const flowProgress = ref(0)
const flowError = ref('')
const flowActive = ref(false)

const flowStatusLabel = computed(() => {
  const map: Record<FlowPhase, string> = {
    download: '正在下载更新包...',
    verify: '正在校验更新包...',
    extract: '正在解压...',
    apply: '正在应用更新...',
    restart: '服务正在重启，请稍候...',
    done: '更新完成，即将刷新页面...',
    failed: '更新失败'
  }
  return map[flowPhase.value] || ''
})

const flowStatus = computed(() => flowPhase.value)

// 下载阶段进度区间映射
let downloadPollTimer: ReturnType<typeof setInterval> | null = null
let healthCheckTimer: ReturnType<typeof setInterval> | null = null
let tauriUnlisten: (() => void) | null = null

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

onMounted(() => {
  isTauri.value = isTauriEnv()
  // 监听 Tauri update-progress 事件
  const tauri = (window as any).__TAURI_INTERNALS__
  if (tauri?.eventListeners) {
    // Tauri v2 event API
    const unlisten = tauri.eventListeners['update-progress']
    if (typeof unlisten === 'function') {
      tauriUnlisten = unlisten
    }
  }
  // Try the tauri v2 listen API
  if ((window as any).__TAURI__?.event?.listen) {
    const p = (window as any).__TAURI__.event.listen('update-progress', (event: any) => {
      const payload = event.payload
      if (payload) {
        flowProgress.value = payload.percent
        if (payload.step) {
          if (payload.step.includes('下载中')) flowPhase.value = 'download'
          else if (payload.step.includes('校验')) flowPhase.value = 'verify'
          else if (payload.step.includes('解压')) flowPhase.value = 'extract'
          else if (payload.step.includes('下载完成')) flowPhase.value = 'apply'
        }
        if (payload.error) {
          flowError.value = payload.error
          flowPhase.value = 'failed'
          stopAllTimers()
        }
      }
    })
    p.then((fn: any) => { tauriUnlisten = fn })
  }
})

onUnmounted(() => {
  stopAllTimers()
  if (tauriUnlisten) tauriUnlisten()
})

function stopAllTimers() {
  if (downloadPollTimer) { clearInterval(downloadPollTimer); downloadPollTimer = null }
  if (healthCheckTimer) { clearInterval(healthCheckTimer); healthCheckTimer = null }
}

const handleCheckUpdate = async () => {
  checkingUpdate.value = true
  try {
    updateInfo.value = await updateApi.check()
  } catch (e: any) {
    ElMessage.error(e.message || '检查更新失败')
  } finally {
    checkingUpdate.value = false
  }
}

const handleUpdate = async () => {
  if (!isTauri.value) {
    ElMessage.info('请通过系统托盘图标打开桌面管理面板，在管理面板中执行更新')
    return
  }

  try {
    await ElMessageBox.confirm(
      '更新期间系统将停止服务，请确保所有数据已保存。是否继续？',
      '确认更新',
      { confirmButtonText: '立即更新', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  flowActive.value = true
  flowProgress.value = 0
  flowError.value = ''
  flowPhase.value = 'download'

  try {
    // 下载（Rust 端异步执行，通过 update-progress 事件推送进度）
    updateApi.download() // 不 await，它立即返回

    // 轮询下载状态
    downloadPollTimer = setInterval(async () => {
      try {
        const state: DownloadState = await updateApi.getDownloadState()

        // 如果没收到事件，用轮询数据补进度
        if (flowPhase.value === 'download') {
          flowProgress.value = state.progress
          if (state.status === 'verifying') flowPhase.value = 'verify'
          else if (state.status === 'extracting') flowPhase.value = 'extract'
        }

        if (state.status === 'failed') {
          flowError.value = state.error || '下载失败'
          flowPhase.value = 'failed'
          stopAllTimers()
          return
        }

        if (state.status === 'ready') {
          stopAllTimers()
          flowProgress.value = 90
          flowPhase.value = 'apply'
          await applyAndRestart(state.updateDir!)
        }
      } catch { /* 继续轮询 */ }
    }, 500)
  } catch (e: any) {
    flowError.value = e.message || '更新失败'
    flowPhase.value = 'failed'
  }
}

// 应用更新 → 轮询 /health 检测服务恢复
const applyAndRestart = async (updateDir: string) => {
  try {
    flowPhase.value = 'apply'
    flowProgress.value = 91

    // 调用 apply（异步，会停服→替换→重启）
    updateApi.apply(updateDir).then((result) => {
      if (result === 'manager_update_needed') {
        // 管理器也会更新，Tauri 进程退出，直接刷新即可
        flowPhase.value = 'done'
        flowProgress.value = 100
        setTimeout(() => window.location.reload(), 3000)
      }
    }).catch((e: any) => {
      flowError.value = e.message || '应用更新失败'
      flowPhase.value = 'failed'
    })

    // 轮询 /health 检测服务恢复
    healthCheckTimer = setInterval(async () => {
      try {
        const resp = await fetch('/health', { signal: AbortSignal.timeout(3000) })
        if (resp.ok) {
          stopAllTimers()
          flowProgress.value = 100
          flowPhase.value = 'done'
          setTimeout(() => window.location.reload(), 1500)
        }
      } catch {
        // 服务不可达，说明正在重启中
        flowPhase.value = 'restart'
        if (flowProgress.value < 98) flowProgress.value += 1
      }
    }, 2000)
  } catch (e: any) {
    flowError.value = e.message || '应用更新失败'
    flowPhase.value = 'failed'
  }
}
</script>

<style scoped>
.setting-card {
  margin-bottom: 0;
}
.update-empty {
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 24px 0;
}
.update-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
  color: var(--el-text-color-secondary);
}
</style>
