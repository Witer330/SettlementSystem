import { api } from './request'

export interface EndpointAlias {
  id: number
  alias: string
  desc: string
  path: string
  group: string
}

export const endpointApi = {
  getList: async (): Promise<EndpointAlias[]> => {
    try {
      const res = await api.get<{ key: string; value: string }>('/settings/system.endpointRegistry')
      return JSON.parse(res.value)
    } catch {
      return []
    }
  },

  saveList: (endpoints: EndpointAlias[]) =>
    api.put('/settings/system.endpointRegistry', {
      value: JSON.stringify(endpoints),
      remark: '系统页面接口别名注册表'
    })
}
