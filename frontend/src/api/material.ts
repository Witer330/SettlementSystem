import { api } from './request'

export interface Material {
  id: number
  name: string
  code: string
  category: string
  specification?: string
  unit: string
  barcode?: string
  safeStock: number
  status: string
  createdAt: string
}

export interface MaterialListParams {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  status?: string
  includeArchived?: boolean | string
}

export const materialApi = {
  getList: (params?: MaterialListParams) =>
    api.get<{ list: Material[]; total: number }>('/materials', { params }),

  getDetail: (id: number) =>
    api.get<Material>(`/materials/${id}`),

  create: (data: Partial<Material>) =>
    api.post<Material>('/materials', data),

  update: (id: number, data: Partial<Material>) =>
    api.put<Material>(`/materials/${id}`, data),

  delete: (id: number) =>
    api.delete(`/materials/${id}`),

  restore: (id: number) =>
    api.patch<Material>(`/materials/${id}/restore`)
}
