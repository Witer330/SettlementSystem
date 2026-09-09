import { api } from './request'
import type { SalesOrder } from './salesOrder'

export interface ReceivableItem {
  id: number
  receivableId: number
  salesOrderId: number
  amount: number
  createdAt: string
  salesOrder?: SalesOrder
}

export interface Receivable {
  id: number
  orderNo: string
  customerId: number
  totalAmount: number
  status: string
  approvedBy?: number | null
  approvedAt?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
  customer?: { id: number; name: string }
  items?: ReceivableItem[]
}

export const receivableApi = {
  async getList(params?: {
    page?: number
    pageSize?: number
    keyword?: string
    status?: string
    customerId?: number
  }) {
    return await api.get<{ list: Receivable[]; total: number }>('/receivables', { params })
  },

  async getById(id: number): Promise<Receivable> {
    return await api.get(`/receivables/${id}`)
  },

  async getAvailableSalesOrders(customerId?: number) {
    return await api.get<SalesOrder[]>('/receivables/available-sales-orders', { params: { customerId } })
  },

  async create(data: { customerId: number; items: { salesOrderId: number; amount: number }[]; remark?: string }): Promise<Receivable> {
    return await api.post('/receivables', data)
  },

  async update(id: number, data: { customerId?: number; items?: { salesOrderId: number; amount: number }[]; remark?: string }): Promise<Receivable> {
    return await api.put(`/receivables/${id}`, data)
  },

  async delete(id: number): Promise<void> {
    return await api.delete(`/receivables/${id}`)
  },

  async approve(id: number): Promise<Receivable> {
    return await api.put(`/receivables/${id}/approve`)
  },

  async revoke(id: number): Promise<Receivable> {
    return await api.put(`/receivables/${id}/revoke`)
  }
}
