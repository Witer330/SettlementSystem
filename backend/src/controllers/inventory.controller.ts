import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 获取库存列表（关联物料信息）
export const getInventoryList = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, status } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    // 构建物料筛选条件
    const materialWhere: any = {}
    if (keyword) {
      materialWhere.OR = [
        { name: { contains: String(keyword) } },
        { code: { contains: String(keyword) } }
      ]
    }

    // 查询所有物料（含库存）
    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where: materialWhere,
        include: { inventory: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.material.count({ where: materialWhere })
    ])

    // 组装库存数据
    let list = materials.map(m => ({
      materialId: m.id,
      materialCode: m.code,
      materialName: m.name,
      category: m.category,
      specification: m.specification,
      unit: m.unit,
      safeStock: m.safeStock,
      quantity: m.inventory?.quantity || 0,
      lastUpdated: m.inventory?.lastUpdated || null,
      status: m.status,
      // 库存状态判断
      stockStatus: getStockStatus(m.inventory?.quantity || 0, m.safeStock)
    }))

    // 按库存状态筛选
    if (status) {
      list = list.filter(item => item.stockStatus === status)
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: { list, total, page: Number(page), pageSize: take }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取库存列表失败' })
  }
}

// 获取库存变动日志
export const getInventoryLogs = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', materialId, type, startDate, endDate } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (materialId) where.materialId = Number(materialId)
    if (type) where.type = String(type)
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(String(startDate))
      if (endDate) where.createdAt.lte = new Date(String(endDate) + 'T23:59:59')
    }

    const [logs, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        include: { material: { select: { name: true, code: true, unit: true } } },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.inventoryLog.count({ where })
    ])

    res.json({
      code: 0,
      message: '获取成功',
      data: { list: logs, total, page: Number(page), pageSize: take }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取库存日志失败' })
  }
}

// 手动调整库存
export const adjustInventory = async (req: Request, res: Response) => {
  try {
    const { materialId, quantity, type, remark } = req.body
    if (!materialId || quantity === undefined || !type) {
      res.status(400).json({ code: 400, message: '缺少必填字段' })
      return
    }

    if (!['in', 'out'].includes(type)) {
      res.status(400).json({ code: 400, message: '类型必须为 in 或 out' })
      return
    }

    if (quantity <= 0) {
      res.status(400).json({ code: 400, message: '数量必须大于0' })
      return
    }

    // 检查物料是否存在
    const material = await prisma.material.findUnique({ where: { id: Number(materialId) } })
    if (!material) {
      res.status(404).json({ code: 404, message: '物料不存在' })
      return
    }

    // 获取当前库存
    const currentInventory = await prisma.inventory.findUnique({
      where: { materialId: Number(materialId) }
    })
    const currentQty = currentInventory?.quantity || 0

    // 出库时检查库存是否足够
    if (type === 'out' && currentQty < quantity) {
      res.status(400).json({ code: 400, message: `库存不足，当前库存 ${currentQty} ${material.unit}` })
      return
    }

    const delta = type === 'in' ? quantity : -quantity

    // 使用事务更新库存和创建日志
    const result = await prisma.$transaction(async (tx) => {
      // 更新或创建库存记录
      const inventory = await tx.inventory.upsert({
        where: { materialId: Number(materialId) },
        update: {
          quantity: { increment: delta },
          lastUpdated: new Date()
        },
        create: {
          materialId: Number(materialId),
          quantity: delta,
          lastUpdated: new Date()
        }
      })

      // 创建库存变动日志
      const log = await tx.inventoryLog.create({
        data: {
          materialId: Number(materialId),
          type,
          quantity,
          referenceType: 'manual',
          remark: remark || `手动${type === 'in' ? '入库' : '出库'} ${quantity} ${material.unit}`
        }
      })

      return { inventory, log }
    })

    res.json({ code: 0, message: `${type === 'in' ? '入库' : '出库'}成功`, data: result })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '库存调整失败' })
  }
}

// 获取单个物料的库存详情
export const getInventoryDetail = async (req: Request, res: Response) => {
  try {
    const materialId = Number(req.params.materialId)
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: { inventory: true }
    })
    if (!material) {
      res.status(404).json({ code: 404, message: '物料不存在' })
      return
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        materialId: material.id,
        materialCode: material.code,
        materialName: material.name,
        unit: material.unit,
        safeStock: material.safeStock,
        quantity: material.inventory?.quantity || 0,
        lastUpdated: material.inventory?.lastUpdated || null,
        stockStatus: getStockStatus(material.inventory?.quantity || 0, material.safeStock)
      }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取库存详情失败' })
  }
}

// 库存状态判断
function getStockStatus(quantity: number, safeStock: number): string {
  if (quantity <= 0) return 'empty'
  if (quantity < safeStock) return 'low'
  return 'normal'
}

// ── 成品库存 ──

// 获取成品库存列表
export const getProductStockList = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (keyword) {
      where.OR = [
        { name: { contains: String(keyword) } },
        { code: { contains: String(keyword) } }
      ]
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, code: true, category: true, specification: true, unit: true, stock: true, updatedAt: true }
      }),
      prisma.product.count({ where })
    ])

    const list = products.map(p => ({
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      category: p.category,
      specification: p.specification,
      unit: p.unit,
      quantity: p.stock,
      lastUpdated: p.updatedAt,
      stockStatus: p.stock <= 0 ? 'empty' : 'normal'
    }))

    res.json({ code: 0, message: '获取成功', data: { list, total, page: Number(page), pageSize: take } })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取成品库存失败' })
  }
}

// 手动调整成品库存
export const adjustProductStock = async (req: Request, res: Response) => {
  try {
    const { productId, quantity, type, remark } = req.body
    if (!productId || quantity === undefined || !type) {
      res.status(400).json({ code: 400, message: '缺少必填字段' })
      return
    }
    if (!['in', 'out'].includes(type)) {
      res.status(400).json({ code: 400, message: '类型必须为 in 或 out' })
      return
    }
    if (quantity <= 0) {
      res.status(400).json({ code: 400, message: '数量必须大于0' })
      return
    }

    const product = await prisma.product.findUnique({ where: { id: Number(productId) } })
    if (!product) {
      res.status(404).json({ code: 404, message: '产品不存在' })
      return
    }

    if (type === 'out' && product.stock < quantity) {
      res.status(400).json({ code: 400, message: `库存不足，当前库存 ${product.stock} ${product.unit}` })
      return
    }

    const delta = type === 'in' ? quantity : -quantity
    const updated = await prisma.product.update({
      where: { id: Number(productId) },
      data: { stock: { increment: delta } }
    })

    res.json({ code: 0, message: `${type === 'in' ? '入库' : '出库'}成功`, data: updated })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '成品库存调整失败' })
  }
}
