import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../lib/asyncHandler'
import { ARCHIVED } from '../lib/archive'
import { badRequest, notFound } from '../lib/appError'
import { checkJobTypeReferences } from '../services/referenceCheck.service'

export const JobTypeCreateSchema = z.object({
  name: z.string().min(1, '名称必填').max(50),
  code: z.string().max(50).optional()
})

export const JobTypeUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  code: z.string().max(50).optional(),
  status: z.enum(['active', 'inactive']).optional()
})

export const JobTypeListQuerySchema = z.object({
  includeArchived: z.union([z.boolean(), z.string()]).optional(),
  includeDeleted: z.union([z.boolean(), z.string()]).optional()
})

const ARCHIVED_STATUSES = ['archived', 'deleted']

async function generateNextJobTypeCode(): Promise<string> {
  const last = await prisma.jobType.findFirst({
    where: { code: { startsWith: 'JT' } },
    orderBy: { code: 'desc' },
    select: { code: true }
  })
  if (!last) return 'JT001'
  const lastNum = parseInt(last.code.replace('JT', ''))
  return `JT${String(lastNum + 1).padStart(3, '0')}`
}

export const getNextCode = asyncHandler(async (_req: Request, res: Response) => {
  const nextCode = await generateNextJobTypeCode()
  res.json({ code: 0, message: '获取成功', data: nextCode })
})

export const getJobTypes = asyncHandler(async (req: Request, res: Response) => {
  const { includeArchived, includeDeleted } = req.query as any
  const showArchived =
    includeArchived === 'true' || includeArchived === true ||
    includeDeleted === 'true' || includeDeleted === true

  const where: any = {}
  if (!showArchived) {
    where.status = { notIn: ARCHIVED_STATUSES }
  }

  const jobTypes = await prisma.jobType.findMany({
    where,
    include: { employees: { where: { status: 'active' } } },
    orderBy: { createdAt: 'desc' }
  })

  res.json({ code: 0, message: '获取成功', data: jobTypes })
})

export const getJobType = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const jobType = await prisma.jobType.findUnique({
    where: { id },
    include: { employees: true }
  })
  if (!jobType) throw notFound('工种不存在')
  res.json({ code: 0, message: '获取成功', data: jobType })
})

export const createJobType = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof JobTypeCreateSchema>
  const code = data.code && data.code.trim() ? data.code : await generateNextJobTypeCode()
  const jobType = await prisma.jobType.create({
    data: { name: data.name, code, status: 'active' },
    include: { employees: true }
  })
  res.json({ code: 0, message: '创建成功', data: jobType })
})

export const updateJobType = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const data = req.body as z.infer<typeof JobTypeUpdateSchema>
  const jobType = await prisma.jobType.update({
    where: { id },
    data,
    include: { employees: true }
  })
  res.json({ code: 0, message: '更新成功', data: jobType })
})

export const deleteJobType = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.jobType.findUnique({ where: { id } })
  if (!existing) throw notFound('工种不存在')

  const blockers = await checkJobTypeReferences(id)
  if (blockers.length > 0) {
    throw badRequest('该工种有在职员工在用，无法归档', { blockers })
  }

  const jobType = await prisma.jobType.update({
    where: { id },
    data: { status: ARCHIVED }
  })
  res.json({ code: 0, message: '已归档', data: jobType })
})

export const restoreJobType = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.jobType.findUnique({ where: { id } })
  if (!existing) throw notFound('工种不存在')
  if (!ARCHIVED_STATUSES.includes(existing.status)) {
    throw badRequest('该工种未处于归档状态')
  }
  const jobType = await prisma.jobType.update({
    where: { id },
    data: { status: 'active' }
  })
  res.json({ code: 0, message: '已恢复', data: jobType })
})
