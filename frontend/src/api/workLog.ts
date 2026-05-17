import { api } from './request'

export interface WorkLog {
  id: number
  employeeId: number
  date: string
  hours: number
  remark?: string
  employee?: {
    id: number
    name: string
    code: string
    hourlyRate?: number | null
  }
  createdAt: string
}

export interface WorkLogListParams {
  page?: number
  pageSize?: number
  employeeId?: number
  startDate?: string
  endDate?: string
}

export interface MonthlySummary {
  employee: { id: number; name: string; code: string; hourlyRate?: number | null }
  totalHours: number
  totalAmount: number
  records: WorkLog[]
  period: string
}

export const workLogApi = {
  getList: (params?: WorkLogListParams) =>
    api.get<{ list: WorkLog[]; total: number; page: number; pageSize: number }>(
      '/work-logs',
      { params }
    ),

  getDetail: (id: number) =>
    api.get<WorkLog>(`/work-logs/${id}`),

  create: (data: { employeeId: number; date: string; hours: number; remark?: string }) =>
    api.post<WorkLog>('/work-logs', data),

  update: (id: number, data: Partial<WorkLog>) =>
    api.put<WorkLog>(`/work-logs/${id}`, data),

  delete: (id: number) =>
    api.delete(`/work-logs/${id}`),

  getMonthlySummary: (employeeId: number, period: string) =>
    api.get<MonthlySummary>(`/work-logs/summary/${employeeId}/${period}`)
}
