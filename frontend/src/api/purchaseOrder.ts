import { api } from './request'

export interface PurchaseOrderItem {
  id?: number
  materialId: number
  materialName?: string
  materialCode?: string
  quantity: number
  price: number
  receivedQuantity?: number
}

export interface PurchaseOrder {
  id: number
  orderNo: string
  supplierId?: number
  supplierName?: string
  supplier?: { name: string }
  partner?: { name: string }
  totalAmount: number
  status: string
  remark?: string
  reserveInventory?: boolean
  items: PurchaseOrderItem[]
  payableItems?: Array<{ id: number; payable?: { id: number; orderNo: string; status: string } }>
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}

export const purchaseOrderApi = {
  getList: (params?: PurchaseOrderListParams) =>
    api.get<{ list: PurchaseOrder[]; total: number }>('/purchase-orders', { params }),

  getDetail: (id: number) =>
    api.get<PurchaseOrder>(`/purchase-orders/${id}`),

  create: (data: { supplierId?: number; items?: PurchaseOrderItem[]; remark?: string; status?: string }) =>
    api.post<PurchaseOrder>('/purchase-orders', data),

  update: (id: number, data: Partial<PurchaseOrder>) =>
    api.put<PurchaseOrder>(`/purchase-orders/${id}`, data),

  delete: (id: number) =>
    api.delete(`/purchase-orders/${id}`),

  restore: (id: number) =>
    api.patch<PurchaseOrder>(`/purchase-orders/${id}/restore`),

  updateStatus: (id: number, status: string) =>
    api.patch(`/purchase-orders/${id}/status`, { status }),

  receive: (id: number, items: Array<{ itemId: number; receivedQuantity: number }>) =>
    api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, { items })
}
