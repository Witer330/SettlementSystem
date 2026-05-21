import axios, { type AxiosRequestConfig } from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// 业务异常类型 — 携带后端返回的 code/data/blockers，便于 UI 友好提示
export class ApiError extends Error {
  code: number
  data: any
  blockers?: Array<{ type: string; count: number }>

  constructor(message: string, code: number, data: any) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
    this.blockers = data?.blockers
  }
}

// 创建 axios 实例
const axiosInstance = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api/v1` : '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle errors
axiosInstance.interceptors.response.use(
  (response) => {
    // 后端返回格式: { code, message, data }
    const { code, message, data } = response.data

    // 如果 code 不为 0，抛出业务异常
    if (code !== 0) {
      throw new ApiError(message, code, data)
    }

    return data
  },
  (error) => {
    const respData = error.response?.data
    const message = respData?.message || error.message || '请求失败'

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      // Clear local storage
      localStorage.removeItem('token')
      localStorage.removeItem('user')

      // Only redirect if not already on login page
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = '/login'
      }
    }

    throw new ApiError(message, respData?.code ?? error.response?.status ?? -1, respData?.data ?? null)
  }
)

// 创建类型化的 API 实例
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => {
    return axiosInstance.get<T>(url, config) as Promise<T>
  },
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return axiosInstance.post<T>(url, data, config) as Promise<T>
  },
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return axiosInstance.put<T>(url, data, config) as Promise<T>
  },
  patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
    return axiosInstance.patch<T>(url, data, config) as Promise<T>
  },
  delete: <T>(url: string, config?: AxiosRequestConfig) => {
    return axiosInstance.delete<T>(url, config) as Promise<T>
  }
}
