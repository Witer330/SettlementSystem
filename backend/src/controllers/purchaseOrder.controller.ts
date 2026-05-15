import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 生成采购单号
const generateOrderNo = async (): Promise<string> => {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.purchaseOrder.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
      }
    }
  })
  return `PO-${dateStr}-${String(count + 1).padStart(3, '0')}`
}

// 获取采购单列表
export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, status } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (keyword) {
      where.OR = [
        { orderNo: { contains: String(keyword) } },
        { supplier: { name: { contains: String(keyword) } } }
      ]
    }
    if (status) where.status = String(status)

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { supplier: true, items: { include: { material: true } } }
      }),
      prisma.purchaseOrder.count({ where })
    ])

    res.json({
      code: 0,
      message: '获取成功',
      data: { list: orders, total, page: Number(page), pageSize: take }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 获取单个采购单
export const getPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { material: true } } }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '采购单不存在' })
      return
    }
    res.json({ code: 0, message: '获取成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 创建采购单
export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { supplierId, items, remark, status: reqStatus, reserveInventory } = req.body
    const isDraft = reqStatus === 'draft'

    // 草稿：跳过必填校验
    if (!isDraft && (!supplierId || !items || items.length === 0)) {
      res.status(400).json({ code: 400, message: '供应商和采购明细不能为空' })
      return
    }

    const orderNo = isDraft
      ? `DRAFT-PO-${Date.now()}`
      : await generateOrderNo()
    const totalAmount = items
      ? items.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0)
      : 0

    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId: supplierId || null,
        orderNo,
        totalAmount,
        status: isDraft ? 'draft' : 'pending',
        remark,
        reserveInventory: reserveInventory !== undefined ? reserveInventory : true,
        ...(items && items.length > 0 && {
          items: {
            create: items.map((item: any) => ({
              materialId: item.materialId,
              quantity: item.quantity,
              price: item.price
            }))
          }
        })
      },
      include: { supplier: true, items: { include: { material: true } } }
    })

    res.json({ code: 0, message: isDraft ? '草稿已保存' : '创建成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 更新采购单
export const updatePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { supplierId, items, remark, status, reserveInventory } = req.body

    const existing = await prisma.purchaseOrder.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '采购单不存在' })
      return
    }

    // 草稿转正式：生成正式单号
    const isDraftToPending = existing.status === 'draft' && status === 'pending'
    const finalOrderNo = isDraftToPending ? await generateOrderNo() : undefined

    const totalAmount = items
      ? items.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0)
      : existing.totalAmount

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(supplierId !== undefined && { supplierId: supplierId || null }),
        ...(finalOrderNo && { orderNo: finalOrderNo }),
        totalAmount,
        remark,
        ...(reserveInventory !== undefined && { reserveInventory }),
        ...(status && { status }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              materialId: item.materialId,
              quantity: item.quantity,
              price: item.price
            }))
          }
        })
      },
      include: { supplier: true, items: { include: { material: true } } }
    })

    res.json({ code: 0, message: '更新成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 删除采购单
export const deletePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '采购单不存在' })
      return
    }

    await prisma.purchaseOrder.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}

// 更新采购单状态
export const updatePurchaseOrderStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status }
    })

    res.json({ code: 0, message: '状态更新成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 采购入库
export const receivePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { items } = req.body // [{ itemId, receivedQuantity }]

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '采购单不存在' })
      return
    }

    // 更新已收数量
    for (const item of items) {
      await prisma.purchaseItem.update({
        where: { id: item.itemId },
        data: { receivedQuantity: item.receivedQuantity }
      })

      // 增加库存
      const purchaseItem = order.items.find(i => i.id === item.itemId)
      if (purchaseItem) {
        const delta = item.receivedQuantity - purchaseItem.receivedQuantity
        if (delta > 0) {
          await prisma.inventory.upsert({
            where: { materialId: purchaseItem.materialId },
            update: { quantity: { increment: delta } },
            create: { materialId: purchaseItem.materialId, quantity: delta }
          })

          // 记录库存变动
          await prisma.inventoryLog.create({
            data: {
              materialId: purchaseItem.materialId,
              type: 'in',
              quantity: delta,
              relatedType: 'purchase',
              relatedId: id,
              remark: `采购入库 ${order.orderNo}`
            }
          })
        }
      }
    }

    // 检查是否全部收完，更新状态
    const updatedOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    })
    const allReceived = updatedOrder!.items.every(i => i.receivedQuantity >= i.quantity)
    if (allReceived) {
      await prisma.purchaseOrder.update({ where: { id }, data: { status: 'completed' } })
    }

    const result = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { material: true } } }
    })

    res.json({ code: 0, message: '入库成功', data: result })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '入库失败' })
  }
}
