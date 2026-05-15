import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

export const createDailyRecord = async (req: Request, res: Response) => {
  try {
    const { employeeId, date, items, remark } = req.body

    let totalAmount = 0
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) {
        return res.status(404).json({ code: 404, message: `产品ID ${item.productId} 不存在`, data: null })
      }
      const unitPrice = item.unitPrice ?? product.price
      item.unitPrice = unitPrice
      item.amount = item.quantity * unitPrice
      totalAmount += item.amount
    }

    const record = await prisma.dailyPieceRecord.create({
      data: {
        employeeId,
        date: new Date(date),
        totalAmount,
        remark,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount
          }))
        }
      },
      include: { employee: true, items: { include: { product: true } } }
    })

    res.json({ code: 0, message: '创建成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败', data: null })
  }
}

export const getDailyRecords = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, employeeId, date, startDate, endDate } = req.query
    const where: any = {}
    if (employeeId) where.employeeId = parseInt(employeeId as string)
    if (date) {
      const d = new Date(date as string)
      where.date = { gte: d, lt: new Date(d.getTime() + 86400000) }
    }
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate as string), lte: new Date(endDate as string) }
    }

    const [list, total] = await Promise.all([
      prisma.dailyPieceRecord.findMany({
        where,
        include: { employee: true, items: { include: { product: true } } },
        orderBy: { date: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize)
      }),
      prisma.dailyPieceRecord.count({ where })
    ])

    res.json({ code: 0, message: '获取成功', data: { list, total, page: Number(page), pageSize: Number(pageSize) } })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败', data: null })
  }
}

export const getDailyRecord = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const record = await prisma.dailyPieceRecord.findUnique({
      where: { id },
      include: { employee: true, items: { include: { product: true } } }
    })
    if (!record) { res.status(404).json({ code: 404, message: '记录不存在', data: null }); return }
    res.json({ code: 0, message: '获取成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败', data: null })
  }
}

export const updateDailyRecord = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { items, remark } = req.body

    await prisma.dailyPieceRecordItem.deleteMany({ where: { recordId: id } })

    let totalAmount = 0
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      const unitPrice = item.unitPrice ?? product?.price ?? 0
      const amount = item.quantity * unitPrice
      totalAmount += amount
    }

    const record = await prisma.dailyPieceRecord.update({
      where: { id },
      data: {
        totalAmount,
        remark,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? 0,
            amount: item.quantity * (item.unitPrice ?? 0)
          }))
        }
      },
      include: { employee: true, items: { include: { product: true } } }
    })

    res.json({ code: 0, message: '更新成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败', data: null })
  }
}

export const deleteDailyRecord = async (req: Request, res: Response) => {
  try {
    await prisma.dailyPieceRecord.delete({ where: { id: Number(req.params.id) } })
    res.json({ code: 0, message: '删除成功', data: null })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败', data: null })
  }
}

export const getMonthlySummary = async (req: Request, res: Response) => {
  try {
    const employeeId = Number(req.params.employeeId)
    const [year, month] = String(req.params.period).split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const records = await prisma.dailyPieceRecord.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate } },
      include: { items: { include: { product: true } } },
      orderBy: { date: 'asc' }
    })

    let totalAmount = 0; let totalCount = 0
    const productSummary: Record<string, any> = {}
    for (const r of records) {
      totalAmount += r.totalAmount
      for (const item of r.items) {
        totalCount += item.quantity
        const key = item.product.name
        if (!productSummary[key]) productSummary[key] = { productName: item.product.name, quantity: 0, amount: 0 }
        productSummary[key].quantity += item.quantity
        productSummary[key].amount += item.amount
      }
    }

    res.json({ code: 0, message: '获取成功', data: { records, summary: { totalAmount, totalCount, productSummary: Object.values(productSummary) } } })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败', data: null })
  }
}
