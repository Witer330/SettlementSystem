import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 采购报表
export const getPurchaseReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query
    const where: any = {}
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate as string)
      if (endDate) where.createdAt.lte = new Date(endDate as string + 'T23:59:59')
    }

    // 月度趋势
    const orders = await prisma.purchaseOrder.findMany({
      where,
      select: { totalAmount: true, status: true, createdAt: true, supplierId: true }
    })

    const trendMap = new Map<string, number>()
    const supplierMap = new Map<string, number>()
    const statusMap = new Map<string, number>()

    for (const order of orders) {
      // 月度趋势
      const month = order.createdAt.toISOString().slice(0, 7)
      trendMap.set(month, (trendMap.get(month) || 0) + order.totalAmount)

      // 状态计数
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1)
    }

    // 供应商占比（需要 JOIN 获取名称）
    const supplierIds = [...new Set(orders.map(o => o.supplierId).filter(Boolean) as number[])]
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true }
    })
    const supplierNameMap = new Map(suppliers.map(s => [s.id, s.name]))

    // 重新计算供应商占比
    const supplierMap2 = new Map<string, number>()
    for (const order of orders) {
      if (!order.supplierId) continue
      const name = supplierNameMap.get(order.supplierId) || '未知'
      supplierMap2.set(name, (supplierMap2.get(name) || 0) + order.totalAmount)
    }

    const trend = Array.from(trendMap.entries())
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const breakdown = Array.from(supplierMap2.entries())
      .map(([name, total]) => ({ name, value: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.value - a.value)

    const statusDist = Array.from(statusMap.entries())
      .map(([name, value]) => ({ name, value }))

    const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0)
    const totalOrders = orders.length

    res.json({
      code: 0,
      message: '获取成功',
      data: { trend, breakdown, statusDistribution: statusDist, summary: { totalAmount, totalOrders } }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 销售报表
export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query
    const where: any = {}
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate as string)
      if (endDate) where.createdAt.lte = new Date(endDate as string + 'T23:59:59')
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      select: { totalAmount: true, customerId: true, createdAt: true }
    })

    // 月度趋势
    const trendMap = new Map<string, number>()
    for (const order of orders) {
      const month = order.createdAt.toISOString().slice(0, 7)
      trendMap.set(month, (trendMap.get(month) || 0) + order.totalAmount)
    }

    // 客户占比
    const customerIds = [...new Set(orders.map(o => o.customerId).filter(Boolean) as number[])]
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true }
    })
    const customerNameMap = new Map(customers.map(c => [c.id, c.name]))

    const customerMap = new Map<string, number>()
    for (const order of orders) {
      if (!order.customerId) continue
      const name = customerNameMap.get(order.customerId) || '未知'
      customerMap.set(name, (customerMap.get(name) || 0) + order.totalAmount)
    }

    // 产品销售排行
    const salesItems = await prisma.salesItem.findMany({
      where: { order: where.createdAt ? { createdAt: where.createdAt } : undefined },
      select: { quantity: true, price: true, productId: true }
    })

    const productMap = new Map<string, { quantity: number; amount: number }>()
    const productIds = [...new Set(salesItems.map(i => i.productId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    })
    const productNameMap = new Map(products.map(p => [p.id, p.name]))

    for (const item of salesItems) {
      const name = productNameMap.get(item.productId) || '未知'
      const existing = productMap.get(name) || { quantity: 0, amount: 0 }
      existing.quantity += item.quantity
      existing.amount += item.quantity * item.price
      productMap.set(name, existing)
    }

    const trend = Array.from(trendMap.entries())
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const breakdown = Array.from(customerMap.entries())
      .map(([name, total]) => ({ name, value: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.value - a.value)

    const productRanking = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, quantity: data.quantity, amount: Math.round(data.amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount)

    const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0)
    const totalOrders = orders.length

    res.json({
      code: 0,
      message: '获取成功',
      data: { trend, breakdown, productRanking, summary: { totalAmount, totalOrders } }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 库存报表
export const getInventoryReport = async (req: Request, res: Response) => {
  try {
    // 分类库存总览
    const inventoryItems = await prisma.inventory.findMany({
      include: { material: { select: { name: true, category: true, safeStock: true, unit: true } } }
    })

    const categoryMap = new Map<string, { totalQuantity: number; itemCount: number }>()
    let lowStockCount = 0
    let emptyStockCount = 0
    let normalCount = 0

    for (const item of inventoryItems) {
      const cat = item.material.category || '未分类'
      const existing = categoryMap.get(cat) || { totalQuantity: 0, itemCount: 0 }
      existing.totalQuantity += item.quantity
      existing.itemCount += 1
      categoryMap.set(cat, existing)

      if (item.quantity <= 0) emptyStockCount++
      else if (item.quantity < item.material.safeStock) lowStockCount++
      else normalCount++
    }

    // 出入库趋势（最近12个月）
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const logs = await prisma.inventoryLog.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { type: true, quantity: true, createdAt: true }
    })

    const inTrendMap = new Map<string, number>()
    const outTrendMap = new Map<string, number>()

    for (const log of logs) {
      const month = log.createdAt.toISOString().slice(0, 7)
      if (log.type === 'in') {
        inTrendMap.set(month, (inTrendMap.get(month) || 0) + log.quantity)
      } else {
        outTrendMap.set(month, (outTrendMap.get(month) || 0) + log.quantity)
      }
    }

    const allMonths = [...new Set([...inTrendMap.keys(), ...outTrendMap.keys()])].sort()
    const movementTrend = allMonths.map(month => ({
      month,
      inflow: Math.round((inTrendMap.get(month) || 0) * 100) / 100,
      outflow: Math.round((outTrendMap.get(month) || 0) * 100) / 100
    }))

    const categoryOverview = Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        totalQuantity: Math.round(data.totalQuantity * 100) / 100,
        itemCount: data.itemCount
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)

    const statusDistribution = [
      { name: '正常', value: normalCount },
      { name: '偏低', value: lowStockCount },
      { name: '缺货', value: emptyStockCount }
    ]

    res.json({
      code: 0,
      message: '获取成功',
      data: { categoryOverview, movementTrend, statusDistribution, summary: { totalMaterials: inventoryItems.length, normalCount, lowStockCount, emptyStockCount } }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 工资报表
export const getSalaryReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query
    const where: any = {}
    if (startDate || endDate) {
      // period 格式为 YYYY-MM，通过日期范围筛选
      if (startDate) {
        const startPeriod = (startDate as string).slice(0, 7)
        where.period = { gte: startPeriod }
      }
      if (endDate) {
        const endPeriod = (endDate as string).slice(0, 7)
        where.period = { ...(where.period || {}), lte: endPeriod }
      }
    }

    const bills = await prisma.salaryBill.findMany({
      where,
      select: { totalAmount: true, hourlyAmount: true, pieceAmount: true, period: true, employeeId: true }
    })

    // 月度趋势
    const trendMap = new Map<string, number>()
    const hourlyMap = new Map<string, number>()
    const pieceMap = new Map<string, number>()

    for (const bill of bills) {
      trendMap.set(bill.period, (trendMap.get(bill.period) || 0) + bill.totalAmount)
      hourlyMap.set(bill.period, (hourlyMap.get(bill.period) || 0) + bill.hourlyAmount)
      pieceMap.set(bill.period, (pieceMap.get(bill.period) || 0) + bill.pieceAmount)
    }

    // 部门占比
    const employeeIds = [...new Set(bills.map(b => b.employeeId))]
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, departmentId: true }
    })
    const empMap = new Map(employees.map(e => [e.id, e]))

    const deptIds = [...new Set(employees.map(e => e.departmentId).filter(Boolean))]
    const departments = await prisma.department.findMany({
      where: { id: { in: deptIds as number[] } },
      select: { id: true, name: true }
    })
    const deptMap = new Map(departments.map(d => [d.id, d.name]))

    const deptAmountMap = new Map<string, number>()
    for (const bill of bills) {
      const emp = empMap.get(bill.employeeId)
      const deptName = emp?.departmentId ? deptMap.get(emp.departmentId) || '未分配' : '未分配'
      deptAmountMap.set(deptName, (deptAmountMap.get(deptName) || 0) + bill.totalAmount)
    }

    const trend = Array.from(trendMap.entries())
      .map(([period, total]) => ({
        period,
        total: Math.round(total * 100) / 100,
        hourly: Math.round((hourlyMap.get(period) || 0) * 100) / 100,
        piece: Math.round((pieceMap.get(period) || 0) * 100) / 100
      }))
      .sort((a, b) => a.period.localeCompare(b.period))

    const breakdown = Array.from(deptAmountMap.entries())
      .map(([name, total]) => ({ name, value: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.value - a.value)

    const totalAmount = bills.reduce((sum, b) => sum + b.totalAmount, 0)
    const totalHourly = bills.reduce((sum, b) => sum + b.hourlyAmount, 0)
    const totalPiece = bills.reduce((sum, b) => sum + b.pieceAmount, 0)

    res.json({
      code: 0,
      message: '获取成功',
      data: { trend, breakdown, summary: { totalAmount, totalHourly, totalPiece, billCount: bills.length } }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}
