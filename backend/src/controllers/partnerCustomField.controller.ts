import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../lib/asyncHandler'
import { notFound } from '../lib/appError'

// ============ Zod Schemas ============
const CustomFieldSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'key 须以字母开头，仅含字母数字下划线'),
  label: z.string().min(1).max(50),
  type: z.enum(['input', 'number', 'select', 'textarea']).default('input'),
  options: z.string().optional().nullable()
})

const CustomFieldUpdateSchema = CustomFieldSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
})

const CustomFieldValuesSchema = z.object({
  values: z.array(z.object({
    fieldId: z.number().int(),
    value: z.string().optional().nullable()
  }))
})

// ============ Controllers ============
export const getCustomFields = asyncHandler(async (_req: Request, res: Response) => {
  const list = await prisma.partnerCustomField.findMany({
    where: { status: 'active' },
    orderBy: { orderBy: 'asc' }
  })
  res.json({ code: 0, message: '获取成功', data: list })
})

export const createCustomField = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof CustomFieldSchema>
  const field = await prisma.partnerCustomField.create({ data })
  res.json({ code: 0, message: '创建成功', data: field })
})

export const updateCustomField = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.partnerCustomField.findUnique({ where: { id } })
  if (!existing) throw notFound('自定义字段不存在')
  const data = req.body as z.infer<typeof CustomFieldUpdateSchema>
  const field = await prisma.partnerCustomField.update({ where: { id }, data })
  res.json({ code: 0, message: '更新成功', data: field })
})

export const deleteCustomField = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const existing = await prisma.partnerCustomField.findUnique({ where: { id } })
  if (!existing) throw notFound('自定义字段不存在')
  await prisma.partnerCustomField.delete({ where: { id } })
  res.json({ code: 0, message: '已删除' })
})

export const updateCustomFieldValues = asyncHandler(async (req: Request, res: Response) => {
  const partnerId = Number(req.params.partnerId)
  const { values } = req.body as z.infer<typeof CustomFieldValuesSchema>

  await prisma.$transaction(async (tx) => {
    // 删除该 Partner 已有的所有自定义字段值
    await tx.partnerCustomFieldValue.deleteMany({ where: { partnerId } })
    // 批量插入新值，跳过空值
    const toCreate = values.filter(v => v.value !== null && v.value !== undefined && v.value !== '')
    if (toCreate.length > 0) {
      await tx.partnerCustomFieldValue.createMany({ data: toCreate.map(v => ({ partnerId, fieldId: v.fieldId, value: v.value })) })
    }
  })

  // 返回最新值
  const result = await prisma.partnerCustomFieldValue.findMany({
    where: { partnerId },
    include: { field: true }
  })
  res.json({ code: 0, message: '保存成功', data: result })
})
