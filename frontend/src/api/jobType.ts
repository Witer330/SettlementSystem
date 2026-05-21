import { api } from './request'

export interface JobType {
  id: number
  name: string
  code: string
  status: string
  createdAt: string
  updatedAt: string
  employees?: any[]
}

export const jobTypeApi = {
  async getNextCode(): Promise<string> {
    const result = await api.get<{ code: number; message: string; data: string }>('/job-types/next-code')
    return result.data
  },

  async getList(params?: { includeArchived?: boolean | string; includeDeleted?: boolean | string }): Promise<JobType[]> {
    return await api.get<JobType[]>('/job-types', { params })
  },

  async getDetail(id: number): Promise<JobType> {
    return await api.get<JobType>(`/job-types/${id}`)
  },

  async create(data: { name: string; code: string }): Promise<JobType> {
    return await api.post<JobType>('/job-types', data)
  },

  async update(id: number, data: { name?: string; code?: string; status?: string }): Promise<JobType> {
    return await api.put<JobType>(`/job-types/${id}`, data)
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/job-types/${id}`)
  },

  async restore(id: number): Promise<JobType> {
    return await api.patch<JobType>(`/job-types/${id}/restore`)
  }
}
