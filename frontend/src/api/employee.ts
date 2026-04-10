import { api } from './request';

export interface Employee {
  id: number;
  name: string;
  code: string;
  departmentId?: number | null;
  jobType?: string;
  jobTypeId?: number | null;
  payType: string; // hourly(时薪) / piece(计件)
  hourlyRate: number;
  pieceRate: number; // 默认计件单价
  status: string;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: number;
    name: string;
    code: string;
  };
  jobTypeRef?: {
    id: number;
    name: string;
    code: string;
  };
}

export interface EmployeeListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  departmentId?: number;
  includeDeleted?: boolean;
}

export interface EmployeeListResponse {
  list: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const employeeApi = {
  // 获取下一个员工工号
  async getNextCode(): Promise<string> {
    const result = await api.get<{ code: number; message: string; data: string }>('/employees/next-code');
    return result.data;
  },

  // 获取员工列表
  async getList(params?: EmployeeListParams): Promise<EmployeeListResponse> {
    return await api.get<EmployeeListResponse>('/employees', { params });
  },

  // 获取员工详情
  async getDetail(id: number): Promise<Employee> {
    return await api.get<Employee>(`/employees/${id}`);
  },

  // 创建员工
  async create(data: Partial<Employee>): Promise<Employee> {
    return await api.post<Employee>('/employees', data);
  },

  // 更新员工
  async update(id: number, data: Partial<Employee>): Promise<Employee> {
    return await api.put<Employee>(`/employees/${id}`, data);
  },

  // 删除员工
  async delete(id: number): Promise<void> {
    await api.delete(`/employees/${id}`);
  }
};
