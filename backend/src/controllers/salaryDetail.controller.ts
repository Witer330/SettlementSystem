import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

function generateSheetNo(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `SD-${d}-${String(Date.now() % 100000).padStart(5, '0')}`
}

// 明细单列表
export const getSheets = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, status, employeeId, type, startDate, endDate } = req.query
    const where: any = {}
    if (status) where.status = String(status)
    if (startDate || endDate) {
      where.batchDate = {}
      if (startDate) where.batchDate.gte = new Date(String(startDate))
      if (endDate) where.batchDate.lte = new Date(String(endDate))
    }
    if (employeeId || type) {
      where.items = { some: {} }
      if (employeeId) where.items.some.employeeId = Number(employeeId)
      if (type) where.items.some.type = String(type)
    }

    const [list, total] = await Promise.all([
      prisma.salaryDetailSheet.findMany({
        where, orderBy: { batchDate: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize), take: Number(pageSize),
        include: { items: { include: { employee: true, product: true } } }
      }),
      prisma.salaryDetailSheet.count({ where })
    ])
    res.json({ code: 0, message: '获取成功', data: { list, total, page: Number(page), pageSize: Number(pageSize) } })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '获取失败' })
  }
}

// 单个明细单
export const getSheet = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const sheet = await prisma.salaryDetailSheet.findUnique({
      where: { id },
      include: { items: { include: { employee: true, product: true } } }
    })
    if (!sheet) { res.status(404).json({ code: 404, message: '明细单不存在' }); return }
    res.json({ code: 0, message: '获取成功', data: sheet })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '获取失败' })
  }
}

// 创建明细单
export const createSheet = async (req: Request, res: Response) => {
  try {
    const { items, batchDate, remark, creator } = req.body
    if (!items || items.length === 0) {
      res.status(400).json({ code: 400, message: '明细不能为空' }); return
    }
    const sheet = await prisma.salaryDetailSheet.create({
      data: {
        sheetNo: generateSheetNo(),
        batchDate: batchDate ? new Date(batchDate) : new Date(),
        creator: creator || '系统',
        remark,
        items: { create: items.map((i: any) => ({
          employeeId: i.employeeId,
          type: i.type,
          date: new Date(i.date),
          productId: i.productId || null,
          quantity: i.quantity || null,
          unitPrice: i.unitPrice || null,
          hours: i.hours || null,
          amount: i.amount || 0,
          remark: i.remark
        })) }
      },
      include: { items: { include: { employee: true, product: true } } }
    })
    res.json({ code: 0, message: '创建成功', data: sheet })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '创建失败' })
  }
}

// 更新明细单
export const updateSheet = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.salaryDetailSheet.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ code: 404, message: '明细单不存在' }); return }
    if (existing.status !== 'draft') { res.status(400).json({ code: 400, message: '已审核的明细单不可编辑，请先反审' }); return }

    const { items, batchDate, remark } = req.body
    await prisma.salaryDetailItem.deleteMany({ where: { sheetId: id } })
    const sheet = await prisma.salaryDetailSheet.update({
      where: { id },
      data: {
        batchDate: batchDate ? new Date(batchDate) : undefined,
        remark,
        items: { create: (items || []).map((i: any) => ({
          employeeId: i.employeeId, type: i.type, date: new Date(i.date),
          productId: i.productId || null, quantity: i.quantity || null,
          unitPrice: i.unitPrice || null, hours: i.hours || null,
          amount: i.amount || 0, remark: i.remark
        })) }
      },
      include: { items: { include: { employee: true, product: true } } }
    })
    res.json({ code: 0, message: '更新成功', data: sheet })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '更新失败' })
  }
}

// 审核
export const approveSheet = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const sheet = await prisma.salaryDetailSheet.update({
      where: { id }, data: { status: 'approved' }
    })
    res.json({ code: 0, message: '已审核', data: sheet })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '审核失败' })
  }
}

// 反审
export const unapproveSheet = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    // 检查是否被核算单引用
    const ref = await prisma.salaryBillDetail.findFirst({
      where: { sourceSheetId: id, bill: { status: { not: 'voided' } } }
    })
    if (ref) { res.status(400).json({ code: 400, message: '已被核算单引用，请先作废关联的核算单' }); return }
    const sheet = await prisma.salaryDetailSheet.update({
      where: { id }, data: { status: 'draft' }
    })
    res.json({ code: 0, message: '已反审', data: sheet })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '反审失败' })
  }
}

// 获取已审核的明细项（供核算单选择）
export const getApprovedItems = async (req: Request, res: Response) => {
  try {
    const { employeeId, startDate, endDate } = req.query
    const where: any = { sheet: { status: 'approved' } }
    if (employeeId) where.employeeId = Number(employeeId)
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(String(startDate))
      if (endDate) where.date.lte = new Date(String(endDate))
    }
    const items = await prisma.salaryDetailItem.findMany({
      where, orderBy: { date: 'asc' },
      include: { employee: true, product: true, sheet: { select: { id: true, sheetNo: true, batchDate: true } } }
    })
    res.json({ code: 0, message: '获取成功', data: items })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '获取失败' })
  }
}
