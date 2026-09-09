import { api } from './request'
import type { PurchaseOrder } from './purchaseOrder'

export interface PayableItem {
  id: number
  payableId: number
  purchaseOrderId: number
  amount: number
  createdAt: string
  purchaseOrder?: PurchaseOrder
}

export interface Payable {
  id: number
  orderNo: string
  supplierId: number
  totalAmount: number
  status: string
  approvedBy?: number | null
  approvedAt?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
  supplier?: { id: number; name: string }
  items?: PayableItem[]
}

export const payableApi = {
  async getList(params?: {
    page?: number
    pageSize?: number
    keyword?: string
    status?: string
    supplierId?: number
  }) {
    return await api.get<{ list: Payable[]; total: number }>('/payables', { params })
  },

  async getById(id: number): Promise<Payable> {
    return await api.get(`/payables/${id}`)
  },

  async getAvailablePurchaseOrders(supplierId?: number) {
    return await api.get<PurchaseOrder[]>('/payables/available-purchase-orders', { params: { supplierId } })
  },

  async create(data: { supplierId: number; items: { purchaseOrderId: number; amount: number }[]; remark?: string }): Promise<Payable> {
    return await api.post('/payables', data)
  },

  async update(id: number, data: { supplierId?: number; items?: { purchaseOrderId: number; amount: number }[]; remark?: string }): Promise<Payable> {
    return await api.put(`/payables/${id}`, data)
  },

  async delete(id: number): Promise<void> {
    return await api.delete(`/payables/${id}`)
  },

  async approve(id: number): Promise<Payable> {
    return await api.put(`/payables/${id}/approve`)
  },

  async revoke(id: number): Promise<Payable> {
    return await api.put(`/payables/${id}/revoke`)
  }
}
