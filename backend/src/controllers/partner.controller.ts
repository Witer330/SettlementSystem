import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../lib/asyncHandler'
import { ARCHIVED, buildArchivedFilter } from '../lib/archive'
import { badRequest, notFound } from '../lib/appError'
import { checkPartnerReferences } from '../services/referenceCheck.service'

// ============ Zod Schemas ============
const PartnerBaseSchema = z.object({
  name: z.string().min(1, '名称必填').max(100),
  code: z.string().min(1, '编码必填').max(50),
  contact: z.string().max(50).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  isCustomer: z.boolean().default(false),
  isSupplier: z.boolean().default(false),
  creditLimit: z.number().min(0).default(0)
})

export const PartnerCreateSchema = PartnerBaseSchema.refine(
  d => d.isCustomer || d.isSupplier,
  { message: '至少选择一种身份（客户或供应商）' }
)

export const PartnerUpdateSchema = PartnerBaseSchema.partial()
  .extend({ status: z.enum(['active', 'inactive']).optional() })
  .refine(
    d => {
      // 更新时若同时显式传了两个字段且都为 false，则拒绝
      if (d.isCustomer === false && d.isSupplier === false) return false
      return true
    },
    { message: '至少保留一种身份（客户或供应商）' }
  )

export const PartnerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(2000).default(20),
  keyword: z.string().optional(),
  status: z.string().optional(),
  isCustomer: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(v => (v === undefined ? undefined : v === true || v === 'true')),
  isSupplier: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(v => (v === undefined ? undefined : v === true || v === 'true')),
  includeArchived: z.union([z.boolean(), z.string()]).optional()
})

// ============ Controllers ============
export const getPartners = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, keyword, status, isCustomer, isSupplier, includeArchived } = req.query as any
  const where: any = {}

  if (keyword) {
    where.OR = [
      { name: { contains: String(keyword) } },
      { code: { contains: String(keyword) } },
      { contact: { contains: String(keyword) } }
    ]
  }
  if (status) {
    where.status = status
  } else {
    const filter = buildArchivedFilter(includeArchived)
    if (filter) where.status = filter
  }
  if (isCustomer === true) where.isCustomer = true
  if (isSupplier === true) where.isSupplier = true

  const p = Number(page) || 1
  const ps = Number(pageSize) || 20

  const [list, total] = await Promise.all([
    prisma.partner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (p - 1) * ps,
      take: ps
    }),
    prisma.partner.count({ where })
  ])

  res.json({
    code: 0,
    message: '获取成功',
    data: { list, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) }
  })
})

export const getPartner = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const partner = await prisma.partner.findUnique({ where: { id } })
  if (!partner) throw notFound('往来单位不存在')
  res.json({ code: 0, message: '获取成功', data: partner })
})

export const createPartner = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof PartnerCreateSchema>
  const partner = await prisma.partner.create({
    data: { ...data, status: 'active' }
  })
  res.json({ code: 0, message: '创建成功', data: partner })
})

export const updatePartner = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const data = req.body as z.infer<typeof PartnerUpdateSchema>

  const existing = await prisma.partner.findUnique({ where: { id } })
  if (!existing) throw notFound('往来单位不存在')

  // 取消身份的关联检查：若把 isCustomer 从 true 改为 false，需确认无销售侧引用
  if (existing.isCustomer && data.isCustomer === false) {
    const blockers = await checkPartnerReferences(id, 'customer')
    if (blockers.length > 0) {
      throw badRequest('该往来单位有销售/应收引用，无法取消「客户」身份', { blockers })
    }
  }
  if (existing.isSupplier && data.isSupplier === false) {
    const blockers = await checkPartnerReferences(id, 'supplier')
    if (blockers.length > 0) {
      throw badRequest('该往来单位有采购/应付引用，无法取消「供应商」身份', { blockers })
    }
  }

  const partner = await prisma.partner.update({ where: { id }, data })
  res.json({ code: 0, message: '更新成功', data: partner })
})

export const deletePartner = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const blockers = await checkPartnerReferences(id, 'both')
  if (blockers.length > 0) {
    throw badRequest('该往来单位存在关联数据，无法归档', { blockers })
  }
  const partner = await prisma.partner.update({
    where: { id },
    data: { status: ARCHIVED }
  })
  res.json({ code: 0, message: '已归档', data: partner })
})

export const restorePartner = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.partner.findUnique({ where: { id } })
  if (!existing) throw notFound('往来单位不存在')
  if (existing.status !== ARCHIVED) {
    throw badRequest('该往来单位未处于归档状态')
  }
  const partner = await prisma.partner.update({
    where: { id },
    data: { status: 'active' }
  })
  res.json({ code: 0, message: '已恢复', data: partner })
})
