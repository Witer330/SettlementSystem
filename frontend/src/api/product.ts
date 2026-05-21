import { api } from './request'

export interface Product {
  id: number
  name: string
  code: string
  category: string
  specification?: string | null
  unit: string
  price: number
  unitPrice: number
  stock: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface ProductListResponse {
  list: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const productApi = {
  async getList(params?: {
    page?: number
    pageSize?: number
    keyword?: string
    status?: string
    includeArchived?: boolean | string
  }): Promise<ProductListResponse> {
    return await api.get<ProductListResponse>('/products', { params })
  },

  async getDetail(id: number): Promise<Product> {
    return await api.get<Product>(`/products/${id}`)
  },

  async create(data: Partial<Product>): Promise<Product> {
    return await api.post<Product>('/products', data)
  },

  async update(id: number, data: Partial<Product>): Promise<Product> {
    return await api.put<Product>(`/products/${id}`, data)
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}`)
  },

  async restore(id: number): Promise<Product> {
    return await api.patch<Product>(`/products/${id}/restore`)
  }
}
