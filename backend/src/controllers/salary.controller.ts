import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { type AuthRequest } from '../middleware/auth.middleware'
import crypto from 'crypto'

const otherSalaryTypeLabel = (type: string) =>
  ({ bonus: '奖金', performance: '绩效', task: '一次性任务' } as Record<string, string>)[type] || type

export const salaryController = {
  // 计算工资
  async calculateSalary(req: AuthRequest, res: Response) {
    try {
      const { period } = req.params // period: YYYY-MM
      const { employeeId, employeeIds } = req.query

      // 解析周期时间范围
      const periodStr = Array.isArray(period) ? period[0] : period
      const [year, month] = periodStr.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59, 999)

      // 获取需要计算的员工列表
      let employees
      if (employeeIds && typeof employeeIds === 'string') {
        const ids = employeeIds.split(',').map(Number)
        employees = await prisma.employee.findMany({
          where: { id: { in: ids }, status: 'active' }
        })
      } else if (employeeId) {
        const employee = await prisma.employee.findFirst({
          where: { id: Number(employeeId), status: 'active' }
        })
        employees = employee ? [employee] : []
      } else {
        const where: any = { status: 'active' }
        employees = await prisma.employee.findMany({ where })
      }

      const results = []

      for (const employee of employees) {
        // 检查是否已有工资单
        const existingBill = await prisma.salaryBill.findFirst({
          where: {
            employeeId: employee.id,
            period: periodStr
          }
        })

        if (existingBill) {
          results.push({
            employeeId: employee.id,
            employeeName: employee.name,
            period,
            message: '工资单已存在',
            billId: existingBill.id,
            status: existingBill.status,
            totalAmount: existingBill.totalAmount
          })
          continue
        }

        let hourlyHours = 0
        let hourlyAmount = 0
        let pieceAmount = 0
        let pieceCount = 0
        let otherAmount = 0
        let otherCount = 0
        const details: any[] = []

        const hourlyRate = employee.hourlyRate || 0

        // 查询工时记录
        const workLogs = await prisma.workLog.findMany({
          where: {
            employeeId: employee.id,
            date: { gte: startDate, lte: endDate }
          }
        })

        for (const log of workLogs) {
          hourlyHours += log.hours
          const amount = log.hours * hourlyRate
          hourlyAmount += amount
          details.push({
            type: 'hourly',
            date: log.date,
            quantity: log.hours,
            unitPrice: hourlyRate,
            amount,
            sourceRecordId: log.id,
            remark: log.remark
          })
        }

        // 查询计件记录
        const dailyRecords = await prisma.dailyPieceRecord.findMany({
          where: {
            employeeId: employee.id,
            date: { gte: startDate, lte: endDate }
          },
          include: { items: { include: { product: true } } }
        })

        for (const dr of dailyRecords) {
          for (const item of dr.items) {
            pieceAmount += item.amount
            pieceCount += item.quantity
            details.push({
              type: 'piece',
              date: dr.date,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
              sourceRecordId: dr.id,
              remark: dr.remark || `产品: ${item.product?.name || '-'}`
            })
          }
        }

        // 查询其他工资
        const otherSalaries = await prisma.otherSalary.findMany({
          where: {
            employeeId: employee.id,
            date: { gte: startDate, lte: endDate }
          }
        })

        for (const os of otherSalaries) {
          otherAmount += os.amount
          otherCount++
          details.push({
            type: 'other',
            date: os.date,
            quantity: 1,
            unitPrice: os.amount,
            amount: os.amount,
            sourceRecordId: os.id,
            remark: os.remark || otherSalaryTypeLabel(os.type)
          })
        }

        const totalAmount = hourlyAmount + pieceAmount + otherAmount

        // 事务：创建工资单和明细，保证原子性
        const bill = await prisma.$transaction(async (tx) => {
          const b = await tx.salaryBill.create({
            data: {
              employeeId: employee.id,
              period: periodStr,
              hourlyHours,
              hourlyAmount,
              pieceAmount,
              pieceCount,
              otherAmount,
              otherCount,
              totalAmount,
              status: 'pending'
            }
          })

          if (details.length > 0) {
            await tx.salaryBillDetail.createMany({
              data: details.map((detail) => ({
                ...detail,
                billId: b.id
              }))
            })
          }

          return b
        })

        results.push({
          employeeId: employee.id,
          employeeName: employee.name,
          period: periodStr,
          hourlyHours,
          hourlyAmount,
          pieceCount,
          pieceAmount,
          otherCount,
          otherAmount,
          totalAmount,
          billId: bill.id,
          status: 'pending'
        })
      }

      res.json({
        code: 0,
        message: '工资计算完成',
        data: results
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '工资计算失败',
        data: null
      })
    }
  },

  // 获取工资单列表
  async getSalaryBills(req: Request, res: Response) {
    try {
      const { page = '1', pageSize = '10', period, employeeId, status } = req.query

      const where: any = {}
      if (period) where.period = period
      if (employeeId) where.employeeId = Number(employeeId)
      if (status) where.status = status

      const [list, total] = await Promise.all([
        prisma.salaryBill.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                code: true
              }
            },
            details: {
              orderBy: { date: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize)
        }),
        prisma.salaryBill.count({ where })
      ])

      res.json({
        code: 0,
        message: '操作成功',
        data: {
          list,
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(total / Number(pageSize))
        }
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '获取工资单列表失败',
        data: null
      })
    }
  },

  // 审核工资单
  async approveSalaryBill(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { remark } = req.body

      if (!req.userId) {
        return res.status(401).json({
          code: 401,
          message: '未认证',
          data: null
        })
      }

      const existing = await prisma.salaryBill.findUnique({ where: { id: Number(id) } })
      if (!existing) {
        return res.status(404).json({ code: 404, message: '工资单不存在', data: null })
      }
      if (existing.status !== 'pending') {
        return res.status(400).json({ code: 400, message: '仅待审核的工资单可审核', data: null })
      }

      const bill = await prisma.salaryBill.update({
        where: { id: Number(id) },
        data: {
          status: 'approved',
          approvedBy: req.userId,
          approvedAt: new Date(),
          remark: remark || null
        },
        include: {
          employee: true
        }
      })

      res.json({
        code: 0,
        message: '工资单审核通过',
        data: bill
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '审核工资单失败',
        data: null
      })
    }
  },

  // 获取工资单详情
  async getSalaryBillDetail(req: Request, res: Response) {
    try {
      const { id } = req.params

      const bill = await prisma.salaryBill.findUnique({
        where: { id: Number(id) },
        include: {
          employee: true,
          details: {
            orderBy: { date: 'asc' }
          }
        }
      })

      if (!bill) {
        return res.status(404).json({
          code: 404,
          message: '工资单不存在',
          data: null
        })
      }

      res.json({
        code: 0,
        message: '操作成功',
        data: bill
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '获取工资单详情失败',
        data: null
      })
    }
  },

  // 反审工资单（仅已审核可反审，已发放不可反审）
  async revokeSalaryBill(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      const existing = await prisma.salaryBill.findUnique({ where: { id: Number(id) } })
      if (!existing) {
        return res.status(404).json({ code: 404, message: '工资单不存在', data: null })
      }
      if (existing.status === 'issued') {
        return res.status(400).json({ code: 400, message: '已发放的工资单不可反审', data: null })
      }
      if (existing.status !== 'approved') {
        return res.status(400).json({ code: 400, message: '仅已审核的工资单可反审', data: null })
      }

      const bill = await prisma.salaryBill.update({
        where: { id: Number(id) },
        data: {
          status: 'pending',
          approvedBy: null,
          approvedAt: null
        },
        include: { employee: true }
      })

      res.json({ code: 0, message: '反审成功，关联的计件/工时记录已解锁', data: bill })
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message || '反审失败', data: null })
    }
  },

  // 发放工资单（终态，生成数据哈希）
  async issueSalaryBill(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      const existing = await prisma.salaryBill.findUnique({
        where: { id: Number(id) },
        include: { employee: true, details: { orderBy: { date: 'asc' } } }
      })
      if (!existing) {
        return res.status(404).json({ code: 404, message: '工资单不存在', data: null })
      }
      if (existing.status !== 'approved') {
        return res.status(400).json({ code: 400, message: '仅已审核的工资单可发放', data: null })
      }

      // 生成数据哈希：将工资单核心数据序列化后 SHA-256
      const hashPayload = JSON.stringify({
        employeeId: existing.employeeId,
        period: existing.period,
        hourlyHours: existing.hourlyHours,
        hourlyAmount: existing.hourlyAmount,
        pieceAmount: existing.pieceAmount,
        pieceCount: existing.pieceCount,
        otherAmount: existing.otherAmount,
        otherCount: existing.otherCount,
        totalAmount: existing.totalAmount,
        details: existing.details.map(d => ({
          type: d.type,
          date: d.date,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          amount: d.amount
        }))
      })
      const dataHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

      const bill = await prisma.salaryBill.update({
        where: { id: Number(id) },
        data: {
          status: 'issued',
          issuedAt: new Date(),
          dataHash
        },
        include: { employee: true, details: true }
      })

      res.json({ code: 0, message: '工资已发放，数据已固化', data: bill })
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message || '发放失败', data: null })
    }
  },

  // 删除工资单（仅 pending 状态可删）
  async deleteSalaryBill(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      const existing = await prisma.salaryBill.findUnique({ where: { id: Number(id) } })
      if (!existing) {
        return res.status(404).json({ code: 404, message: '工资单不存在', data: null })
      }
      if (existing.status !== 'pending') {
        return res.status(400).json({ code: 400, message: '仅待审核的工资单可删除', data: null })
      }

      await prisma.salaryBill.delete({ where: { id: Number(id) } })
      res.json({ code: 0, message: '删除成功，关联的计件/工时记录已解锁', data: null })
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message || '删除失败', data: null })
    }
  },

  // 验证工资单数据完整性
  async verifySalaryBill(req: Request, res: Response) {
    try {
      const { id } = req.params

      const bill = await prisma.salaryBill.findUnique({
        where: { id: Number(id) },
        include: { details: { orderBy: { date: 'asc' } } }
      })
      if (!bill) {
        return res.status(404).json({ code: 404, message: '工资单不存在', data: null })
      }
      if (!bill.dataHash) {
        return res.json({ code: 0, message: '该工资单尚未发放，无数据哈希', data: { verified: false, reason: '未发放' } })
      }

      // 重新计算哈希
      const hashPayload = JSON.stringify({
        employeeId: bill.employeeId,
        period: bill.period,
        hourlyHours: bill.hourlyHours,
        hourlyAmount: bill.hourlyAmount,
        pieceAmount: bill.pieceAmount,
        pieceCount: bill.pieceCount,
        otherAmount: bill.otherAmount,
        otherCount: bill.otherCount,
        totalAmount: bill.totalAmount,
        details: bill.details.map(d => ({
          type: d.type,
          date: d.date,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          amount: d.amount
        }))
      })
      const currentHash = crypto.createHash('sha256').update(hashPayload).digest('hex')
      const verified = currentHash === bill.dataHash

      res.json({
        code: 0,
        message: verified ? '数据完整性校验通过' : '数据已被篡改',
        data: { verified, storedHash: bill.dataHash, currentHash }
      })
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message || '校验失败', data: null })
    }
  }
}
