import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../lib/asyncHandler'
import { ARCHIVED, buildArchivedFilter } from '../lib/archive'
import { badRequest, notFound } from '../lib/appError'
import { checkProductReferences } from '../services/referenceCheck.service'

// ============ Zod Schemas ============
export const ProductCreateSchema = z.object({
  name: z.string().min(1, '产品名称必填').max(100),
  code: z.string().min(1, '产品编码必填').max(50),
  category: z.string().min(1, '分类必填').max(50),
  unit: z.string().min(1, '单位必填').max(10),
  defaultUnit: z.string().max(20).optional().nullable(),
  specification: z.string().max(100).optional().nullable(),
  price: z.number().min(0).default(0),
  unitPrice: z.number().min(0).default(0),
  safeStock: z.number().min(0).default(0)
})

export const ProductUpdateSchema = ProductCreateSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
})

export const ProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  keyword: z.string().optional(),
  status: z.string().optional(),
  includeArchived: z.union([z.boolean(), z.string()]).optional()
})

// ============ Controllers ============
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, keyword, status, includeArchived } = req.query as any
  const where: any = {}
  if (keyword) {
    where.OR = [
      { name: { contains: String(keyword) } },
      { code: { contains: String(keyword) } }
    ]
  }
  if (status) {
    where.status = status
  } else {
    const filter = buildArchivedFilter(includeArchived)
    if (filter) where.status = filter
  }

  const p = Number(page) || 1
  const ps = Number(pageSize) || 20

  const [list, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (p - 1) * ps,
      take: ps
    }),
    prisma.product.count({ where })
  ])

  res.json({
    code: 0,
    message: '获取成功',
    data: { list, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) }
  })
})

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw notFound('产品不存在')
  res.json({ code: 0, message: '获取成功', data: product })
})

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof ProductCreateSchema>
  const product = await prisma.product.create({
    data: { ...data, status: 'active' }
  })
  res.json({ code: 0, message: '创建成功', data: product })
})

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const data = req.body as z.infer<typeof ProductUpdateSchema>
  const product = await prisma.product.update({ where: { id }, data })
  res.json({ code: 0, message: '更新成功', data: product })
})

// 删除 = 归档（软删除），需关联检查
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const blockers = await checkProductReferences(id)
  if (blockers.length > 0) {
    throw badRequest('该产品存在关联数据，无法归档', { blockers })
  }
  const product = await prisma.product.update({
    where: { id },
    data: { status: ARCHIVED }
  })
  res.json({ code: 0, message: '已归档', data: product })
})

export const restoreProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) throw notFound('产品不存在')
  if (existing.status !== ARCHIVED) {
    throw badRequest('该产品未处于归档状态')
  }
  const product = await prisma.product.update({
    where: { id },
    data: { status: 'active' }
  })
  res.json({ code: 0, message: '已恢复', data: product })
})
