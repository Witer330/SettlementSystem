import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { type AuthRequest } from '../middleware/auth.middleware'

// 生成应收单号
const generateOrderNo = async (): Promise<string> => {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.receivable.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
      }
    }
  })
  return `REC-${dateStr}-${String(count + 1).padStart(3, '0')}`
}

// 获取应收单列表
export const getReceivables = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, status, customerId, partnerId } = req.query
    const pid = partnerId ?? customerId
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (keyword) {
      where.OR = [
        { orderNo: { contains: String(keyword) } },
        { partner: { name: { contains: String(keyword) } } }
      ]
    }
    if (status) where.status = String(status)
    if (pid) where.partnerId = Number(pid)

    const [list, total] = await Promise.all([
      prisma.receivable.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: {
          partner: true,
          items: { include: { salesOrder: { include: { partner: true } } } }
        }
      }),
      prisma.receivable.count({ where })
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

// 获取应收单详情
export const getReceivable = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.receivable.findUnique({
      where: { id },
      include: {
        partner: true,
        items: { include: { salesOrder: { include: { partner: true, items: { include: { product: true } } } } } }
      }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '应收单不存在' })
      return
    }
    res.json({ code: 0, message: '获取成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 获取可引用的销货单（未被锁定且已确认/已完成的）
export const getAvailableSalesOrders = async (req: Request, res: Response) => {
  try {
    const { customerId, partnerId } = req.query
    const pid = partnerId ?? customerId

    // 查询已被应收单引用的销货单ID
    const lockedItems = await prisma.receivableItem.findMany({
      where: {
        receivable: { status: { in: ['pending', 'approved'] } }
      },
      select: { salesOrderId: true }
    })
    const lockedIds = lockedItems.map(i => i.salesOrderId)

    const where: any = {
      id: { notIn: lockedIds },
      status: { in: ['confirmed', 'completed'] }
    }
    if (pid) where.partnerId = Number(pid)

    const orders = await prisma.salesOrder.findMany({
      where,
      include: { partner: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ code: 0, message: '获取成功', data: orders })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 创建应收单
export const createReceivable = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, partnerId, items, remark } = req.body
    const pid = partnerId ?? customerId

    if (!pid || !items || items.length === 0) {
      res.status(400).json({ code: 400, message: '客户和引用销货单不能为空' })
      return
    }

    // 检查引用的销货单是否已被锁定
    const lockedItems = await prisma.receivableItem.findMany({
      where: {
        salesOrderId: { in: items.map((i: any) => i.salesOrderId) },
        receivable: { status: { in: ['pending', 'approved'] } }
      },
      include: { receivable: { select: { orderNo: true } } }
    })
    if (lockedItems.length > 0) {
      const lockedNos = lockedItems.map(i => i.receivable.orderNo).join(', ')
      res.status(400).json({ code: 400, message: `以下销货单已被应收单 ${lockedNos} 锁定` })
      return
    }

    // 验证销货单存在且属于该客户
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        id: { in: items.map((i: any) => i.salesOrderId) },
        partnerId: pid
      }
    })
    if (salesOrders.length !== items.length) {
      res.status(400).json({ code: 400, message: '引用的销货单不存在或不属于该客户' })
      return
    }

    const orderNo = await generateOrderNo()
    const totalAmount = items.reduce((sum: number, item: any) => sum + item.amount, 0)

    const order = await prisma.receivable.create({
      data: {
        partnerId: pid,
        orderNo,
        totalAmount,
        status: 'pending',
        remark,
        items: {
          create: items.map((item: any) => ({
            salesOrderId: item.salesOrderId,
            amount: item.amount
          }))
        }
      },
      include: {
        partner: true,
        items: { include: { salesOrder: { include: { partner: true } } } }
      }
    })

    res.json({ code: 0, message: '创建成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 更新应收单（仅 pending 状态）
export const updateReceivable = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { customerId, partnerId, items, remark } = req.body
    const pid = partnerId ?? customerId

    const existing = await prisma.receivable.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '应收单不存在' })
      return
    }
    if (existing.status !== 'pending') {
      res.status(400).json({ code: 400, message: '仅待审核的应收单可编辑' })
      return
    }

    const totalAmount = items
      ? items.reduce((sum: number, item: any) => sum + item.amount, 0)
      : existing.totalAmount

    const order = await prisma.receivable.update({
      where: { id },
      data: {
        ...(pid !== undefined && { partnerId: pid }),
        totalAmount,
        remark,
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              salesOrderId: item.salesOrderId,
              amount: item.amount
            }))
          }
        })
      },
      include: {
        partner: true,
        items: { include: { salesOrder: { include: { partner: true } } } }
      }
    })

    res.json({ code: 0, message: '更新成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 删除应收单（仅 pending 状态）
export const deleteReceivable = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.receivable.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '应收单不存在' })
      return
    }
    if (existing.status !== 'pending') {
      res.status(400).json({ code: 400, message: '仅待审核的应收单可删除，请先反审' })
      return
    }

    await prisma.receivable.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功，关联的销货单已解锁' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}

// 审核应收单
export const approveReceivable = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    if (!req.userId) {
      return res.status(401).json({ code: 401, message: '未认证', data: null })
    }

    const existing = await prisma.receivable.findUnique({ where: { id: Number(id) } })
    if (!existing) {
      return res.status(404).json({ code: 404, message: '应收单不存在', data: null })
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({ code: 400, message: '仅待审核的应收单可审核', data: null })
    }

    const order = await prisma.receivable.update({
      where: { id: Number(id) },
      data: {
        status: 'approved',
        approvedBy: req.userId,
        approvedAt: new Date()
      },
      include: {
        partner: true,
        items: { include: { salesOrder: { include: { partner: true } } } }
      }
    })

    res.json({ code: 0, message: '审核通过', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '审核失败', data: null })
  }
}

// 反审应收单
export const revokeReceivable = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const existing = await prisma.receivable.findUnique({ where: { id: Number(id) } })
    if (!existing) {
      return res.status(404).json({ code: 404, message: '应收单不存在', data: null })
    }
    if (existing.status !== 'approved') {
      return res.status(400).json({ code: 400, message: '仅已审核的应收单可反审', data: null })
    }

    const order = await prisma.receivable.update({
      where: { id: Number(id) },
      data: {
        status: 'pending',
        approvedBy: null,
        approvedAt: null
      },
      include: {
        partner: true,
        items: { include: { salesOrder: { include: { partner: true } } } }
      }
    })

    res.json({ code: 0, message: '反审成功，关联的销货单已解锁', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '反审失败', data: null })
  }
}
