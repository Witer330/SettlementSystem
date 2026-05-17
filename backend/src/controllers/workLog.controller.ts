import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 获取工时记录列表
export const getWorkLogs = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', employeeId, startDate, endDate } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (employeeId) where.employeeId = Number(employeeId)
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(String(startDate))
      if (endDate) where.date.lte = new Date(String(endDate))
    }

    const [list, total] = await Promise.all([
      prisma.workLog.findMany({
        where, skip, take,
        orderBy: { date: 'desc' },
        include: {
          employee: { select: { id: true, name: true, code: true, hourlyRate: true } }
        }
      }),
      prisma.workLog.count({ where })
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

// 获取单条工时记录
export const getWorkLog = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const record = await prisma.workLog.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, code: true, hourlyRate: true } }
      }
    })
    if (!record) {
      res.status(404).json({ code: 404, message: '工时记录不存在' })
      return
    }
    res.json({ code: 0, message: '获取成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

// 创建工时记录
export const createWorkLog = async (req: Request, res: Response) => {
  try {
    const { employeeId, date, hours, remark } = req.body

    if (!employeeId || !date || !hours) {
      res.status(400).json({ code: 400, message: '员工、日期和工时不能为空' })
      return
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      res.status(404).json({ code: 404, message: '员工不存在' })
      return
    }

    const record = await prisma.workLog.create({
      data: {
        employeeId,
        date: new Date(date),
        hours,
        remark
      },
      include: {
        employee: { select: { id: true, name: true, code: true, hourlyRate: true } }
      }
    })

    res.json({ code: 0, message: '创建成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 更新工时记录
export const updateWorkLog = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.workLog.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '工时记录不存在' })
      return
    }

    // 检查是否已被已审核/已发放的工资单锁定
    const lockedDetail = await prisma.salaryBillDetail.findFirst({
      where: {
        type: 'hourly',
        sourceRecordId: id,
        bill: { status: { in: ['approved', 'issued'] } }
      }
    })
    if (lockedDetail) {
      res.status(400).json({ code: 400, message: '该记录已被审核/发放的工资单锁定，请先反审工资单' })
      return
    }

    const { employeeId, date, hours, remark } = req.body
    const data: any = {}
    if (employeeId !== undefined) data.employeeId = employeeId
    if (date !== undefined) data.date = new Date(date)
    if (hours !== undefined) data.hours = hours
    if (remark !== undefined) data.remark = remark

    const record = await prisma.workLog.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, name: true, code: true, hourlyRate: true } }
      }
    })

    res.json({ code: 0, message: '更新成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 删除工时记录
export const deleteWorkLog = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.workLog.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '工时记录不存在' })
      return
    }

    // 检查是否已被已审核/已发放的工资单锁定
    const lockedDetail = await prisma.salaryBillDetail.findFirst({
      where: {
        type: 'hourly',
        sourceRecordId: id,
        bill: { status: { in: ['approved', 'issued'] } }
      }
    })
    if (lockedDetail) {
      res.status(400).json({ code: 400, message: '该记录已被审核/发放的工资单锁定，请先反审工资单' })
      return
    }

    await prisma.workLog.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}

// 月度工时汇总
export const getMonthlySummary = async (req: Request, res: Response) => {
  try {
    const { employeeId, period } = req.params
    const periodStr = String(period)
    const [year, month] = periodStr.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const employee = await prisma.employee.findUnique({
      where: { id: Number(employeeId) },
      select: { id: true, name: true, code: true, hourlyRate: true }
    })
    if (!employee) {
      res.status(404).json({ code: 404, message: '员工不存在' })
      return
    }

    const records = await prisma.workLog.findMany({
      where: {
        employeeId: Number(employeeId),
        date: { gte: startDate, lte: endDate }
      },
      orderBy: { date: 'asc' }
    })

    const totalHours = records.reduce((sum, r) => sum + r.hours, 0)
    const totalAmount = totalHours * (employee.hourlyRate || 0)

    res.json({
      code: 0,
      message: '获取成功',
      data: { employee, totalHours, totalAmount, records, period }
    })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}
