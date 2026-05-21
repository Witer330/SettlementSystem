import { api } from './request'

export interface Department {
  id: number
  name: string
  code: string
  parentId: number | null
  status: string
  createdAt: string
  employees?: Employee[]
}

export interface Employee {
  id: number
  name: string
  code: string
  departmentId: number | null
  jobType: string
  hourlyRate?: number | null
  status: string
  createdAt: string
  updatedAt: string
}

export const departmentApi = {
  async getList(params?: { includeArchived?: boolean | string; includeDeleted?: boolean | string }): Promise<Department[]> {
    return await api.get<Department[]>('/departments', { params })
  },

  async getDetail(id: number): Promise<Department> {
    return await api.get<Department>(`/departments/${id}`)
  },

  async create(data: { name: string; code: string; parentId?: number }): Promise<Department> {
    return await api.post<Department>('/departments', data)
  },

  async update(id: number, data: { name?: string; code?: string; parentId?: number; status?: string }): Promise<Department> {
    return await api.put<Department>(`/departments/${id}`, data)
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/departments/${id}`)
  },

  async restore(id: number): Promise<Department> {
    return await api.patch<Department>(`/departments/${id}/restore`)
  }
}
