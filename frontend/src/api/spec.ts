import { api } from './request';

export interface ProductSpec {
  id: number;
  productId: number;
  name: string;
  code: string;
  dimensions: string;
  material: string;
  craft: string;
  difficulty: string;
  basePrice: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: number;
    name: string;
    code: string;
  };
  specPrice?: {
    id: number;
    specId: number;
    unitPrice: number;
    effectiveAt: string;
    remark?: string | null;
  };
  unitPrice?: number; // Computed from specPrice
}

export interface SpecPrice {
  id: number;
  specId: number;
  unitPrice: number;
  effectiveAt: string;
  remark?: string | null;
  createdAt: string;
}

export const specApi = {
  // 创建产品规格
  async createSpec(data: {
    productId: number;
    name: string;
    code: string;
    dimensions?: string;
    material?: string;
    craft?: string;
    difficulty?: string;
    basePrice: number;
  }): Promise<ProductSpec> {
    return await api.post<ProductSpec>('/specs', data);
  },

  // 获取产品规格列表
  async getSpecs(params?: {
    productId?: number;
    status?: string;
  }): Promise<ProductSpec[]> {
    return await api.get<ProductSpec[]>('/specs', { params });
  },

  // 获取规格详情
  async getSpec(id: number): Promise<ProductSpec> {
    return await api.get<ProductSpec>(`/specs/${id}`);
  },

  // 更新产品规格
  async updateSpec(id: number, data: {
    name?: string;
    dimensions?: string;
    material?: string;
    craft?: string;
    difficulty?: string;
    basePrice?: number;
  }): Promise<ProductSpec> {
    return await api.put<ProductSpec>(`/specs/${id}`, data);
  },

  // 删除产品规格
  async deleteSpec(id: number): Promise<void> {
    await api.delete(`/specs/${id}`);
  },

  // 重新计算单价
  async recalculatePrice(id: number): Promise<{ unitPrice: number }> {
    return await api.post<{ unitPrice: number }>(`/specs/${id}/recalculate`, {});
  }
};
