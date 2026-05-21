import { api } from './request'

export interface Partner {
  id: number
  name: string
  code: string
  contact?: string | null
  phone?: string | null
  address?: string | null
  isCustomer: boolean
  isSupplier: boolean
  creditLimit: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface PartnerListResponse {
  list: Partner[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PartnerListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  isCustomer?: boolean | string
  isSupplier?: boolean | string
  includeArchived?: boolean | string
}

export const partnerApi = {
  async getList(params?: PartnerListParams): Promise<PartnerListResponse> {
    return await api.get<PartnerListResponse>('/partners', { params })
  },

  async getDetail(id: number): Promise<Partner> {
    return await api.get<Partner>(`/partners/${id}`)
  },

  async create(data: Partial<Partner>): Promise<Partner> {
    return await api.post<Partner>('/partners', data)
  },

  async update(id: number, data: Partial<Partner>): Promise<Partner> {
    return await api.put<Partner>(`/partners/${id}`, data)
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/partners/${id}`)
  },

  async restore(id: number): Promise<Partner> {
    return await api.patch<Partner>(`/partners/${id}/restore`)
  }
}
