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
  // 获取下一个工种编码
  async getNextCode(): Promise<string> {
    const result = await api.get<{ code: number; message: string; data: string }>(
      '/job-types/next-code'
    )
    return result.data
  },

  // 获取工种列表
  async getList(includeDeleted?: boolean): Promise<JobType[]> {
    return await api.get<JobType[]>('/job-types', {
      params: { includeDeleted }
    })
  },

  // 获取工种详情
  async getDetail(id: number): Promise<JobType> {
    return await api.get<JobType>(`/job-types/${id}`)
  },

  // 创建工种
  async create(data: { name: string; code: string }): Promise<JobType> {
    return await api.post<JobType>('/job-types', data)
  },

  // 更新工种
  async update(
    id: number,
    data: {
      name?: string
      code?: string
      status?: string
    }
  ): Promise<JobType> {
    return await api.put<JobType>(`/job-types/${id}`, data)
  },

  // 删除工种
  async delete(id: number): Promise<void> {
    await api.delete(`/job-types/${id}`)
  }
}
