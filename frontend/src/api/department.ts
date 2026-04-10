import { api } from './request';

export interface Department {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  status: string;
  createdAt: string;
  employees?: Employee[];
}

export interface Employee {
  id: number;
  name: string;
  code: string;
  departmentId: number | null;
  jobType: string;
  payType: string;
  hourlyRate: number;
  pieceRate: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const departmentApi = {
  // 获取部门列表
  async getList(): Promise<Department[]> {
    return await api.get<Department[]>('/departments');
  },

  // 获取部门详情
  async getDetail(id: number): Promise<Department> {
    return await api.get<Department>(`/departments/${id}`);
  },

  // 创建部门
  async create(data: {
    name: string;
    code: string;
    parentId?: number;
  }): Promise<Department> {
    return await api.post<Department>('/departments', data);
  },

  // 更新部门
  async update(id: number, data: {
    name?: string;
    code?: string;
    parentId?: number;
    status?: string;
  }): Promise<Department> {
    return await api.put<Department>(`/departments/${id}`, data);
  },

  // 删除部门
  async delete(id: number): Promise<void> {
    await api.delete(`/departments/${id}`);
  }
};
