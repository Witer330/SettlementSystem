/// SQLite 数据库备份服务
/// 备份 = 复制 db 文件，清理 = 按天数删除过期备份

import fs from 'fs'
import path from 'path'
import { configService } from './config.service'

const DB_PATH = path.resolve('prisma/data/settlement.db')
const BACKUP_DIR = path.resolve('prisma/data/backup')
const BACKUP_PREFIX = 'settlement_'

// ── 备份文件信息 ──

export interface BackupInfo {
  filename: string
  size: number       // 字节
  createdAt: string   // ISO 时间
}

// ── 核心操作 ──

/** 确保备份目录存在 */
function ensureBackupDir(): string {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
  return BACKUP_DIR
}

/** 列出所有备份 */
export function listBackups(): BackupInfo[] {
  ensureBackupDir()
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith('.db'))
    .sort()
    .reverse() // 最新的在前

  return files.map(filename => {
    const filePath = path.join(BACKUP_DIR, filename)
    const stat = fs.statSync(filePath)
    // 从文件名解析时间：settlement_20260616_143000.db
    const timeStr = filename
      .replace(BACKUP_PREFIX, '')
      .replace('.db', '')
      .replace(/_(\d{6})$/, '_$1') // 保持格式
    const createdAt = parseBackupTime(timeStr)
    return {
      filename,
      size: stat.size,
      createdAt,
    }
  })
}

/** 创建备份 */
export function createBackup(): BackupInfo {
  ensureBackupDir()

  if (!fs.existsSync(DB_PATH)) {
    throw new Error('数据库文件不存在，无法备份')
  }

  const now = new Date()
  const ts = formatBackupTime(now)
  const filename = `${BACKUP_PREFIX}${ts}.db`
  const destPath = path.join(BACKUP_DIR, filename)

  // SQLite 安全备份：使用 copyFile（SQLite WAL 模式下读不影响一致性）
  fs.copyFileSync(DB_PATH, destPath)

  const stat = fs.statSync(destPath)
  return {
    filename,
    size: stat.size,
    createdAt: now.toISOString(),
  }
}

/** 恢复备份 */
export function restoreBackup(filename: string): void {
  // 安全检查：防止路径遍历
  const safeName = path.basename(filename)
  if (safeName !== filename) {
    throw new Error('文件名不合法')
  }

  const srcPath = path.join(BACKUP_DIR, filename)
  if (!fs.existsSync(srcPath)) {
    throw new Error('备份文件不存在')
  }

  // 覆盖当前数据库
  fs.copyFileSync(srcPath, DB_PATH)
}

/** 删除备份 */
export function deleteBackup(filename: string): void {
  const safeName = path.basename(filename)
  if (safeName !== filename) {
    throw new Error('文件名不合法')
  }

  const filePath = path.join(BACKUP_DIR, filename)
  if (!fs.existsSync(filePath)) {
    throw new Error('备份文件不存在')
  }

  fs.unlinkSync(filePath)
}

/** 清理过期备份（按天数保留） */
export function cleanupBackups(retainDays: number): number {
  if (retainDays <= 0) return 0

  const backups = listBackups()
  const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1000
  let deleted = 0

  for (const backup of backups) {
    const backupTime = new Date(backup.createdAt).getTime()
    if (backupTime < cutoff) {
      try {
        deleteBackup(backup.filename)
        deleted++
      } catch {
        // 忽略删除失败的文件
      }
    }
  }

  return deleted
}

// ── 自动备份定时任务 ──

let scheduleTimer: NodeJS.Timeout | null = null
let lastBackupDate: string | null = null

/** 启动自动备份定时任务 */
export function startSchedule(): void {
  // 每小时检查一次是否需要备份
  scheduleTimer = setInterval(() => {
    tryAutoBackup()
  }, 60 * 60 * 1000)

  // 启动时也检查一次
  tryAutoBackup()
}

/** 停止定时任务 */
export function stopSchedule(): void {
  if (scheduleTimer) {
    clearInterval(scheduleTimer)
    scheduleTimer = null
  }
}

function tryAutoBackup(): void {
  const intervalDays = configService.getOrDefault<number>('system.backupInterval', 7)
  const retainDays = configService.getOrDefault<number>('system.backupRetainDays', 30)

  const today = new Date().toISOString().slice(0, 10)
  if (lastBackupDate === today) return

  // 检查最近的备份是否在间隔期内
  const backups = listBackups()
  if (backups.length > 0) {
    const latest = new Date(backups[0].createdAt)
    const daysSinceLast = (Date.now() - latest.getTime()) / (24 * 60 * 60 * 1000)
    if (daysSinceLast < intervalDays) return
  }

  try {
    createBackup()
    lastBackupDate = today
    console.log(`[backup] 自动备份完成，保留策略: ${retainDays} 天`)

    // 执行清理
    cleanupBackups(retainDays)
  } catch (e) {
    console.error('[backup] 自动备份失败:', e)
  }
}

// ── 工具函数 ──

function formatBackupTime(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}_${h}${min}${s}`
}

function parseBackupTime(timeStr: string): string {
  // 20260616_143000 → ISO
  const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/)
  if (!match) return new Date().toISOString()
  const [, y, m, d, h, min, s] = match
  return new Date(
    parseInt(y), parseInt(m) - 1, parseInt(d),
    parseInt(h), parseInt(min), parseInt(s)
  ).toISOString()
}

// ── 更新自动备份 ──
// 与用户手动/定时备份分开存放，只保留最近一次，用于更新回滚

const UPDATE_BACKUP_DIR = path.resolve('prisma/data/.update-auto-backup')

export interface UpdateBackupInfo {
  dbBackup: boolean       // 是否备份数据库
  timestamp: string       // ISO 时间
  version: string         // 更新前的版本号
}

/** 创建更新前自动备份（覆盖式，只保留一份） */
export function createUpdateBackup(version: string): UpdateBackupInfo {
  // 清理旧的更新备份
  if (fs.existsSync(UPDATE_BACKUP_DIR)) {
    fs.rmSync(UPDATE_BACKUP_DIR, { recursive: true, force: true })
  }
  fs.mkdirSync(UPDATE_BACKUP_DIR, { recursive: true })

  const info: UpdateBackupInfo = {
    dbBackup: false,
    timestamp: new Date().toISOString(),
    version,
  }

  // 备份数据库
  if (fs.existsSync(DB_PATH)) {
    const destPath = path.join(UPDATE_BACKUP_DIR, 'settlement.db')
    fs.copyFileSync(DB_PATH, destPath)
    info.dbBackup = true
  }

  // 写入备份信息
  fs.writeFileSync(
    path.join(UPDATE_BACKUP_DIR, 'backup-info.json'),
    JSON.stringify(info, null, 2)
  )

  console.log(`[backup] 更新自动备份完成（版本: ${version}，数据库: ${info.dbBackup}）`)
  return info
}

/** 从更新自动备份回滚 */
export function rollbackUpdateBackup(): boolean {
  const infoPath = path.join(UPDATE_BACKUP_DIR, 'backup-info.json')
  if (!fs.existsSync(infoPath)) {
    console.error('[backup] 更新自动备份不存在，无法回滚')
    return false
  }

  try {
    // 回滚数据库
    const dbBackupPath = path.join(UPDATE_BACKUP_DIR, 'settlement.db')
    if (fs.existsSync(dbBackupPath)) {
      fs.copyFileSync(dbBackupPath, DB_PATH)
      console.log('[backup] 数据库已从更新备份回滚')
    }

    console.log('[backup] 更新自动备份回滚完成')
    return true
  } catch (e) {
    console.error('[backup] 更新自动备份回滚失败:', e)
    return false
  }
}

/** 检查是否存在更新自动备份 */
export function hasUpdateBackup(): boolean {
  return fs.existsSync(path.join(UPDATE_BACKUP_DIR, 'backup-info.json'))
}

/** 获取更新自动备份信息 */
export function getUpdateBackupInfo(): UpdateBackupInfo | null {
  const infoPath = path.join(UPDATE_BACKUP_DIR, 'backup-info.json')
  if (!fs.existsSync(infoPath)) return null
  try {
    return JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
  } catch {
    return null
  }
}
