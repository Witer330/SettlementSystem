import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 创建每日计件记录
export const createDailyRecord = async (req: Request, res: Response) => {
  try {
    const { employeeId, date, items, remark } = req.body

    // 计算总金额
    let totalAmount = 0
    for (const item of items) {
      const spec = await prisma.productSpec.findUnique({
        where: { id: item.specId },
        include: { specPrice: true }
      })

      if (!spec) {
        return res.status(404).json({
          code: 404,
          message: `规格ID ${item.specId} 不存在`,
          data: null
        })
      }

      if (!spec.specPrice) {
        return res.status(400).json({
          code: 400,
          message: `规格 "${spec.name}" 未设置单价`,
          data: null
        })
      }

      const amount = item.quantity * spec.specPrice.unitPrice
      item.unitPrice = spec.specPrice.unitPrice
      item.amount = amount
      totalAmount += amount
    }

    // 创建记录
    const record = await prisma.dailyPieceRecord.create({
      data: {
        employeeId,
        date: new Date(date),
        totalAmount,
        remark,
        items: {
          create: items.map((item: any) => ({
            specId: item.specId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount
          }))
        }
      },
      include: {
        employee: true,
        items: {
          include: {
            spec: {
              include: {
                product: true
              }
            }
          }
        }
      }
    })

    res.json({
      code: 0,
      message: '创建成功',
      data: record
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '创建失败',
      data: null
    })
  }
}

// 获取每日计件记录列表
export const getDailyRecords = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, employeeId, date, startDate, endDate } = req.query

    const where: any = {}
    if (employeeId) where.employeeId = parseInt(employeeId as string)
    if (date) {
      const dateObj = new Date(date as string)
      const nextDay = new Date(dateObj)
      nextDay.setDate(nextDay.getDate() + 1)
      where.date = {
        gte: dateObj,
        lt: nextDay
      }
    }
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    }

    const [list, total] = await Promise.all([
      prisma.dailyPieceRecord.findMany({
        where,
        include: {
          employee: true,
          items: {
            include: {
              spec: {
                include: {
                  product: true
                }
              }
            }
          }
        },
        orderBy: { date: 'desc' },
        skip: ((page as number) - 1) * (pageSize as number),
        take: parseInt(pageSize as string)
      }),
      prisma.dailyPieceRecord.count({ where })
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

// 获取每日计件记录详情
export const getDailyRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const record = await prisma.dailyPieceRecord.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        employee: true,
        items: {
          include: {
            spec: {
              include: {
                product: true
              }
            }
          }
        }
      }
    })

    if (!record) {
      return res.status(404).json({
        code: 404,
        message: '记录不存在',
        data: null
      })
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: record
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    })
  }
}

// 更新每日计件记录
export const updateDailyRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { items, remark } = req.body

    // 删除原有明细
    await prisma.dailyPieceRecordItem.deleteMany({
      where: { recordId: parseInt(id as string) }
    })

    // 计算新总金额
    let totalAmount = 0
    for (const item of items) {
      const spec = await prisma.productSpec.findUnique({
        where: { id: item.specId },
        include: { specPrice: true }
      })

      if (!spec || !spec.specPrice) {
        continue
      }

      const amount = item.quantity * spec.specPrice.unitPrice
      totalAmount += amount
    }

    // 更新记录
    const record = await prisma.dailyPieceRecord.update({
      where: { id: parseInt(id as string) },
      data: {
        totalAmount,
        remark,
        items: {
          create: items.map((item: any) => {
            const spec = item.spec || { specPrice: { unitPrice: item.unitPrice } }
            return {
              specId: item.specId,
              quantity: item.quantity,
              unitPrice: spec.specPrice?.unitPrice || item.unitPrice,
              amount: item.quantity * (spec.specPrice?.unitPrice || item.unitPrice)
            }
          })
        }
      },
      include: {
        employee: true,
        items: {
          include: {
            spec: {
              include: {
                product: true
              }
            }
          }
        }
      }
    })

    res.json({
      code: 0,
      message: '更新成功',
      data: record
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新失败',
      data: null
    })
  }
}

// 删除每日计件记录
export const deleteDailyRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    await prisma.dailyPieceRecord.delete({
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

// 获取员工月度计件汇总
export const getMonthlySummary = async (req: Request, res: Response) => {
  try {
    const { employeeId, period } = req.params // period format: YYYY-MM

    const [year, month] = (period as string).split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const records = await prisma.dailyPieceRecord.findMany({
      where: {
        employeeId: parseInt(employeeId as string),
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        items: {
          include: {
            spec: {
              include: {
                product: true
              }
            }
          }
        }
      },
      orderBy: { date: 'asc' }
    })

    // 汇总统计
    let totalAmount = 0
    let totalCount = 0
    const specSummary: any = {}

    records.forEach((record) => {
      totalAmount += record.totalAmount
      record.items.forEach((item) => {
        totalCount += item.quantity

        const specKey = `${item.spec.product.name}-${item.spec.name}`
        if (!specSummary[specKey]) {
          specSummary[specKey] = {
            specName: item.spec.name,
            productName: item.spec.product.name,
            quantity: 0,
            amount: 0
          }
        }
        specSummary[specKey].quantity += item.quantity
        specSummary[specKey].amount += item.amount
      })
    })

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        records,
        summary: {
          totalAmount,
          totalCount,
          specSummary: Object.values(specSummary)
        }
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
