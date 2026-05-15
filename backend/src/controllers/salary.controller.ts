import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { type AuthRequest } from '../middleware/auth.middleware'

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
        employees = await prisma.employee.findMany({
          where: { status: 'active' }
        })
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
        const details: any[] = []

        if (employee.payType === 'hourly') {
          // 时薪计算：基于工时记录
          const workLogs = await prisma.workLog.findMany({
            where: {
              employeeId: employee.id,
              date: {
                gte: startDate,
                lte: endDate
              }
            }
          })

          for (const log of workLogs) {
            hourlyHours += log.hours
            const amount = log.hours * employee.hourlyRate
            hourlyAmount += amount

            details.push({
              type: 'hourly',
              date: log.date,
              quantity: log.hours,
              unitPrice: employee.hourlyRate,
              amount,
              remark: log.remark
            })
          }
        } else {
          // 计件计算：生产报工 + 每日计件记录，两者合并计算
          // 1. 生产报工记录（按工序计件）
          const productionRecords = await prisma.productionRecord.findMany({
            where: {
              employeeId: employee.id,
              date: { gte: startDate, lte: endDate }
            },
            include: { process: true }
          })

          for (const record of productionRecords) {
            const unitPrice = await this.getPieceRate(employee.id, record.productId, record.processId)
            const amount = record.quantity * unitPrice
            pieceAmount += amount
            pieceCount += Math.floor(record.quantity)
            details.push({
              type: 'piece',
              date: record.date,
              productId: record.productId,
              processId: record.processId,
              quantity: record.quantity,
              unitPrice,
              amount,
              remark: record.remark
            })
          }

          // 2. 每日计件记录（按规格计件，单价已预计算）
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
                remark: dr.remark || `产品: ${item.product?.name || '-'}`
              })
            }
          }
        }

        const totalAmount = hourlyAmount + pieceAmount

        // 创建工资单
        const bill = await prisma.salaryBill.create({
          data: {
            employeeId: employee.id,
            period: periodStr,
            hourlyHours,
            hourlyAmount,
            pieceAmount,
            pieceCount,
            totalAmount,
            status: 'pending'
          }
        })

        // 创建明细
        if (details.length > 0) {
          await prisma.salaryBillDetail.createMany({
            data: details.map((detail) => ({
              ...detail,
              billId: bill.id
            }))
          })
        }

        results.push({
          employeeId: employee.id,
          employeeName: employee.name,
          period: periodStr,
          payType: employee.payType,
          hourlyHours,
          hourlyAmount,
          pieceCount,
          pieceAmount,
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

  // 获取计件单价
  async getPieceRate(employeeId: number, productId: number, processId: number): Promise<number> {
    // 1. 特定员工对特定产品工序的单价
    const specificRate = await prisma.processRate.findFirst({
      where: {
        employeeId,
        productId,
        processId
      }
    })
    if (specificRate) return specificRate.price

    // 2. 特定员工对某个工序的单价
    const employeeProcessRate = await prisma.processRate.findFirst({
      where: {
        employeeId,
        processId,
        productId: null
      }
    })
    if (employeeProcessRate) return employeeProcessRate.price

    // 3. 工序默认单价
    const process = await prisma.process.findUnique({
      where: { id: processId }
    })
    if (process && process.defaultPrice > 0) return process.defaultPrice

    // 4. 员工默认计件单价
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    })
    if (employee && employee.pieceRate > 0) return employee.pieceRate

    return 0
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
                code: true,
                payType: true
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
  }
}
