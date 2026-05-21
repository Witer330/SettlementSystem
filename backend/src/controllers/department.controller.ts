import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../lib/asyncHandler'
import { ARCHIVED } from '../lib/archive'
import { badRequest, notFound } from '../lib/appError'
import { checkDepartmentReferences } from '../services/referenceCheck.service'

export const DepartmentCreateSchema = z.object({
  name: z.string().min(1, '名称必填').max(50),
  code: z.string().min(1, '编码必填').max(50),
  parentId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number), z.null()]).optional()
})

export const DepartmentUpdateSchema = DepartmentCreateSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
})

export const DepartmentListQuerySchema = z.object({
  includeArchived: z.union([z.boolean(), z.string()]).optional(),
  includeDeleted: z.union([z.boolean(), z.string()]).optional() // 兼容旧参数
})

const ARCHIVED_STATUSES = ['archived', 'deleted']

export const getDepartments = asyncHandler(async (req: Request, res: Response) => {
  const { includeArchived, includeDeleted } = req.query as any
  const showArchived =
    includeArchived === 'true' || includeArchived === true ||
    includeDeleted === 'true' || includeDeleted === true

  const where: any = {}
  if (!showArchived) {
    where.status = { notIn: ARCHIVED_STATUSES }
  }

  const departments = await prisma.department.findMany({
    where,
    include: { employees: { where: { status: 'active' } } },
    orderBy: { createdAt: 'desc' }
  })

  res.json({ code: 0, message: '获取成功', data: departments })
})

export const getDepartment = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const department = await prisma.department.findUnique({
    where: { id },
    include: { employees: true }
  })
  if (!department) throw notFound('部门不存在')
  res.json({ code: 0, message: '获取成功', data: department })
})

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof DepartmentCreateSchema>
  const department = await prisma.department.create({
    data: {
      name: data.name,
      code: data.code,
      parentId: data.parentId ?? null,
      status: 'active'
    },
    include: { employees: true }
  })
  res.json({ code: 0, message: '创建成功', data: department })
})

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const data = req.body as z.infer<typeof DepartmentUpdateSchema>
  const department = await prisma.department.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId ?? null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {})
    },
    include: { employees: true }
  })
  res.json({ code: 0, message: '更新成功', data: department })
})

export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.department.findUnique({ where: { id } })
  if (!existing) throw notFound('部门不存在')

  const blockers = await checkDepartmentReferences(id)
  if (blockers.length > 0) {
    throw badRequest('部门下存在在职员工，无法归档', { blockers })
  }

  const department = await prisma.department.update({
    where: { id },
    data: { status: ARCHIVED }
  })
  res.json({ code: 0, message: '已归档', data: department })
})

export const restoreDepartment = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.department.findUnique({ where: { id } })
  if (!existing) throw notFound('部门不存在')
  if (!ARCHIVED_STATUSES.includes(existing.status)) {
    throw badRequest('该部门未处于归档状态')
  }
  const department = await prisma.department.update({
    where: { id },
    data: { status: 'active' }
  })
  res.json({ code: 0, message: '已恢复', data: department })
})
