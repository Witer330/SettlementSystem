import { api } from './request'

export interface SalaryDetailItem {
  id?: number
  sheetId?: number
  employeeId: number
  type: 'piece' | 'hourly' | 'other'
  date: string
  productId?: number | null
  quantity?: number | null
  unitPrice?: number | null
  hours?: number | null
  amount: number
  remark?: string
  employee?: { id: number; name: string; code: string; hourlyRate?: number | null }
  product?: { id: number; name: string; code: string; unitPrice?: number }
}

export interface SalaryDetailSheet {
  id: number
  sheetNo: string
  batchDate: string
  status: string
  creator?: string
  remark?: string
  createdAt: string
  updatedAt: string
  items: SalaryDetailItem[]
}

export const salaryDetailApi = {
  getList: (params?: { page?: number; pageSize?: number; status?: string; employeeId?: number; type?: string; startDate?: string; endDate?: string }) =>
    api.get<{ list: SalaryDetailSheet[]; total: number }>('/salary-detail', { params }),

  getDetail: (id: number) =>
    api.get<SalaryDetailSheet>(`/salary-detail/${id}`),

  create: (data: { items: SalaryDetailItem[]; batchDate?: string; remark?: string; creator?: string }) =>
    api.post<SalaryDetailSheet>('/salary-detail', data),

  update: (id: number, data: { items: SalaryDetailItem[]; batchDate?: string; remark?: string }) =>
    api.put<SalaryDetailSheet>(`/salary-detail/${id}`, data),

  approve: (id: number) =>
    api.patch(`/salary-detail/${id}/approve`),

  unapprove: (id: number) =>
    api.patch(`/salary-detail/${id}/unapprove`),

  getApprovedItems: (params?: { employeeId?: number; startDate?: string; endDate?: string }) =>
    api.get<SalaryDetailItem[]>('/salary-detail/approved-items', { params })
}
