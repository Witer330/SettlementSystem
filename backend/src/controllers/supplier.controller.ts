import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 获取供应商列表
export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, keyword, status } = req.query
    const where: any = {}
    if (keyword) {
      where.OR = [
        { name: { contains: keyword as string } },
        { code: { contains: keyword as string } },
        { contact: { contains: keyword as string } }
      ]
    }
    if (status) where.status = status

    const [list, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((page as number) - 1) * (pageSize as number),
        take: parseInt(pageSize as string)
      }),
      prisma.supplier.count({ where })
    ])

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list,
        total,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        totalPages: Math.ceil(total / parseInt(pageSize as string))
      }
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    })
  }
}

// 获取供应商详情
export const getSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id as string) }
    })

    if (!supplier) {
      return res.status(404).json({
        code: 404,
        message: '供应商不存在',
        data: null
      })
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: supplier
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    })
  }
}

// 创建供应商
export const createSupplier = async (req: Request, res: Response) => {
  try {
    const { name, code, contact, phone, address } = req.body

    // 检查编码唯一性
    const existing = await prisma.supplier.findUnique({ where: { code } })
    if (existing) {
      return res.status(400).json({
        code: 400,
        message: '供应商编码已存在',
        data: null
      })
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        code,
        contact,
        phone,
        address,
        status: 'active'
      }
    })

    res.json({
      code: 0,
      message: '创建成功',
      data: supplier
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '创建失败',
      data: null
    })
  }
}

// 更新供应商
export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, code, contact, phone, address, status } = req.body

    // 检查编码唯一性（排除自身）
    if (code) {
      const existing = await prisma.supplier.findFirst({
        where: { code, id: { not: parseInt(id as string) } }
      })
      if (existing) {
        return res.status(400).json({
          code: 400,
          message: '供应商编码已存在',
          data: null
        })
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id as string) },
      data: { name, code, contact, phone, address, status }
    })

    res.json({
      code: 0,
      message: '更新成功',
      data: supplier
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新失败',
      data: null
    })
  }
}

// 删除供应商
export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // 检查是否有关联的采购订单
    const orderCount = await prisma.purchaseOrder.count({
      where: { supplierId: parseInt(id as string) }
    })
    if (orderCount > 0) {
      return res.status(400).json({
        code: 400,
        message: `该供应商有 ${orderCount} 条关联采购订单，无法删除`,
        data: null
      })
    }

    await prisma.supplier.delete({
      where: { id: parseInt(id as string) }
    })

    res.json({
      code: 0,
      message: '删除成功',
      data: null
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '删除失败',
      data: null
    })
  }
}
