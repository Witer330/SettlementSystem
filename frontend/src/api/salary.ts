import { api } from './request';

export interface SalaryBill {
  id: number;
  employeeId: number;
  period: string;
  hourlyHours: number;
  hourlyAmount: number;
  pieceAmount: number;
  pieceCount: number;
  totalAmount: number;
  status: string;
  approvedBy?: number | null;
  approvedAt?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: number;
    name: string;
    code: string;
    payType: string;
  };
  details?: SalaryBillDetail[];
}

export interface SalaryBillDetail {
  id: number;
  billId: number;
  type: 'hourly' | 'piece';
  date: string;
  productId?: number | null;
  processId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  remark?: string | null;
  createdAt: string;
  product?: {
    id: number;
    name: string;
    code: string;
  };
  process?: {
    id: number;
    name: string;
    code: string;
  };
}

export interface SalaryBillListResponse {
  list: SalaryBill[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CalculateSalaryResult {
  employeeId: number;
  employeeName: string;
  period: string;
  payType: string;
  hourlyHours: number;
  hourlyAmount: number;
  pieceCount: number;
  pieceAmount: number;
  total: number;
  amount: number;
  billId: number;
  status: string;
  message?: string;
}

export const salaryApi = {
  // 计算工资
  async calculateSalary(period: string, params?: { employeeId?: number; employeeIds?: string }): Promise<CalculateSalaryResult[]> {
    return await api.post<CalculateSalaryResult[]>(`/salary/calculate/${period}`, {}, { params });
  },

  // 获取工资单列表
  async getSalaryBills(params?: {
    page?: number;
    pageSize?: number;
    period?: string;
    employeeId?: number;
    status?: string;
  }): Promise<SalaryBillListResponse> {
    return await api.get<SalaryBillListResponse>('/salary/bills', { params });
  },

  // 获取工资单详情
  async getSalaryBillDetail(id: number): Promise<SalaryBill> {
    return await api.get<SalaryBill>(`/salary/bills/${id}`);
  },

  // 审核工资单
  async approveSalaryBill(id: number, remark?: string): Promise<void> {
    return await api.put<void>(`/salary/bills/${id}/approve`, { remark });
  }
};
