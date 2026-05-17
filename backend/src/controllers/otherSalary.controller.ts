import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// 获取其他工资列表
export const getOtherSalaries = async (req: Request, res: Response) => {
  try {
    const { page = '1', pageSize = '20', employeeId, startDate, endDate, type } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (employeeId) where.employeeId = Number(employeeId)
    if (type) where.type = String(type)
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(String(startDate))
      if (endDate) where.date.lte = new Date(String(endDate))
    }

    const [list, total] = await Promise.all([
      prisma.otherSalary.findMany({
        where, skip, take,
        orderBy: { date: 'desc' },
        include: {
          employee: { select: { id: true, name: true, code: true } }
        }
      }),
      prisma.otherSalary.count({ where })
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

// 创建其他工资
export const createOtherSalary = async (req: Request, res: Response) => {
  try {
    const { employeeId, date, type = 'task', amount, remark } = req.body

    if (!employeeId || !date || !amount || amount <= 0) {
      res.status(400).json({ code: 400, message: '员工、日期和金额不能为空' })
      return
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      res.status(404).json({ code: 404, message: '员工不存在' })
      return
    }

    const record = await prisma.otherSalary.create({
      data: { employeeId, date: new Date(date), type, amount, remark },
      include: {
        employee: { select: { id: true, name: true, code: true } }
      }
    })

    res.json({ code: 0, message: '创建成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

// 更新其他工资
export const updateOtherSalary = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.otherSalary.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '记录不存在' })
      return
    }

    // 检查是否已被已审核/已发放的工资单锁定
    const lockedDetail = await prisma.salaryBillDetail.findFirst({
      where: {
        type: 'other',
        sourceRecordId: id,
        bill: { status: { in: ['approved', 'issued'] } }
      }
    })
    if (lockedDetail) {
      res.status(400).json({ code: 400, message: '该记录已被审核/发放的工资单锁定，请先反审工资单' })
      return
    }

    const { employeeId, date, type, amount, remark } = req.body
    const data: any = {}
    if (employeeId !== undefined) data.employeeId = employeeId
    if (date !== undefined) data.date = new Date(date)
    if (type !== undefined) data.type = type
    if (amount !== undefined) data.amount = amount
    if (remark !== undefined) data.remark = remark

    const record = await prisma.otherSalary.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, name: true, code: true } }
      }
    })

    res.json({ code: 0, message: '更新成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

// 删除其他工资
export const deleteOtherSalary = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.otherSalary.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ code: 404, message: '记录不存在' })
      return
    }

    // 检查是否已被已审核/已发放的工资单锁定
    const lockedDetail = await prisma.salaryBillDetail.findFirst({
      where: {
        type: 'other',
        sourceRecordId: id,
        bill: { status: { in: ['approved', 'issued'] } }
      }
    })
    if (lockedDetail) {
      res.status(400).json({ code: 400, message: '该记录已被审核/发放的工资单锁定，请先反审工资单' })
      return
    }

    await prisma.otherSalary.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}
