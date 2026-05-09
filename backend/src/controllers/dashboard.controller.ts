import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

    // 员工总数
    const employeeCount = await prisma.employee.count({
      where: { status: 'active' }
    })

    // 上月员工数
    const lastMonthEmployeeCount = await prisma.employee.count({
      where: {
        status: 'active',
        createdAt: { lt: new Date(now.getFullYear(), now.getMonth(), 1) }
      }
    })

    // 本月报工记录数
    const pieceRecordCount = await prisma.dailyPieceRecord.count({
      where: {
        date: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        }
      }
    })

    // 上月报工记录数
    const lastMonthPieceCount = await prisma.dailyPieceRecord.count({
      where: {
        date: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: new Date(now.getFullYear(), now.getMonth(), 1)
        }
      }
    })

    // 本月工资总额
    const salaryResult = await prisma.salaryBill.aggregate({
      where: { period: currentMonth },
      _sum: { totalAmount: true }
    })
    const currentSalary = salaryResult._sum.totalAmount || 0

    // 上月工资总额
    const lastSalaryResult = await prisma.salaryBill.aggregate({
      where: { period: lastMonth },
      _sum: { totalAmount: true }
    })
    const lastSalary = lastSalaryResult._sum.totalAmount || 0

    // 库存预警（库存量 < 安全库存的物料数）
    const lowStockMaterials = await prisma.material.findMany({
      where: { status: 'active', safeStock: { gt: 0 } },
      include: { inventory: true }
    })
    const lowStockCount = lowStockMaterials.filter(m => {
      const stock = m.inventory?.quantity || 0
      return stock < m.safeStock
    }).length

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        employeeCount,
        employeeTrend: employeeCount - lastMonthEmployeeCount,
        pieceRecordCount,
        pieceRecordTrend: lastMonthPieceCount > 0
          ? Math.round(((pieceRecordCount - lastMonthPieceCount) / lastMonthPieceCount) * 100)
          : 0,
        currentSalary,
        lastSalary,
        lowStockCount
      }
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取统计数据失败',
      data: null
    })
  }
}

// 流程步骤状态查询
// 每个步骤映射到一个数据模型，根据是否有数据判断状态
const flowStepChecks: Array<{
  key: string
  check: () => Promise<{ count: number; latest?: string }>
}> = [
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
      const latest = await prisma.billOfMaterial.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
      return { count, latest: latest ? String(latest.id) : undefined }
    }
  },
  {
    key: 'salesOrders',
    check: async () => {
      const count = await prisma.salesOrder.count()
      const latest = await prisma.salesOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      return { count, latest: latest?.createdAt?.toISOString() }
    }
  },
  {
    key: 'purchaseOrders',
    check: async () => {
      const count = await prisma.purchaseOrder.count()
      const latest = await prisma.purchaseOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      return { count, latest: latest?.createdAt?.toISOString() }
    }
  },
  {
    key: 'inventory',
    check: async () => {
      const count = await prisma.inventory.count({ where: { quantity: { gt: 0 } } })
      return { count }
    }
  },
  {
    key: 'dailyRecords',
    check: async () => {
      const now = new Date()
      const count = await prisma.dailyPieceRecord.count({
        where: {
          date: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          }
        }
      })
      return { count }
    }
  },
  {
    key: 'salary',
    check: async () => {
      const now = new Date()
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const count = await prisma.salaryBill.count({ where: { period } })
      const latest = await prisma.salaryBill.findFirst({ where: { period }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      return { count, latest: latest?.createdAt?.toISOString() }
    }
  }
]

export const getFlowStatus = async (_req: Request, res: Response) => {
  try {
    const results: Record<string, { status: string; count: number; latest?: string }> = {}

    for (const step of flowStepChecks) {
      const { count, latest } = await step.check()
      let status: string
      if (count > 0) {
        status = 'active'
      } else {
        status = 'pending'
      }
      results[step.key] = { status, count, latest }
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: results
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取流程状态失败',
      data: null
    })
  }
}
