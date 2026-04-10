import { api } from './request';

export interface DailyPieceRecord {
  id: number;
  employeeId: number;
  date: string;
  totalAmount: number;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: number;
    name: string;
    code: string;
  };
  items?: DailyPieceRecordItem[];
}

export interface DailyPieceRecordItem {
  id: number;
  recordId: number;
  specId: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdAt: string;
  spec?: {
    id: number;
    name: string;
    code: string;
    product?: {
      id: number;
      name: string;
      code: string;
    };
  };
}

export interface MonthlySummary {
  records: DailyPieceRecord[];
  summary: {
    totalAmount: number;
    totalCount: number;
    specSummary: Array<{
      specName: string;
      productName: string;
      quantity: number;
      amount: number;
    }>;
  };
}

export interface DailyRecordListResponse {
  list: DailyPieceRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const dailyPieceApi = {
  // 创建每日计件记录
  async createRecord(data: {
    employeeId: number;
    date: string;
    items: Array<{
      specId: number;
      quantity: number;
    }>;
    remark?: string;
  }): Promise<DailyPieceRecord> {
    return await api.post<DailyPieceRecord>('/daily-records', data);
  },

  // 获取每日计件记录列表
  async getRecords(params?: {
    page?: number;
    pageSize?: number;
    employeeId?: number;
    date?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<DailyRecordListResponse> {
    return await api.get<DailyRecordListResponse>('/daily-records', { params });
  },

  // 获取每日计件记录详情
  async getRecord(id: number): Promise<DailyPieceRecord> {
    return await api.get<DailyPieceRecord>(`/daily-records/${id}`);
  },

  // 更新每日计件记录
  async updateRecord(id: number, data: {
    items: Array<{
      specId: number;
      quantity: number;
      spec?: any;
      unitPrice?: number;
    }>;
    remark?: string;
  }): Promise<DailyPieceRecord> {
    return await api.put<DailyPieceRecord>(`/daily-records/${id}`, data);
  },

  // 删除每日计件记录
  async deleteRecord(id: number): Promise<void> {
    await api.delete(`/daily-records/${id}`);
  },

  // 获取员工月度计件汇总
  async getMonthlySummary(employeeId: number, period: string): Promise<MonthlySummary> {
    return await api.get<MonthlySummary>(`/daily-records/summary/${employeeId}/${period}`);
  }
};
