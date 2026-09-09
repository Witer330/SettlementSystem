// ── 类型 ──

export interface RemoteVersionInfo {
  version: string
  minVersion: string
  releaseNotes: string
  packageUrl: string
  packageHash: string
  size: number
  depsUrl: string | null
  depsHash: string | null
  depsSize: number
  depsFingerprint: string
  hasDeps: boolean
  dbMigration: boolean
  forceUpdate: boolean
  hasManagerUpdate: boolean
}

export interface UpdateCheckResult {
  currentVersion: string
  hasUpdate: boolean
  remoteVersion: RemoteVersionInfo | null
}

export interface DownloadState {
  status: 'idle' | 'downloading' | 'verifying' | 'extracting' | 'ready' | 'failed'
  progress: number
  error: string
  remoteVersion: RemoteVersionInfo | null
  updateDir?: string
}

// ── Tauri invoke 封装 ──

function getTauri() {
  const internals = (window as any).__TAURI_INTERNALS__
  return internals?.invoke ? internals : null
}

export function isTauriEnv(): boolean {
  return getTauri() !== null
}

/** 系统更新仅在桌面管理面板（Tauri）中可用，浏览器客户端不提供更新功能 */
function requireTauri(): any {
  const tauri = getTauri()
  if (!tauri) {
    throw new Error('系统更新请在服务器上的桌面管理面板中执行（右键系统托盘图标）')
  }
  return tauri
}

// ── 更新 API（全部经 Tauri invoke 直连 OSS）──

export const updateApi = {
  /** 检查更新（Tauri 直连 OSS） */
  async check(): Promise<UpdateCheckResult> {
    return await requireTauri().invoke('check_oss_update')
  },

  /** 下载更新包（通过事件 update-progress 推送进度） */
  async download(): Promise<void> {
    await requireTauri().invoke('download_oss_update')
  },

  /** 获取下载进度 */
  async getDownloadState(): Promise<DownloadState> {
    return await requireTauri().invoke('get_oss_update_state')
  },

  /** 应用更新 */
  async apply(updateDir: string): Promise<string> {
    return await requireTauri().invoke('apply_oss_update', { updateDir })
  }
}
