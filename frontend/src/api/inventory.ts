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

export interface ProductStockItem {
  productId: number
  productCode: string
  productName: string
  category: string
  specification?: string
  unit: string
  quantity: number
  lastUpdated: string | null
  stockStatus: 'normal' | 'empty'
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
  adjust: (data: { materialId: number; quantity: number; type: 'in' | 'out'; pkgSpec?: string; unitRatio?: number; remark?: string }) =>
    api.post('/inventory/adjust', data),

  // 成品库存列表
  getProductStockList: (params?: InventoryListParams) =>
    api.get<{ list: ProductStockItem[]; total: number }>('/inventory/products/list', { params }),

  // 成品库存调整
  adjustProductStock: (data: { productId: number; quantity: number; type: 'in' | 'out'; remark?: string }) =>
    api.post('/inventory/products/adjust', data),

  // 批量创建出入库单（draft）
  batchCreate: (data: { items: Array<{ materialId: number; quantity: number; pkgSpec?: string; unitRatio?: number; remark?: string }>; type: string; batchNo?: string }) =>
    api.post('/inventory/batch', data),

  // 审核出入库单
  approveBatch: (batchNo: string) =>
    api.post('/inventory/batch/approve', { batchNo }),

  // 反审出入库单
  unapproveBatch: (batchNo: string) =>
    api.post('/inventory/batch/unapprove', { batchNo })
}
