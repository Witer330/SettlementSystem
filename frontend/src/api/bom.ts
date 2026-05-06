import { api } from './request'

export interface BomItem {
  id: number
  productId: number
  materialId: number
  quantity: number
  material?: {
    id: number
    name: string
    code: string
    unit: string
  }
}

export const bomApi = {
  getByProduct: (productId: number) =>
    api.get<BomItem[]>(`/bom/product/${productId}`),

  save: (productId: number, items: Array<{ materialId: number; quantity: number }>) =>
    api.post<BomItem[]>(`/bom/product/${productId}`, { items }),

  addItem: (productId: number, data: { materialId: number; quantity: number }) =>
    api.post<BomItem>(`/bom/product/${productId}/item`, data),

  deleteItem: (id: number) =>
    api.delete(`/bom/${id}`)
}
