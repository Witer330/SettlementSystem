import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { type AuthRequest } from '../middleware/auth.middleware'

// 生成应付单号
const generateOrderNo = async (): Promise<string> => {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.payable.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
      }
    }
  })
  return `PAY-${dateStr}-${String(count + 1).padStart(3, '0')}`
}

// 获取应付单列表
export const getPayables = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', keyword, status, supplierId, partnerId } = req.query
    const pid = partnerId ?? supplierId
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
      prisma.payable.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: {
          partner: true,
          items: { include: { purchaseOrder: { include: { partner: true } } } }
        }
      }),
      prisma.payable.count({ where })
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

// 获取应付单详情
export const getPayable = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const order = await prisma.payable.findUnique({
      where: { id },
      include: {
        partner: true,
        items: { include: { purchaseOrder: { include: { partner: true, items: { include: { material: true } } } } } }
      }
    })
    if (!order) {
      res.status(404).json({ code: 404, message: '应付单不存在' })
      return
    }
    res.json({ code: 0, message: '获取成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 获取可引用的采购单（未被锁定且已确认/已完成的）
export const getAvailablePurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { supplierId, partnerId } = req.query
    const pid = partnerId ?? supplierId

    // 查询已被应付单引用的采购单ID
    const lockedItems = await prisma.payableItem.findMany({
      where: {
        payable: { status: { in: ['pending', 'approved'] } }
      },
      select: { purchaseOrderId: true }
    })
    const lockedIds = lockedItems.map(i => i.purchaseOrderId)

    const where: any = {
      id: { notIn: lockedIds },
      status: { in: ['confirmed', 'completed'] }
    }
    if (pid) where.partnerId = Number(pid)

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: { partner: true, items: { include: { material: true } } },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ code: 0, message: '获取成功', data: orders })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 创建应付单
export const createPayable = async (req: AuthRequest, res: Response) => {
  try {
    const { supplierId, partnerId, items, remark } = req.body
    const pid = partnerId ?? supplierId

    if (!pid || !items || items.length === 0) {
      res.status(400).json({ code: 400, message: '供应商和引用采购单不能为空' })
      return
    }

    // 检查引用的采购单是否已被锁定
    const lockedItems = await prisma.payableItem.findMany({
      where: {
        purchaseOrderId: { in: items.map((i: any) => i.purchaseOrderId) },
        payable: { status: { in: ['pending', 'approved'] } }
      },
      include: { payable: { select: { orderNo: true } } }
    })
    if (lockedItems.length > 0) {
      const lockedNos = lockedItems.map(i => i.payable.orderNo).join(', ')
      res.status(400).json({ code: 400, message: `以下采购单已被应付单 ${lockedNos} 锁定` })
      return
    }

    // 验证采购单存在且属于该供应商
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        id: { in: items.map((i: any) => i.purchaseOrderId) },
        partnerId: pid
      }
    })
    if (purchaseOrders.length !== items.length) {
      res.status(400).json({ code: 400, message: '引用的采购单不存在或不属于该供应商' })
      return
    }

    const orderNo = await generateOrderNo()
    const totalAmount = items.reduce((sum: number, item: any) => sum + item.amount, 0)

    const order = await prisma.payable.create({
      data: {
        partnerId: pid,
        orderNo,
        totalAmount,
        status: 'pending',
        remark,
        items: {
          create: items.map((item: any) => ({
            purchaseOrderId: item.purchaseOrderId,
            amount: item.amount
          }))
        }
      },
      include: {
        partner: true,
        items: { include: { purchaseOrder: { include: { partner: true } } } }
      }
    })

    res.json({ code: 0, message: '创建成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 更新应付单（仅 pending 状态）
export const updatePayable = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { supplierId, partnerId, items, remark } = req.body
    const pid = partnerId ?? supplierId

    const existing = await prisma.payable.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '应付单不存在' })
      return
    }
    if (existing.status !== 'pending') {
      res.status(400).json({ code: 400, message: '仅待审核的应付单可编辑' })
      return
    }

    const totalAmount = items
      ? items.reduce((sum: number, item: any) => sum + item.amount, 0)
      : existing.totalAmount

    const order = await prisma.payable.update({
      where: { id },
      data: {
        ...(pid !== undefined && { partnerId: pid }),
        totalAmount,
        remark,
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any) => ({
              purchaseOrderId: item.purchaseOrderId,
              amount: item.amount
            }))
          }
        })
      },
      include: {
        partner: true,
        items: { include: { purchaseOrder: { include: { partner: true } } } }
      }
    })

    res.json({ code: 0, message: '更新成功', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 删除应付单（仅 pending 状态）
export const deletePayable = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.payable.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '应付单不存在' })
      return
    }
    if (existing.status !== 'pending') {
      res.status(400).json({ code: 400, message: '仅待审核的应付单可删除，请先反审' })
      return
    }

    await prisma.payable.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功，关联的采购单已解锁' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}

// 审核应付单
export const approvePayable = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    if (!req.userId) {
      return res.status(401).json({ code: 401, message: '未认证', data: null })
    }

    const existing = await prisma.payable.findUnique({ where: { id: Number(id) } })
    if (!existing) {
      return res.status(404).json({ code: 404, message: '应付单不存在', data: null })
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({ code: 400, message: '仅待审核的应付单可审核', data: null })
    }

    const order = await prisma.payable.update({
      where: { id: Number(id) },
      data: {
        status: 'approved',
        approvedBy: req.userId,
        approvedAt: new Date()
      },
      include: {
        partner: true,
        items: { include: { purchaseOrder: { include: { partner: true } } } }
      }
    })

    res.json({ code: 0, message: '审核通过', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '审核失败', data: null })
  }
}

// 反审应付单
export const revokePayable = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const existing = await prisma.payable.findUnique({ where: { id: Number(id) } })
    if (!existing) {
      return res.status(404).json({ code: 404, message: '应付单不存在', data: null })
    }
    if (existing.status !== 'approved') {
      return res.status(400).json({ code: 400, message: '仅已审核的应付单可反审', data: null })
    }

    const order = await prisma.payable.update({
      where: { id: Number(id) },
      data: {
        status: 'pending',
        approvedBy: null,
        approvedAt: null
      },
      include: {
        partner: true,
        items: { include: { purchaseOrder: { include: { partner: true } } } }
      }
    })

    res.json({ code: 0, message: '反审成功，关联的采购单已解锁', data: order })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '反审失败', data: null })
  }
}
