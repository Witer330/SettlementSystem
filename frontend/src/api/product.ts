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
  // 获取产品列表
  async getList(params?: {
    page?: number
    pageSize?: number
    keyword?: string
    status?: string
  }): Promise<ProductListResponse> {
    return await api.get<ProductListResponse>('/products', { params })
  },

  // 获取产品详情
  async getDetail(id: number): Promise<Product> {
    return await api.get<Product>(`/products/${id}`)
  },

  // 创建产品
  async create(data: Partial<Product>): Promise<Product> {
    return await api.post<Product>('/products', data)
  },

  // 更新产品
  async update(id: number, data: Partial<Product>): Promise<Product> {
    return await api.put<Product>(`/products/${id}`, data)
  },

  // 删除产品
  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}`)
  }
}
