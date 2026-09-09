import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../lib/asyncHandler'
import { ARCHIVED, buildArchivedFilter } from '../lib/archive'
import { badRequest, notFound } from '../lib/appError'
import { checkMaterialReferences, isMaterialBlockerHard } from '../services/referenceCheck.service'

export const MaterialCreateSchema = z.object({
  name: z.string().min(1, '物料名称必填').max(100),
  code: z.string().min(1, '物料编码必填').max(50),
  category: z.string().min(1, '分类必填').max(50),
  unit: z.string().min(1, '单位必填').max(10),
  defaultUnit: z.string().max(20).optional().nullable(),
  specification: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  safeStock: z.number().min(0).default(0)
})

export const MaterialUpdateSchema = MaterialCreateSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
})

export const MaterialListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  keyword: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  includeArchived: z.union([z.boolean(), z.string()]).optional()
})

export const getMaterials = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, keyword, category, status, includeArchived } = req.query as any
  const where: any = {}
  if (keyword) {
    where.OR = [
      { name: { contains: String(keyword) } },
      { code: { contains: String(keyword) } }
    ]
  }
  if (category) where.category = String(category)
  if (status) {
    where.status = status
  } else {
    const filter = buildArchivedFilter(includeArchived)
    if (filter) where.status = filter
  }

  const p = Number(page) || 1
  const ps = Number(pageSize) || 20

  const [list, total] = await Promise.all([
    prisma.material.findMany({ where, skip: (p - 1) * ps, take: ps, orderBy: { createdAt: 'desc' } }),
    prisma.material.count({ where })
  ])

  res.json({
    code: 0,
    message: '获取成功',
    data: { list, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) }
  })
})

export const getMaterial = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const material = await prisma.material.findUnique({ where: { id } })
  if (!material) throw notFound('物料不存在')
  res.json({ code: 0, message: '获取成功', data: material })
})

export const createMaterial = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof MaterialCreateSchema>
  const material = await prisma.material.create({ data })
  res.json({ code: 0, message: '创建成功', data: material })
})

export const updateMaterial = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const data = req.body as z.infer<typeof MaterialUpdateSchema>
  const material = await prisma.material.update({ where: { id }, data })
  res.json({ code: 0, message: '更新成功', data: material })
})

export const deleteMaterial = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const all = await checkMaterialReferences(id)
  const hardBlockers = all.filter(isMaterialBlockerHard)
  if (hardBlockers.length > 0) {
    throw badRequest('该物料存在关联数据，无法归档', { blockers: all })
  }
  const material = await prisma.material.update({
    where: { id },
    data: { status: ARCHIVED }
  })
  res.json({ code: 0, message: '已归档', data: material })
})

export const restoreMaterial = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.material.findUnique({ where: { id } })
  if (!existing) throw notFound('物料不存在')
  if (existing.status !== ARCHIVED) {
    throw badRequest('该物料未处于归档状态')
  }
  const material = await prisma.material.update({
    where: { id },
    data: { status: 'active' }
  })
  res.json({ code: 0, message: '已恢复', data: material })
})
