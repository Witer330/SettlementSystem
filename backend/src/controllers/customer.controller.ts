import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 获取客户列表
export const getCustomers = async (req: Request, res: Response) => {
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
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((page as number) - 1) * (pageSize as number),
        take: parseInt(pageSize as string)
      }),
      prisma.customer.count({ where })
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

// 获取客户详情
export const getCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id as string) }
    })

    if (!customer) {
      return res.status(404).json({
        code: 404,
        message: '客户不存在',
        data: null
      })
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: customer
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    })
  }
}

// 创建客户
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { name, code, contact, phone, address, creditLimit } = req.body

    // 检查编码唯一性
    const existing = await prisma.customer.findUnique({ where: { code } })
    if (existing) {
      return res.status(400).json({
        code: 400,
        message: '客户编码已存在',
        data: null
      })
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        code,
        contact,
        phone,
        address,
        creditLimit: creditLimit ?? 0,
        status: 'active'
      }
    })

    res.json({
      code: 0,
      message: '创建成功',
      data: customer
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '创建失败',
      data: null
    })
  }
}

// 更新客户
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, code, contact, phone, address, creditLimit, status } = req.body

    // 检查编码唯一性（排除自身）
    if (code) {
      const existing = await prisma.customer.findFirst({
        where: { code, id: { not: parseInt(id as string) } }
      })
      if (existing) {
        return res.status(400).json({
          code: 400,
          message: '客户编码已存在',
          data: null
        })
      }
    }

    const customer = await prisma.customer.update({
      where: { id: parseInt(id as string) },
      data: { name, code, contact, phone, address, creditLimit, status }
    })

    res.json({
      code: 0,
      message: '更新成功',
      data: customer
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新失败',
      data: null
    })
  }
}

// 删除客户
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // 检查是否有关联的销售订单
    const orderCount = await prisma.salesOrder.count({
      where: { customerId: parseInt(id as string) }
    })
    if (orderCount > 0) {
      return res.status(400).json({
        code: 400,
        message: `该客户有 ${orderCount} 条关联销售订单，无法删除`,
        data: null
      })
    }

    await prisma.customer.delete({
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
