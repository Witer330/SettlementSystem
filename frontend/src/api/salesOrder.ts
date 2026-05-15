import { api } from './request'

export interface SalesOrderItem {
  id?: number
  productId: number
  productName?: string
  productCode?: string
  quantity: number
  price: number
  shippedQuantity?: number
}

export interface SalesOrder {
  id: number
  orderNo: string
  customerId?: number
  customerName?: string
  customer?: { name: string }
  totalAmount: number
  status: string
  remark?: string
  reserveInventory?: boolean
  items: SalesOrderItem[]
  createdAt: string
  updatedAt: string
}

export interface MaterialRequirement {
  materialId: number
  materialName: string
  materialCode: string
  unit: string
  totalRequired: number
  currentStock: number
  shortage: number
  details: Array<{
    productName: string
    productCode: string
    quantity: number
    bomQty: number
    subTotal: number
  }>
}

export interface SalesOrderListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}

export const salesOrderApi = {
  getList: (params?: SalesOrderListParams) =>
    api.get<{ list: SalesOrder[]; total: number }>('/sales-orders', { params }),

  getDetail: (id: number) =>
    api.get<SalesOrder>(`/sales-orders/${id}`),

  create: (data: { customerId?: number; items?: SalesOrderItem[]; remark?: string; status?: string }) =>
    api.post<SalesOrder>('/sales-orders', data),

  update: (id: number, data: Partial<SalesOrder>) =>
    api.put<SalesOrder>(`/sales-orders/${id}`, data),

  delete: (id: number) =>
    api.delete(`/sales-orders/${id}`),

  updateStatus: (id: number, status: string, extra?: Record<string, any>) =>
    api.patch(`/sales-orders/${id}/status`, { status, ...extra }),

  getMaterialRequirements: (id: number) =>
    api.get<{ salesOrder: SalesOrder; requirements: MaterialRequirement[] }>(
      `/sales-orders/${id}/material-requirements`
    )
}
