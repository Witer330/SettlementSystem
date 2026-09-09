import { api } from './request'

export interface BackupInfo {
  filename: string
  size: number
  createdAt: string
}

/** 获取备份列表 */
export const listBackups = () =>
  api.get<BackupInfo[]>('/backup')

/** 手动创建备份 */
export const createBackup = () =>
  api.post<BackupInfo>('/backup')

/** 恢复备份 */
export const restoreBackup = (filename: string) =>
  api.post(`/backup/${encodeURIComponent(filename)}/restore`)

/** 删除备份 */
export const deleteBackup = (filename: string) =>
  api.delete(`/backup/${encodeURIComponent(filename)}`)
