import { Prisma } from '@prisma/client'

export interface MappedError {
  status: number
  code: number
  message: string
  data?: any
}

export function mapPrismaError(err: unknown): MappedError | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null

  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string[] | undefined)?.join('、') || '字段'
      return {
        status: 409,
        code: 409,
        message: `${target} 已存在，不能重复`,
        data: { fields: err.meta?.target }
      }
    }
    case 'P2003': {
      return {
        status: 400,
        code: 400,
        message: '存在关联数据，无法删除或修改',
        data: { field: err.meta?.field_name }
      }
    }
    case 'P2025': {
      return {
        status: 404,
        code: 404,
        message: '记录不存在或已被删除'
      }
    }
    case 'P2014': {
      return {
        status: 400,
        code: 400,
        message: '违反关联约束'
      }
    }
    default:
      return null
  }
}
