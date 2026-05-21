import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 生成退货单号
const generateReturnNo = async (): Promise<string> => {
  const today = new Date()
  const ds = today.toISOString().slice(0, 10).replace(/-/g, '')
  const n = await prisma.returnOrder.count({
    where: { createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) } }
  })
  return `RT-${ds}-${String(n + 1).padStart(3, '0')}`
}

// 退货单列表
export const getReturnOrders = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, status, startDate, endDate } = req.query
    const where: any = {}
    if (keyword) {
      where.OR = [
        { returnNo: { contains: String(keyword) } },
        { salesOrder: { orderNo: { contains: String(keyword) } } },
        { salesOrder: { partner: { name: { contains: String(keyword) } } } }
      ]
    }
    if (status) where.status = String(status)
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate as string)
      if (endDate) where.createdAt.lte = new Date(endDate as string + 'T23:59:59')
    }

    const [list, total] = await Promise.all([
      prisma.returnOrder.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize), take: Number(pageSize),
        include: {
          salesOrder: { include: { partner: true } },
          items: { include: { product: true } }
        }
      }),
      prisma.returnOrder.count({ where })
    ])
    res.json({ code: 0, message: '获取成功', data: { list, total, page: Number(page), pageSize: Number(pageSize) } })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '获取失败' })
  }
}

// 退货单详情
export const getReturnOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        salesOrder: { include: { partner: true } },
        items: { include: { product: true } }
      }
    })
    if (!order) { res.status(404).json({ code: 404, message: '退货单不存在' }); return }
    res.json({ code: 0, message: '获取成功', data: order })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '获取失败' })
  }
}

// 创建退货单（关联销货单，不改变销货单状态）
export const createReturnOrder = async (req: Request, res: Response) => {
  try {
    const { salesOrderId, items, reason, remark } = req.body
    if (!salesOrderId || !items || items.length === 0) {
      res.status(400).json({ code: 400, message: '关联销货单和退货明细不能为空' }); return
    }

    // 校验销货单存在
    const so = await prisma.salesOrder.findUnique({ where: { id: salesOrderId } })
    if (!so) { res.status(404).json({ code: 404, message: '销货单不存在' }); return }

    const returnNo = await generateReturnNo()
    const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0)

    const order = await prisma.returnOrder.create({
      data: {
        salesOrderId,
        returnNo,
        totalQuantity: totalQty,
        reason,
        remark,
        items: {
          create: items.map((i: any) => ({
            salesItemId: i.salesItemId,
            productId: i.productId,
            quantity: i.quantity
          }))
        }
      },
      include: {
        salesOrder: { include: { partner: true } },
        items: { include: { product: true } }
      }
    })

    res.json({ code: 0, message: '退货单已创建', data: order })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '创建失败' })
  }
}

// 确认退货入库（库存回加）
export const completeReturnOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.returnOrder.findUnique({
      where: { id }, include: { items: true, salesOrder: true }
    })
    if (!order) { res.status(404).json({ code: 404, message: '退货单不存在' }); return }
    if (order.status === 'completed') {
      res.status(400).json({ code: 400, message: '退货单已完成入库' }); return
    }

    await prisma.$transaction(async (tx) => {
      // 回加成品库存
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        })
        // 销货单明细回退 shippedQuantity
        await tx.salesItem.update({
          where: { id: item.salesItemId },
          data: { shippedQuantity: { decrement: item.quantity } }
        })
      }
      await tx.returnOrder.update({ where: { id }, data: { status: 'completed' } })
    })

    const updated = await prisma.returnOrder.findUnique({
      where: { id },
      include: { salesOrder: { include: { partner: true } }, items: { include: { product: true } } }
    })
    res.json({ code: 0, message: '退货入库完成，库存已回加', data: updated })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '入库失败' })
  }
}

// 取消退货：已完成的退货单回退库存，状态标记为 cancelled
export const cancelReturnOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.returnOrder.findUnique({
      where: { id }, include: { items: true }
    })
    if (!order) { res.status(404).json({ code: 404, message: '退货单不存在' }); return }
    if (order.status === 'cancelled') { res.status(400).json({ code: 400, message: '退货单已取消' }); return }
    if (order.status === 'scrapped') { res.status(400).json({ code: 400, message: '报废单不可取消' }); return }

    await prisma.$transaction(async (tx) => {
      // 如果已入库，回退库存
      if (order.status === 'completed') {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          })
          await tx.salesItem.update({
            where: { id: item.salesItemId },
            data: { shippedQuantity: { increment: item.quantity } }
          })
        }
      }
      await tx.returnOrder.update({ where: { id }, data: { status: 'cancelled' } })
    })

    const updated = await prisma.returnOrder.findUnique({
      where: { id }, include: { salesOrder: { include: { partner: true } }, items: { include: { product: true } } }
    })
    res.json({ code: 0, message: '退货已取消，数据已回退', data: updated })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '取消失败' })
  }
}

// 报废退货单：标记为 scrapped，不可再入库
export const scrapReturnOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { reason } = req.body
    const order = await prisma.returnOrder.findUnique({ where: { id } })
    if (!order) { res.status(404).json({ code: 404, message: '退货单不存在' }); return }
    if (order.status === 'completed') { res.status(400).json({ code: 400, message: '已入库的退货单不可报废' }); return }
    if (order.status === 'scrapped') { res.status(400).json({ code: 400, message: '退货单已报废' }); return }

    const updated = await prisma.returnOrder.update({
      where: { id },
      data: { status: 'scrapped', reason: reason || order.reason }
    })
    res.json({ code: 0, message: '退货单已报废，不可再入库', data: updated })
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message || '报废失败' })
  }
}
