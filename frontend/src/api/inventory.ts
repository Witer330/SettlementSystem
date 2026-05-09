import { api } from './request'

export interface InventoryItem {
  materialId: number
  materialCode: string
  materialName: string
  category: string
  specification?: string
  unit: string
  safeStock: number
  quantity: number
  lastUpdated: string | null
  status: string
  stockStatus: 'normal' | 'low' | 'empty'
}

export interface InventoryLog {
  id: number
  materialId: number
  type: string
  quantity: number
  referenceType?: string
  referenceId?: number
  remark?: string
  createdAt: string
  material: {
    name: string
    code: string
    unit: string
  }
}

export interface InventoryListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}

export interface InventoryLogParams {
  page?: number
  pageSize?: number
  materialId?: number
  type?: string
  startDate?: string
  endDate?: string
}

export const inventoryApi = {
  // 获取库存列表
  getList: (params?: InventoryListParams) =>
    api.get<{ list: InventoryItem[]; total: number }>('/inventory', { params }),

  // 获取库存变动日志
  getLogs: (params?: InventoryLogParams) =>
    api.get<{ list: InventoryLog[]; total: number }>('/inventory/logs', { params }),

  // 获取单个物料库存详情
  getDetail: (materialId: number) =>
    api.get<InventoryItem>(`/inventory/${materialId}`),

  // 手动调整库存
  adjust: (data: { materialId: number; quantity: number; type: 'in' | 'out'; remark?: string }) =>
    api.post('/inventory/adjust', data)
}
