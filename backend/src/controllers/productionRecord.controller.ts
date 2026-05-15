import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 获取生产报工列表
export const getProductionRecords = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', employeeId, productId, startDate, endDate } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (employeeId) where.employeeId = Number(employeeId)
    if (productId) where.productId = Number(productId)
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate as string)
      if (endDate) where.date.lte = new Date(endDate as string + 'T23:59:59')
    }

    const [records, total] = await Promise.all([
      prisma.productionRecord.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { employee: true, product: true, process: true }
      }),
      prisma.productionRecord.count({ where })
    ])

    res.json({ code: 0, message: '获取成功', data: { list: records, total, page: Number(page), pageSize: take } })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 获取单条
export const getProductionRecord = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const record = await prisma.productionRecord.findUnique({
      where: { id },
      include: { employee: true, product: true, process: true }
    })
    if (!record) { res.status(404).json({ code: 404, message: '记录不存在' }); return }
    res.json({ code: 0, message: '获取成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 创建生产报工（同时按 BOM 扣减原材料库存）
export const createProductionRecord = async (req: Request, res: Response) => {
  try {
    const { employeeId, productId, processId, quantity, date, remark } = req.body

    const record = await prisma.$transaction(async (tx) => {
      // 1. 创建生产报工记录
      const rec = await tx.productionRecord.create({
        data: { employeeId, productId, processId, quantity, date: new Date(date), status: 'completed', remark },
        include: { employee: true, product: true, process: true }
      })

      // 2. 按 BOM 扣减原材料库存
      const bomItems = await tx.billOfMaterial.findMany({ where: { productId } })
      for (const bom of bomItems) {
        const consumeQty = bom.quantity * quantity
        const inv = await tx.inventory.findUnique({ where: { materialId: bom.materialId } })
        if (!inv || inv.quantity < consumeQty) {
          throw new Error(`物料"${bom.materialId}"库存不足：需要 ${consumeQty}，当前 ${inv?.quantity ?? 0}`)
        }
        await tx.inventory.update({
          where: { materialId: bom.materialId },
          data: { quantity: { decrement: consumeQty }, lastUpdated: new Date() }
        })
        await tx.inventoryLog.create({
          data: {
            materialId: bom.materialId,
            type: 'out',
            quantity: consumeQty,
            referenceType: 'production',
            referenceId: rec.id,
            remark: `生产消耗 - ${rec.product.name} x${quantity}`
          }
        })
      }

      // 3. 增加成品库存
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } }
      })

      return rec
    })

    res.json({ code: 0, message: '创建成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 删除
export const deleteProductionRecord = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.productionRecord.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ code: 404, message: '记录不存在' }); return }
    await prisma.productionRecord.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}
