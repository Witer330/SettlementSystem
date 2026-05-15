import { api } from './request'

export interface DailyPieceRecord {
  id: number
  employeeId: number
  date: string
  totalAmount: number
  remark?: string | null
  createdAt: string
  updatedAt: string
  employee?: { id: number; name: string; code: string }
  items?: DailyPieceRecordItem[]
}

export interface DailyPieceRecordItem {
  id: number
  recordId: number
  productId: number
  quantity: number
  unitPrice: number
  amount: number
  createdAt: string
  product?: { id: number; name: string; code: string }
}

export interface MonthlySummary {
  records: DailyPieceRecord[]
  summary: {
    totalAmount: number
    totalCount: number
    productSummary: Array<{ productName: string; quantity: number; amount: number }>
  }
}

export interface DailyRecordListResponse {
  list: DailyPieceRecord[]
  total: number
  page: number
  pageSize: number
}

export const dailyPieceApi = {
  async createRecord(data: {
    employeeId: number; date: string
    items: Array<{ productId: number; quantity: number; unitPrice?: number }>
    remark?: string
  }): Promise<DailyPieceRecord> {
    return await api.post<DailyPieceRecord>('/daily-records', data)
  },

  async getRecords(params?: {
    page?: number; pageSize?: number; employeeId?: number
    date?: string; startDate?: string; endDate?: string
  }): Promise<DailyRecordListResponse> {
    return await api.get<DailyRecordListResponse>('/daily-records', { params })
  },

  async getRecord(id: number): Promise<DailyPieceRecord> {
    return await api.get<DailyPieceRecord>(`/daily-records/${id}`)
  },

  async updateRecord(id: number, data: {
    items: Array<{ productId: number; quantity: number; unitPrice?: number }>
    remark?: string
  }): Promise<DailyPieceRecord> {
    return await api.put<DailyPieceRecord>(`/daily-records/${id}`, data)
  },

  async deleteRecord(id: number): Promise<void> {
    await api.delete(`/daily-records/${id}`)
  },

  async getMonthlySummary(employeeId: number, period: string): Promise<MonthlySummary> {
    return await api.get<MonthlySummary>(`/daily-records/summary/${employeeId}/${period}`)
  }
}
