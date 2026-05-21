import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/appError'
import { mapPrismaError } from '../lib/prismaError'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      data: err.data
    })
  }

  if (err instanceof ZodError) {
    const issues = err.issues
    const detail = issues.map(e => `${e.path.join('.') || '字段'}: ${e.message}`).join('；')
    return res.status(400).json({
      code: 400,
      message: `参数错误：${detail}`,
      data: { issues }
    })
  }

  const mapped = mapPrismaError(err)
  if (mapped) {
    return res.status(mapped.status).json({
      code: mapped.code,
      message: mapped.message,
      data: mapped.data ?? null
    })
  }

  console.error('[Unhandled Error]', err)
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误',
    data: null
  })
}
