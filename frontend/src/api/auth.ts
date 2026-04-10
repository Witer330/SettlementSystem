import { api } from './request';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginData {
  token: string;
  user: {
    id: number;
    username: string;
    name: string;
    role: string;
  };
}

export interface UserProfile {
  id: number;
  username: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface UserListResponse {
  list: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const authApi = {
  // 用户登录
  async login(data: LoginRequest): Promise<LoginData> {
    return await api.post<LoginData>('/auth/login', data);
  },

  // 用户登出
  async logout(): Promise<void> {
    await api.post<void>('/auth/logout');
  },

  // 获取当前用户信息
  async getProfile(): Promise<UserProfile> {
    return await api.get<UserProfile>('/auth/profile');
  },

  // 初始化管理员
  async initAdmin(data: { username?: string; password?: string; name?: string }): Promise<any> {
    return await api.post('/auth/init-admin', data);
  },

  // 修改密码
  async changePassword(data: { oldPassword: string; newPassword: string }): Promise<void> {
    await api.post<void>('/auth/change-password', data);
  },

  // 获取用户列表
  async getUsers(params?: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    role?: string;
    status?: string;
  }): Promise<UserListResponse> {
    return await api.get<UserListResponse>('/auth/users', { params });
  },

  // 创建用户
  async createUser(data: {
    username: string;
    password: string;
    name: string;
    role: string;
    status?: string;
  }): Promise<UserProfile> {
    return await api.post<UserProfile>('/auth/users', data);
  },

  // 更新用户
  async updateUser(id: number, data: {
    username?: string;
    password?: string;
    name?: string;
    role?: string;
    status?: string;
  }): Promise<UserProfile> {
    return await api.put<UserProfile>(`/auth/users/${id}`, data);
  },

  // 删除用户
  async deleteUser(id: number): Promise<void> {
    await api.delete(`/auth/users/${id}`);
  }
};

// Token 管理
export const tokenManager = {
  getToken(): string | null {
    return localStorage.getItem('token');
  },

  setToken(token: string): void {
    localStorage.setItem('token', token);
  },

  removeToken(): void {
    localStorage.removeItem('token');
  },

  getUser(): LoginData['user'] | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser(user: LoginData['user']): void {
    localStorage.setItem('user', JSON.stringify(user));
  },

  removeUser(): void {
    localStorage.removeItem('user');
  },

  clear(): void {
    this.removeToken();
    this.removeUser();
  }
};
