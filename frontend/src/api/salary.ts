import { api } from './request'

export interface SalaryBill {
  id: number
  employeeId: number
  period: string
  hourlyHours: number
  hourlyAmount: number
  pieceAmount: number
  pieceCount: number
  otherAmount: number
  otherCount: number
  totalAmount: number
  status: string  // pending / approved / issued
  approvedBy?: number | null
  approvedAt?: string | null
  issuedAt?: string | null
  dataHash?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
  employee?: {
    id: number
    name: string
    code: string
  }
  details?: SalaryBillDetail[]
}

export interface SalaryBillDetail {
  id: number
  billId: number
  type: 'hourly' | 'piece'
  date: string
  productId?: number | null
  quantity: number
  unitPrice: number
  amount: number
  sourceRecordId?: number | null
  remark?: string | null
  createdAt: string
  product?: {
    id: number
    name: string
    code: string
  }
}

export interface SalaryBillListResponse {
  list: SalaryBill[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CalculateSalaryResult {
  employeeId: number
  employeeName: string
  period: string
  hourlyHours: number
  hourlyAmount: number
  pieceCount: number
  pieceAmount: number
  otherCount: number
  otherAmount: number
  total: number
  amount: number
  billId: number
  status: string
  message?: string
}

export const salaryApi = {
  // 计算工资
  async calculateSalary(
    period: string,
    params?: { employeeId?: number; employeeIds?: string }
  ): Promise<CalculateSalaryResult[]> {
    return await api.post<CalculateSalaryResult[]>(`/salary/calculate/${period}`, {}, { params })
  },

  // 获取工资单列表
  async getSalaryBills(params?: {
    page?: number
    pageSize?: number
    period?: string
    employeeId?: number
    status?: string
  }): Promise<SalaryBillListResponse> {
    return await api.get<SalaryBillListResponse>('/salary/bills', { params })
  },

  // 获取工资单详情
  async getSalaryBillDetail(id: number): Promise<SalaryBill> {
    return await api.get<SalaryBill>(`/salary/bills/${id}`)
  },

  // 审核工资单
  async approveSalaryBill(id: number, remark?: string): Promise<void> {
    return await api.put<void>(`/salary/bills/${id}/approve`, { remark })
  },

  // 反审工资单
  async revokeSalaryBill(id: number): Promise<void> {
    return await api.put<void>(`/salary/bills/${id}/revoke`)
  },

  // 发放工资单
  async issueSalaryBill(id: number): Promise<SalaryBill> {
    return await api.put<SalaryBill>(`/salary/bills/${id}/issue`)
  },

  async unissueSalaryBill(id: number, reason?: string): Promise<SalaryBill> {
    return await api.put<SalaryBill>(`/salary/bills/${id}/unissue`, { reason })
  },

  // 删除工资单
  async deleteSalaryBill(id: number): Promise<void> {
    return await api.delete<void>(`/salary/bills/${id}`)
  },

  // 验证工资单数据完整性
  async verifySalaryBill(id: number): Promise<{ verified: boolean; storedHash: string; currentHash: string }> {
    return await api.get<{ verified: boolean; storedHash: string; currentHash: string }>(`/salary/bills/${id}/verify`)
  }
}
