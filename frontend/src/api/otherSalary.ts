import { api } from './request'

export interface OtherSalary {
  id: number
  employeeId: number
  date: string
  type: string  // bonus / performance / task
  amount: number
  remark?: string | null
  createdAt: string
  employee?: {
    id: number
    name: string
    code: string
  }
}

export const otherSalaryApi = {
  getList: (params?: {
    page?: number; pageSize?: number; employeeId?: number
    startDate?: string; endDate?: string; type?: string
  }) =>
    api.get<{ list: OtherSalary[]; total: number }>('/other-salaries', { params }),

  create: (data: { employeeId: number; date: string; type: string; amount: number; remark?: string }) =>
    api.post<OtherSalary>('/other-salaries', data),

  update: (id: number, data: Partial<OtherSalary>) =>
    api.put<OtherSalary>(`/other-salaries/${id}`, data),

  delete: (id: number) =>
    api.delete(`/other-salaries/${id}`)
}
