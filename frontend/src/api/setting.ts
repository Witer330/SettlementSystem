import { api } from './request'

export interface Setting {
  id: number
  key: string
  value: string
  remark?: string | null
  updatedAt: string
}

export const settingApi = {
  // 获取所有设置
  async getList(): Promise<Setting[]> {
    return await api.get<Setting[]>('/settings')
  },

  // 获取单个设置
  async getSetting(key: string): Promise<Setting> {
    return await api.get<Setting>(`/settings/${key}`)
  },

  // 更新设置
  async updateSetting(key: string, value: string, remark?: string): Promise<Setting> {
    return await api.put<Setting>(`/settings/${key}`, { value, remark })
  },

  // 批量更新设置
  async batchUpdate(
    settings: Array<{ key: string; value: string; remark?: string }>
  ): Promise<Setting[]> {
    return await api.post<Setting[]>('/settings/batch', { settings })
  }
}
