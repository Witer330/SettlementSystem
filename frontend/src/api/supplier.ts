import { api } from './request'

export interface Supplier {
  id: number
  name: string
  code: string
  contact?: string | null
  phone?: string | null
  address?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface SupplierListResponse {
  list: Supplier[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const supplierApi = {
  // 获取供应商列表
  async getList(params?: {
    page?: number
    pageSize?: number
    keyword?: string
    status?: string
  }): Promise<SupplierListResponse> {
    return await api.get<SupplierListResponse>('/suppliers', { params })
  },

  // 获取供应商详情
  async getDetail(id: number): Promise<Supplier> {
    return await api.get<Supplier>(`/suppliers/${id}`)
  },

  // 创建供应商
  async create(data: Partial<Supplier>): Promise<Supplier> {
    return await api.post<Supplier>('/suppliers', data)
  },

  // 更新供应商
  async update(id: number, data: Partial<Supplier>): Promise<Supplier> {
    return await api.put<Supplier>(`/suppliers/${id}`, data)
  },

  // 删除供应商
  async delete(id: number): Promise<void> {
    await api.delete(`/suppliers/${id}`)
  }
}
