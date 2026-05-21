import { api } from './request'

export interface Setting {
  id: number
  key: string
  value: string
  type: string
  category: string
  defaultValue?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: number | null
  updatedBy?: number | null
}

export interface SystemInfo {
  version: string
  nodeVersion: string
  env: string
  dbVersion: string
  uptime: number
  memory: { used: number; total: number }
  settingCount: number
  userCount: number
  employeeCount: number
}

export interface AuditLog {
  id: number
  settingKey: string
  oldValue: string | null
  newValue: string | null
  action: string
  userId: number | null
  userName: string | null
  createdAt: string
}

export const settingApi = {
  // 获取所有设置
  async getList(category?: string): Promise<Setting[]> {
    const params = category ? { category } : undefined
    return await api.get<Setting[]>('/settings', { params })
  },

  // 获取单个设置（返回解析后的值，不存在则返回 null）
  async getTyped<T = any>(key: string): Promise<T | null> {
    try {
      const data = await api.get<{ key: string; value: any }>(`/settings/${key}`)
      return data.value as T
    } catch (e: any) {
      if (e?.response?.status === 404) return null
      throw e
    }
  },

  // 更新设置
  async updateSetting(key: string, value: string, remark?: string, type?: string): Promise<void> {
    await api.put(`/settings/${key}`, { value, remark, type })
  },

  // 批量更新设置
  async batchUpdate(
    settings: Array<{ key: string; value: string; remark?: string }>
  ): Promise<void> {
    await api.post('/settings/batch', { settings })
  },

  // 获取系统信息
  async getSystemInfo(): Promise<SystemInfo> {
    return await api.get<SystemInfo>('/settings/system-info')
  },

  // 获取审计日志
  async getAuditLogs(params?: { settingKey?: string; page?: number; pageSize?: number }): Promise<{
    list: AuditLog[]
    total: number
  }> {
    return await api.get('/settings/audit-logs', { params })
  }
}
