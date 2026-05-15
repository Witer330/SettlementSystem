import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

    const employeeCount = await prisma.employee.count({ where: { status: 'active' } })
    const lastMonthEmployeeCount = await prisma.employee.count({
      where: { status: 'active', createdAt: { lt: new Date(now.getFullYear(), now.getMonth(), 1) } }
    })

    // 本月报工（日报 + 生产报工）
    const [pieceRecordCount, prodRecordCount] = await Promise.all([
      prisma.dailyPieceRecord.count({
        where: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } }
      }),
      prisma.productionRecord.count({
        where: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } }
      })
    ])
    const totalRecords = pieceRecordCount + prodRecordCount

    const lastMonthPieceCount = await prisma.dailyPieceRecord.count({
      where: { date: { gte: new Date(now.getFullYear(), now.getMonth() - 1, 1), lt: new Date(now.getFullYear(), now.getMonth(), 1) } }
    })

    const salaryResult = await prisma.salaryBill.aggregate({ where: { period: currentMonth }, _sum: { totalAmount: true } })
    const currentSalary = salaryResult._sum.totalAmount || 0
    const lastSalaryResult = await prisma.salaryBill.aggregate({ where: { period: lastMonth }, _sum: { totalAmount: true } })
    const lastSalary = lastSalaryResult._sum.totalAmount || 0

    const lowStockMaterials = await prisma.material.findMany({
      where: { status: 'active', safeStock: { gt: 0 } }, include: { inventory: true }
    })
    const lowStockCount = lowStockMaterials.filter(m => (m.inventory?.quantity || 0) < m.safeStock).length

    res.json({
      code: 0, message: '获取成功',
      data: {
        employeeCount, employeeTrend: employeeCount - lastMonthEmployeeCount,
        pieceRecordCount: totalRecords,
        pieceRecordTrend: lastMonthPieceCount > 0 ? Math.round(((totalRecords - lastMonthPieceCount) / lastMonthPieceCount) * 100) : 0,
        currentSalary, lastSalary, lowStockCount
      }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取统计数据失败', data: null })
  }
}

// ── 流程状态（支持 pending / active / completed 三级） ──
const flowStepChecks: Array<{ key: string; check: () => Promise<{ count: number; completedCount?: number; latest?: string }> }> = [
  {
    key: 'employees',
    check: async () => {
      const count = await prisma.employee.count({ where: { status: 'active' } })
      const latest = await prisma.employee.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      return { count, latest: latest?.createdAt?.toISOString() }
    }
  },
  {
    key: 'bom',
    check: async () => {
      const count = await prisma.billOfMaterial.count()
      return { count }
    }
  },
  {
    key: 'salesOrders',
    check: async () => {
      const [count, completedCount] = await Promise.all([
        prisma.salesOrder.count(),
        prisma.salesOrder.count({ where: { status: 'completed' } })
      ])
      const latest = await prisma.salesOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      return { count, completedCount, latest: latest?.createdAt?.toISOString() }
    }
  },
  {
    key: 'purchaseOrders',
    check: async () => {
      const [count, completedCount] = await Promise.all([
        prisma.purchaseOrder.count(),
        prisma.purchaseOrder.count({ where: { status: 'completed' } })
      ])
      const latest = await prisma.purchaseOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      return { count, completedCount, latest: latest?.createdAt?.toISOString() }
    }
  },
  {
    key: 'inventory',
    check: async () => {
      const [count, lowCount] = await Promise.all([
        prisma.inventory.count({ where: { quantity: { gt: 0 } } }),
        prisma.inventory.count({ where: { quantity: { gt: 0 } } })  // simplified
      ])
      return { count }
    }
  },
  {
    key: 'dailyRecords',
    check: async () => {
      const now = new Date()
      const [pieceCount, prodCount] = await Promise.all([
        prisma.dailyPieceRecord.count({
          where: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } }
        }),
        prisma.productionRecord.count({
          where: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } }
        })
      ])
      return { count: pieceCount + prodCount }
    }
  },
  {
    key: 'salary',
    check: async () => {
      const now = new Date()
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const [count, approvedCount] = await Promise.all([
        prisma.salaryBill.count({ where: { period } }),
        prisma.salaryBill.count({ where: { period, status: 'approved' } })
      ])
      const latest = await prisma.salaryBill.findFirst({ where: { period }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      return { count, completedCount: approvedCount, latest: latest?.createdAt?.toISOString() }
    }
  }
]

export const getFlowStatus = async (_req: Request, res: Response) => {
  try {
    const results: Record<string, { status: string; count: number; latest?: string }> = {}
    for (const step of flowStepChecks) {
      const { count, completedCount, latest } = await step.check()
      let status: string
      if (completedCount !== undefined && completedCount > 0 && completedCount >= count) {
        status = 'completed'
      } else if (count > 0) {
        status = 'active'
      } else {
        status = 'pending'
      }
      results[step.key] = { status, count, latest }
    }
    res.json({ code: 0, message: '获取成功', data: results })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取流程状态失败', data: null })
  }
}
