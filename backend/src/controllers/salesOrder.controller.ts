import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 生成销售单号
const generateOrderNo = async (): Promise<string> => {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.salesOrder.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
      }
    }
  })
  return `SO-${dateStr}-${String(count + 1).padStart(3, '0')}`
}

// 获取销售单列表
export const getSalesOrders = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, status } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (keyword) {
      where.OR = [
        { orderNo: { contains: String(keyword) } },
        { customer: { name: { contains: String(keyword) } } }
      ]
    }
    if (status) where.status = String(status)

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          items: { include: { product: true } },
          returnOrders: { include: { items: true } },
          receivableItems: { include: { receivable: { select: { id: true, orderNo: true, status: true } } } }
        }
      }),
      prisma.salesOrder.count({ where })
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

// 获取单个销售单
export const getSalesOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        productionOrders: { select: { id: true, orderNo: true, status: true } },
        purchaseOrders: { select: { id: true, orderNo: true, status: true } },
        returnOrders: { select: { id: true, returnNo: true, status: true } },
        receivableItems: { include: { receivable: { select: { id: true, orderNo: true, status: true } } } }
      }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '销售单不存在' })
      return
    }
    res.json({ code: 0, message: '获取成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 创建销售单
export const createSalesOrder = async (req: Request, res: Response) => {
  try {
    const { customerId, items, remark, status: reqStatus, reserveInventory,
      orderDate, businessType, deliveryMethod, salesperson, deliveryPerson,
      returnDate, paymentMethod, contactInfo, customerRemark, creator,
      wholeDiscount, usePrepayment, shippingAddress
    } = req.body
    const isDraft = reqStatus === 'draft'

    // 草稿：跳过必填校验
    if (!isDraft && (!customerId || !items || items.length === 0)) {
      res.status(400).json({ code: 400, message: '客户和销售明细不能为空' })
      return
    }

    const orderNo = isDraft
      ? `DRAFT-SO-${Date.now()}`
      : await generateOrderNo()
    const totalAmount = items
      ? items.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0)
      : 0

    const order = await prisma.salesOrder.create({
      data: {
        customerId: customerId || null,
        orderNo,
        totalAmount,
        status: isDraft ? 'draft' : 'pending',
        remark,
        reserveInventory: reserveInventory !== undefined ? reserveInventory : true,
        ...(orderDate && { orderDate: new Date(orderDate) }),
        ...(businessType !== undefined && { businessType }),
        ...(deliveryMethod !== undefined && { deliveryMethod }),
        ...(salesperson !== undefined && { salesperson }),
        ...(deliveryPerson !== undefined && { deliveryPerson }),
        ...(returnDate && { returnDate: new Date(returnDate) }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(contactInfo !== undefined && { contactInfo }),
        ...(customerRemark !== undefined && { customerRemark }),
        ...(creator !== undefined && { creator }),
        ...(wholeDiscount !== undefined && { wholeDiscount }),
        ...(usePrepayment !== undefined && { usePrepayment }),
        ...(shippingAddress !== undefined && { shippingAddress }),
        ...(items && items.length > 0 && {
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price
            }))
          }
        })
      },
      include: { customer: true, items: { include: { product: true } } }
    })

    res.json({ code: 0, message: isDraft ? '草稿已保存' : '创建成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 更新销售单
export const updateSalesOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { customerId, items, remark, status, reserveInventory,
      orderDate, businessType, deliveryMethod, salesperson, deliveryPerson,
      returnDate, paymentMethod, contactInfo, customerRemark, creator, wholeDiscount, usePrepayment, shippingAddress
    } = req.body

    const existing = await prisma.salesOrder.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '销售单不存在' })
      return
    }

    // 检查是否被应收单锁定
    const lockedItem = await prisma.receivableItem.findFirst({
      where: {
        salesOrderId: id,
        receivable: { status: { in: ['pending', 'approved'] } }
      }
    })
    if (lockedItem) {
      res.status(400).json({ code: 400, message: '该销售单已被应收单锁定，请先反审并删除关联的应收单', data: null })
      return
    }

    // 草稿转正式：生成正式单号
    const isDraftToPending = existing.status === 'draft' && status === 'pending'
    const finalOrderNo = isDraftToPending ? await generateOrderNo() : undefined

    const totalAmount = items
      ? items.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0)
      : existing.totalAmount

    const order = await prisma.salesOrder.update({
      where: { id },
      data: {
        ...(customerId !== undefined && { customerId: customerId || null }),
        ...(finalOrderNo && { orderNo: finalOrderNo }),
        totalAmount,
        remark,
        ...(reserveInventory !== undefined && { reserveInventory }),
        ...(status && { status }),
        ...(orderDate !== undefined && { orderDate: orderDate ? new Date(orderDate) : null }),
        ...(businessType !== undefined && { businessType }),
        ...(deliveryMethod !== undefined && { deliveryMethod }),
        ...(salesperson !== undefined && { salesperson }),
        ...(deliveryPerson !== undefined && { deliveryPerson }),
        ...(returnDate !== undefined && { returnDate: returnDate ? new Date(returnDate) : null }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(contactInfo !== undefined && { contactInfo }),
        ...(customerRemark !== undefined && { customerRemark }),
        ...(creator !== undefined && { creator }),
        ...(wholeDiscount !== undefined && { wholeDiscount }),
        ...(usePrepayment !== undefined && { usePrepayment }),
        ...(shippingAddress !== undefined && { shippingAddress }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price
            }))
          }
        })
      },
      include: { customer: true, items: { include: { product: true } } }
    })

    res.json({ code: 0, message: '更新成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 删除销售单
export const deleteSalesOrder = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.salesOrder.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '销售单不存在' })
      return
    }

    const lockedItem = await prisma.receivableItem.findFirst({
      where: {
        salesOrderId: id,
        receivable: { status: { in: ['pending', 'approved'] } }
      }
    })
    if (lockedItem) {
      res.status(400).json({ code: 400, message: '该销售单已被应收单锁定，请先反审并删除关联的应收单', data: null })
      return
    }

    await prisma.salesOrder.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}

// 更新销售单状态
export const updateSalesOrderStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body

    const existing = await prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!existing) { res.status(404).json({ code: 404, message: '销售单不存在' }); return }

    // 锁定状态下仅禁止回退（如 completed→confirmed, confirmed→pending）
    const statusOrder = ['draft', 'pending', 'confirmed', 'completed']
    const lockedItem = await prisma.receivableItem.findFirst({
      where: {
        salesOrderId: id,
        receivable: { status: { in: ['pending', 'approved'] } }
      }
    })
    if (lockedItem && statusOrder.indexOf(status) < statusOrder.indexOf(existing.status)) {
      res.status(400).json({ code: 400, message: '该销售单已被应收单锁定，不能回退状态', data: null })
      return
    }

    // completed → 扣减成品库存
    if (status === 'completed' && existing.status !== 'completed') {
      for (const item of existing.items) {
        const qty = item.shippedQuantity > 0 ? item.shippedQuantity : item.quantity
        await prisma.product.update({ where: { id: item.productId }, data: { stock: { decrement: qty } } })
      }
    }

    const order = await prisma.salesOrder.update({
      where: { id },
      data: { status }
    })

    res.json({ code: 0, message: '状态更新成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 计算物料需求
export const getMaterialRequirements = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    })

    if (!order) {
      res.status(404).json({ code: 404, message: '销售单不存在' })
      return
    }

    // 汇总每种原材料的需求量
    const materialMap = new Map<number, {
      materialId: number
      materialName: string
      materialCode: string
      unit: string
      totalRequired: number
      details: Array<{
        productName: string
        productCode: string
        quantity: number
        bomQty: number
        subTotal: number
      }>
    }>()

    for (const item of order.items) {
      const bomItems = await prisma.billOfMaterial.findMany({
        where: { productId: item.productId },
        include: { material: true }
      })

      for (const bom of bomItems) {
        const subTotal = item.quantity * bom.quantity
        const existing = materialMap.get(bom.materialId)

        if (existing) {
          existing.totalRequired += subTotal
          existing.details.push({
            productName: item.product.name,
            productCode: item.product.code,
            quantity: item.quantity,
            bomQty: bom.quantity,
            subTotal
          })
        } else {
          materialMap.set(bom.materialId, {
            materialId: bom.materialId,
            materialName: bom.material.name,
            materialCode: bom.material.code,
            unit: bom.material.unit,
            totalRequired: subTotal,
            details: [{
              productName: item.product.name,
              productCode: item.product.code,
              quantity: item.quantity,
              bomQty: bom.quantity,
              subTotal
            }]
          })
        }
      }
    }

    // 查询库存
    const materialIds = Array.from(materialMap.keys())
    const inventories = await prisma.inventory.findMany({
      where: { materialId: { in: materialIds } }
    })
    const inventoryMap = new Map(inventories.map(i => [i.materialId, i.quantity]))

    // 计算缺口
    const requirements = Array.from(materialMap.values()).map(item => ({
      ...item,
      currentStock: inventoryMap.get(item.materialId) || 0,
      shortage: item.totalRequired - (inventoryMap.get(item.materialId) || 0)
    }))

    res.json({
      code: 0,
      message: '获取成功',
      data: { salesOrder: order, requirements }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '计算失败' })
  }
}
