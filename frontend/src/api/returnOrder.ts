import { api } from './request'

export interface ReturnOrderItem {
  id: number
  returnOrderId: number
  salesItemId: number
  productId: number
  quantity: number
  product?: { id: number; name: string; code: string }
}

export interface ReturnOrder {
  id: number
  salesOrderId: number
  returnNo: string
  totalQuantity: number
  status: string
  reason?: string
  remark?: string
  createdAt: string
  salesOrder?: { id: number; orderNo: string; customer?: { name: string } }
  items: ReturnOrderItem[]
}

export const returnOrderApi = {
  getList: (params?: { page?: number; pageSize?: number; keyword?: string; status?: string; startDate?: string; endDate?: string }) =>
    api.get<{ list: ReturnOrder[]; total: number }>('/return-orders', { params }),

  getDetail: (id: number) =>
    api.get<ReturnOrder>(`/return-orders/${id}`),

  create: (data: { salesOrderId: number; items: Array<{ salesItemId: number; productId: number; quantity: number }>; reason?: string; remark?: string }) =>
    api.post<ReturnOrder>('/return-orders', data),

  complete: (id: number) =>
    api.patch(`/return-orders/${id}/complete`),

  cancel: (id: number) =>
    api.patch(`/return-orders/${id}/cancel`),

  scrap: (id: number, reason?: string) =>
    api.patch(`/return-orders/${id}/scrap`, { reason }),
}
