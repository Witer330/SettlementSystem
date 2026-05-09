import { api } from './request'

export interface Customer {
  id: number
  name: string
  code: string
  contact?: string | null
  phone?: string | null
  address?: string | null
  creditLimit: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface CustomerListResponse {
  list: Customer[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const customerApi = {
  // 获取客户列表
  async getList(params?: {
    page?: number
    pageSize?: number
    keyword?: string
    status?: string
  }): Promise<CustomerListResponse> {
    return await api.get<CustomerListResponse>('/customers', { params })
  },

  // 获取客户详情
  async getDetail(id: number): Promise<Customer> {
    return await api.get<Customer>(`/customers/${id}`)
  },

  // 创建客户
  async create(data: Partial<Customer>): Promise<Customer> {
    return await api.post<Customer>('/customers', data)
  },

  // 更新客户
  async update(id: number, data: Partial<Customer>): Promise<Customer> {
    return await api.put<Customer>(`/customers/${id}`, data)
  },

  // 删除客户
  async delete(id: number): Promise<void> {
    await api.delete(`/customers/${id}`)
  }
}
