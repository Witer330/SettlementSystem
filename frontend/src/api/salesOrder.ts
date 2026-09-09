import { api } from './request'

export interface SalesOrderItem {
  id?: number
  productId: number
  productName?: string
  productCode?: string
  product?: { name: string; code: string }
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
  orderDate?: string
  businessType?: string
  deliveryMethod?: string
  salesperson?: string
  deliveryPerson?: string
  returnDate?: string
  paymentMethod?: string
  contactInfo?: string
  customerRemark?: string
  creator?: string
  wholeDiscount?: number
  usePrepayment?: boolean
  shippingAddress?: string
  items: SalesOrderItem[]
  receivableItems?: Array<{ id: number; receivable?: { id: number; orderNo: string; status: string } }>
  productionOrders?: Array<{ id: number; orderNo: string; status: string }>
  purchaseOrders?: Array<{ id: number; orderNo: string; status: string }>
  returnOrders?: Array<{ id: number; returnNo: string; status: string }>
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

  create: (data: { customerId?: number; items?: SalesOrderItem[]; remark?: string; status?: string;
    orderDate?: string; businessType?: string; deliveryMethod?: string; salesperson?: string;
    deliveryPerson?: string; returnDate?: string; paymentMethod?: string; contactInfo?: string;
    customerRemark?: string; wholeDiscount?: number; usePrepayment?: boolean; shippingAddress?: string }) =>
    api.post<SalesOrder>('/sales-orders', data),

  update: (id: number, data: Partial<SalesOrder>) =>
    api.put<SalesOrder>(`/sales-orders/${id}`, data),

  delete: (id: number) =>
    api.delete(`/sales-orders/${id}`),

  restore: (id: number) =>
    api.patch<SalesOrder>(`/sales-orders/${id}/restore`),

  updateStatus: (id: number, status: string, extra?: Record<string, any>) =>
    api.patch(`/sales-orders/${id}/status`, { status, ...extra }),

  ship: (id: number, items: Array<{ itemId: number; shippedQuantity: number }>) =>
    api.post<SalesOrder>(`/sales-orders/${id}/ship`, { items }),

  getMaterialRequirements: (id: number) =>
    api.get<{ salesOrder: SalesOrder; requirements: MaterialRequirement[] }>(
      `/sales-orders/${id}/material-requirements`
    )
}
