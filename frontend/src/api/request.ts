import axios, { type AxiosRequestConfig } from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
axiosInstance.interceptors.response.use(
  (response) => {
    // 后端返回格式: { code, message, data }
    const { code, message, data } = response.data;

    // 如果 code 不为 0，抛出错误
    if (code !== 0) {
      throw new Error(message);
    }

    return data;
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '请求失败';

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Only redirect if not already on login page
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = '/login';
      }
    }

    throw new Error(message);
  }
);

// 创建类型化的 API 实例
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => {
    return axiosInstance.get<T>(url, config) as Promise<T>;
  },
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return axiosInstance.post<T>(url, data, config) as Promise<T>;
  },
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return axiosInstance.put<T>(url, data, config) as Promise<T>;
  },
  delete: <T>(url: string, config?: AxiosRequestConfig) => {
    return axiosInstance.delete<T>(url, config) as Promise<T>;
  }
};
