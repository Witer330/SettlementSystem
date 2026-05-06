import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取物料列表
export const getMaterials = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, category, status } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (keyword) {
      where.OR = [
        { name: { contains: String(keyword) } },
        { code: { contains: String(keyword) } }
      ]
    }
    if (category) where.category = String(category)
    if (status) where.status = String(status)

    const [materials, total] = await Promise.all([
      prisma.material.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.material.count({ where })
    ])

    res.json({
      code: 0,
      message: '获取成功',
      data: { list: materials, total, page: Number(page), pageSize: take }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 获取单个物料
export const getMaterial = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const material = await prisma.material.findUnique({ where: { id } })
    if (!material) {
      res.status(404).json({ code: 404, message: '物料不存在' })
      return
    }
    res.json({ code: 0, message: '获取成功', data: material })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 创建物料
export const createMaterial = async (req: Request, res: Response) => {
  try {
    const { name, code, category, specification, unit, barcode, safeStock } = req.body
    if (!name || !code || !category || !unit) {
      res.status(400).json({ code: 400, message: '缺少必填字段' })
      return
    }

    const existing = await prisma.material.findUnique({ where: { code } })
    if (existing) {
      res.status(400).json({ code: 400, message: '物料编码已存在' })
      return
    }

    const material = await prisma.material.create({
      data: { name, code, category, specification, unit, barcode, safeStock: safeStock || 0 }
    })

    res.json({ code: 0, message: '创建成功', data: material })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 更新物料
export const updateMaterial = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { name, code, category, specification, unit, barcode, safeStock, status } = req.body

    const existing = await prisma.material.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '物料不存在' })
      return
    }

    if (code && code !== existing.code) {
      const duplicate = await prisma.material.findUnique({ where: { code } })
      if (duplicate) {
        res.status(400).json({ code: 400, message: '物料编码已存在' })
        return
      }
    }

    const material = await prisma.material.update({
      where: { id },
      data: { name, code, category, specification, unit, barcode, safeStock, status }
    })

    res.json({ code: 0, message: '更新成功', data: material })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 删除物料
export const deleteMaterial = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.material.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '物料不存在' })
      return
    }

    await prisma.material.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}
