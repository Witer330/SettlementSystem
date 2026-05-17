import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 获取产品的 BOM 列表
export const getBomByProduct = async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.productId)
    const items = await prisma.billOfMaterial.findMany({
      where: { productId },
      include: { material: true }
    })
    res.json({ code: 0, message: '获取成功', data: items })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 批量保存产品的 BOM（整体替换）
export const saveBom = async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.productId)
    const { items } = req.body // [{ materialId, quantity }]

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      res.status(404).json({ code: 404, message: '产品不存在' })
      return
    }

    // 删除旧的 BOM
    await prisma.billOfMaterial.deleteMany({ where: { productId } })

    // 创建新的 BOM
    if (items && items.length > 0) {
      await prisma.billOfMaterial.createMany({
        data: items.map((item: any) => ({
          productId,
          materialId: item.materialId,
          quantity: item.quantity
        }))
      })
    }

    // 标记该产品下待生产/生产中的工单领料单为过期
    await prisma.productionOrder.updateMany({
      where: { productId, status: { in: ['pending', 'processing'] } },
      data: { pickingStale: true }
    })

    const result = await prisma.billOfMaterial.findMany({
      where: { productId },
      include: { material: true }
    })

    res.json({ code: 0, message: '保存成功', data: result })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '保存失败' })
  }
}

// 添加单条 BOM 项
export const addBomItem = async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.productId)
    const { materialId, quantity } = req.body

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      res.status(404).json({ code: 404, message: '产品不存在' })
      return
    }

    const item = await prisma.billOfMaterial.create({
      data: { productId, materialId, quantity },
      include: { material: true }
    })

    // 标记该产品下待生产/生产中的工单领料单为过期
    await prisma.productionOrder.updateMany({
      where: { productId, status: { in: ['pending', 'processing'] } },
      data: { pickingStale: true }
    })

    res.json({ code: 0, message: '添加成功', data: item })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '添加失败' })
  }
}

// 删除 BOM 项
export const deleteBomItem = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const bomItem = await prisma.billOfMaterial.findUnique({ where: { id } })
    if (!bomItem) {
      res.status(404).json({ code: 404, message: 'BOM项不存在' })
      return
    }

    await prisma.billOfMaterial.delete({ where: { id } })

    // 标记该产品下待生产/生产中的工单领料单为过期
    await prisma.productionOrder.updateMany({
      where: { productId: bomItem.productId, status: { in: ['pending', 'processing'] } },
      data: { pickingStale: true }
    })

    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}
