import { api } from './request'

export interface ProductionPickingItem {
  id: number
  orderId: number
  materialId: number
  plannedQty: number
  pickedQty: number
  remark?: string
  material?: {
    id: number
    name: string
    code: string
    unit: string
    specification?: string
  }
}

export interface ProductionOrder {
  id: number
  orderNo: string
  salesOrderId?: number
  productId: number
  quantity: number
  producedQuantity: number
  status: string
  pickingStale: boolean
  startDate?: string
  endDate?: string
  remark?: string
  product?: { id: number; name: string; code: string; unit: string; unitPrice: number }
  salesOrder?: {
    id: number
    orderNo: string
    customer?: { id: number; name: string }
    items?: any[]
    productionOrders?: { quantity: number; producedQuantity: number; status: string }[]
  }
  pickingItems?: ProductionPickingItem[]
  dailyRecords?: any[]
  createdAt: string
  updatedAt: string
}

export interface ProductionOrderListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  productId?: number
}

export const productionOrderApi = {
  getList: (params?: ProductionOrderListParams) =>
    api.get<{ list: ProductionOrder[]; total: number; page: number; pageSize: number }>(
      '/production-orders',
      { params }
    ),

  getDetail: (id: number) =>
    api.get<ProductionOrder>(`/production-orders/${id}`),

  create: (data: {
    salesOrderId?: number
    productId: number
    quantity: number
    startDate?: string
    remark?: string
  }) => api.post<ProductionOrder>('/production-orders', data),

  update: (id: number, data: Partial<ProductionOrder>) =>
    api.put<ProductionOrder>(`/production-orders/${id}`, data),

  delete: (id: number) =>
    api.delete(`/production-orders/${id}`),

  generatePicking: (id: number) =>
    api.post<ProductionPickingItem[]>(`/production-orders/${id}/generate-picking`),

  pickMaterials: (id: number, data: { items: { itemId: number; pickedQty: number }[] }) =>
    api.post(`/production-orders/${id}/pick`, data),

  completeProduction: (id: number, data: {
    quantity: number
    remark?: string
    dailyRecord?: {
      employeeId: number
      totalAmount: number
      items: { productId: number; quantity: number; unitPrice: number; amount: number }[]
    }
    dailyRecords?: {
      employeeId: number
      totalAmount: number
      items: { productId: number; quantity: number; unitPrice: number; amount: number }[]
    }[]
  }) => api.post(`/production-orders/${id}/complete`, data),

  updateStatus: (id: number, status: string) =>
    api.patch(`/production-orders/${id}/status`, { status })
}
