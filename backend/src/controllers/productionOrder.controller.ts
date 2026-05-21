import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 生成生产工单号
const generateOrderNo = async (): Promise<string> => {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.productionOrder.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
      }
    }
  })
  return `PRD-${dateStr}-${String(count + 1).padStart(3, '0')}`
}

// 获取生产工单列表
export const getProductionOrders = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, status, productId } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (keyword) {
      where.OR = [
        { orderNo: { contains: String(keyword) } },
        { product: { name: { contains: String(keyword) } } }
      ]
    }
    if (status) where.status = String(status)
    if (productId) where.productId = Number(productId)

    const [list, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          salesOrder: {
            include: {
              partner: true,
              productionOrders: {
                where: { status: { not: 'cancelled' } },
                select: { quantity: true, producedQuantity: true, status: true }
              }
            }
          },
          pickingItems: { include: { material: true } }
        }
      }),
      prisma.productionOrder.count({ where })
    ])

    res.json({
      code: 0,
      message: '获取成功',
      data: { list, total, page: Number(page), pageSize: take }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 获取单个生产工单
export const getProductionOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: true,
        salesOrder: { include: { partner: true, items: { include: { product: true } } } },
        pickingItems: { include: { material: true } },
        dailyRecords: { include: { employee: true, items: { include: { product: true } } } }
      }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '生产工单不存在' })
      return
    }
    res.json({ code: 0, message: '获取成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 创建生产工单
export const createProductionOrder = async (req: Request, res: Response) => {
  try {
    const { salesOrderId, productId, quantity, startDate, remark } = req.body

    if (!productId || !quantity || quantity <= 0) {
      res.status(400).json({ code: 400, message: '产品和计划数量不能为空' })
      return
    }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      res.status(404).json({ code: 404, message: '产品不存在' })
      return
    }

    const orderNo = await generateOrderNo()

    const order = await prisma.productionOrder.create({
      data: {
        orderNo,
        salesOrderId: salesOrderId || null,
        productId,
        quantity,
        startDate: startDate ? new Date(startDate) : null,
        remark,
        status: 'pending'
      },
      include: {
        product: true,
        salesOrder: { include: { partner: true } }
      }
    })

    res.json({ code: 0, message: '创建成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 更新生产工单
export const updateProductionOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.productionOrder.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '生产工单不存在' })
      return
    }
    if (existing.status !== 'pending') {
      res.status(400).json({ code: 400, message: '仅可编辑待生产状态的工单' })
      return
    }

    const { productId, quantity, startDate, endDate, remark } = req.body
    const data: any = {}
    if (productId !== undefined) data.productId = productId
    if (quantity !== undefined) data.quantity = quantity
    if (startDate !== undefined) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = new Date(endDate)
    if (remark !== undefined) data.remark = remark

    const order = await prisma.productionOrder.update({
      where: { id },
      data,
      include: {
        product: true,
        salesOrder: { include: { partner: true } },
        pickingItems: { include: { material: true } }
      }
    })

    res.json({ code: 0, message: '更新成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 删除生产工单
export const deleteProductionOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.productionOrder.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '生产工单不存在' })
      return
    }
    if (existing.status !== 'pending' && existing.status !== 'cancelled') {
      res.status(400).json({ code: 400, message: '仅可删除待生产或已取消的工单' })
      return
    }

    await prisma.productionOrder.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}

// 从BOM生成领料项
export const generatePickingItems = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: { product: true, pickingItems: true }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '生产工单不存在' })
      return
    }

    // 获取BOM
    const bomItems = await prisma.billOfMaterial.findMany({
      where: { productId: order.productId },
      include: { material: true }
    })

    if (bomItems.length === 0) {
      res.status(400).json({ code: 400, message: '该产品尚未配置BOM，请先配置物料清单' })
      return
    }

    // 删除旧领料项，根据BOM生成新的
    await prisma.productionPickingItem.deleteMany({ where: { orderId: id } })

    const items = await Promise.all(
      bomItems.map(bom =>
        prisma.productionPickingItem.create({
          data: {
            orderId: id,
            materialId: bom.materialId,
            plannedQty: bom.quantity * order.quantity
          },
          include: { material: true }
        })
      )
    )

    // 重新生成后清除过期标记
    await prisma.productionOrder.update({
      where: { id },
      data: { pickingStale: false }
    })

    res.json({ code: 0, message: '领料项已生成', data: items })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '生成失败' })
  }
}

// 领料出库
export const pickMaterials = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { items } = req.body

    if (!items || items.length === 0) {
      res.status(400).json({ code: 400, message: '领料明细不能为空' })
      return
    }

    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: { pickingItems: { include: { material: true } } }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '生产工单不存在' })
      return
    }
    if (order.status !== 'pending' && order.status !== 'processing') {
      res.status(400).json({ code: 400, message: '当前状态不可领料' })
      return
    }

    // 在事务中扣减库存并记录日志
    const result = await prisma.$transaction(async (tx) => {
      const results: any[] = []

      for (const item of items) {
        const pickingItem = await tx.productionPickingItem.findUnique({
          where: { id: item.itemId },
          include: { material: true }
        })
        if (!pickingItem) {
          throw new Error(`领料项 ${item.itemId} 不存在`)
        }

        const pickedQty = Number(item.pickedQty)
        if (pickedQty <= 0) continue

        // 校验领料不超过计划量
        const remainQty = pickingItem.plannedQty - pickingItem.pickedQty
        if (pickedQty > remainQty) {
          throw new Error(
            `物料 ${pickingItem.material.name} 领料超限（计划: ${pickingItem.plannedQty}, 已领: ${pickingItem.pickedQty}, 本次: ${pickedQty}）`
          )
        }

        // 乐观锁扣减库存：where 条件包含 quantity >= pickedQty，防止并发超卖
        const updated = await tx.inventory.updateMany({
          where: { materialId: pickingItem.materialId, quantity: { gte: pickedQty } },
          data: { quantity: { decrement: pickedQty }, lastUpdated: new Date() }
        })
        if (updated.count === 0) {
          const inv = await tx.inventory.findUnique({ where: { materialId: pickingItem.materialId } })
          throw new Error(
            `物料 ${pickingItem.material.name} 库存不足（当前: ${inv?.quantity || 0}, 需领: ${pickedQty}）`
          )
        }

        // 记录库存日志
        await tx.inventoryLog.create({
          data: {
            materialId: pickingItem.materialId,
            type: 'out',
            quantity: pickedQty,
            referenceType: 'production',
            referenceId: id,
            remark: `生产领料 ${order.orderNo}`
          }
        })

        // 更新领料项
        await tx.productionPickingItem.update({
          where: { id: pickingItem.id },
          data: { pickedQty: { increment: pickedQty } }
        })

        results.push({ itemId: pickingItem.id, materialName: pickingItem.material.name, pickedQty })
      }

      // 更新工单状态
      await tx.productionOrder.update({
        where: { id },
        data: { status: 'processing' }
      })

      return results
    })

    res.json({ code: 0, message: '领料成功', data: result })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '领料失败' })
  }
}

// 完工入库
export const completeProduction = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { quantity, remark, dailyRecord } = req.body

    if (!quantity || quantity <= 0) {
      res.status(400).json({ code: 400, message: '完工数量不能为空' })
      return
    }

    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: { product: true }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '生产工单不存在' })
      return
    }
    if (order.status !== 'processing') {
      res.status(400).json({ code: 400, message: '仅处理中的工单可完工入库' })
      return
    }

    const result = await prisma.$transaction(async (tx) => {
      // 增加成品库存
      await tx.product.update({
        where: { id: order.productId },
        data: { stock: { increment: Number(quantity) } }
      })

      // 更新工单
      const newProduced = order.producedQuantity + Number(quantity)
      const updatedOrder = await tx.productionOrder.update({
        where: { id },
        data: {
          producedQuantity: newProduced,
          status: newProduced >= order.quantity ? 'completed' : 'processing',
          endDate: newProduced >= order.quantity ? new Date() : undefined,
          remark: remark || order.remark
        }
      })

      // 如果传入了计件记录，关联到此工单（支持 dailyRecords 数组和 dailyRecord 单个）
      const dailyRecordsList = req.body.dailyRecords || (dailyRecord ? [dailyRecord] : [])
      if (dailyRecordsList.length > 0) {
        const createdRecords = []
        for (const dr of dailyRecordsList) {
          if (!dr.employeeId) continue
          const record = await tx.dailyPieceRecord.create({
            data: {
              employeeId: dr.employeeId,
              date: new Date(),
              productionOrderId: id,
              totalAmount: dr.totalAmount || 0,
              items: dr.items ? {
                create: dr.items.map((item: any) => ({
                  productId: item.productId || order.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice || order.product.unitPrice,
                  amount: item.amount || (item.quantity * (item.unitPrice || order.product.unitPrice))
                }))
              } : undefined
            }
          })
          createdRecords.push(record)
        }
        return { order: updatedOrder, dailyRecords: createdRecords }
      }

      return { order: updatedOrder }
    })

    res.json({ code: 0, message: '完工入库成功', data: result })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '入库失败' })
  }
}

// 更新工单状态
export const updateProductionOrderStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body

    const existing = await prisma.productionOrder.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '生产工单不存在' })
      return
    }

    // 取消工单：归还已领物料 + 处理关联计件记录
    if (status === 'cancelled' && existing.status === 'processing') {
      const pickingItems = await prisma.productionPickingItem.findMany({
        where: { orderId: id }
      })
      await prisma.$transaction(async (tx) => {
        for (const item of pickingItems) {
          if (item.pickedQty > 0) {
            await tx.inventory.upsert({
              where: { materialId: item.materialId },
              update: { quantity: { increment: item.pickedQty }, lastUpdated: new Date() },
              create: { materialId: item.materialId, quantity: item.pickedQty, lastUpdated: new Date() }
            })
            await tx.inventoryLog.create({
              data: {
                materialId: item.materialId,
                type: 'in',
                quantity: item.pickedQty,
                referenceType: 'production_cancel',
                referenceId: id,
                remark: `工单取消退料 ${existing.orderNo}`
              }
            })
          }
        }

        // 处理关联的计件记录：将 productionOrderId 置空，保留记录但断开关联
        await tx.dailyPieceRecord.updateMany({
          where: { productionOrderId: id },
          data: { productionOrderId: null, remark: `原工单 ${existing.orderNo} 已取消` }
        })

        await tx.productionOrder.update({ where: { id }, data: { status: 'cancelled' } })
      })
    } else {
      await prisma.productionOrder.update({ where: { id }, data: { status } })
    }

    res.json({ code: 0, message: '状态更新成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}
