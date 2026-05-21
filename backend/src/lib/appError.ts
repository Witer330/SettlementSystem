export class AppError extends Error {
  status: number
  code: number
  data: any

  constructor(status: number, message: string, data: any = null, code?: number) {
    super(message)
    this.status = status
    this.code = code ?? status
    this.data = data
  }
}

export const badRequest = (message: string, data: any = null) => new AppError(400, message, data)
export const conflict = (message: string, data: any = null) => new AppError(409, message, data)
export const notFound = (message: string = '记录不存在') => new AppError(404, message)
