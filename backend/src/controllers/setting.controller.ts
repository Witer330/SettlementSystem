import { Response } from 'express'
import { type AuthRequest } from '../middleware/auth.middleware'
import { configService } from '../services/config.service'
import { prisma } from '../lib/prisma'
import { config } from '../config'

// 获取系统设置列表
export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query
    const settings = configService.getAll(category as string | undefined)

    res.json({
      code: 0,
      message: '获取成功',
      data: settings
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取设置失败',
      data: null
    })
  }
}

// 获取单个设置
export const getSetting = async (req: AuthRequest, res: Response) => {
  try {
    const key = req.params.key as string
    const value = configService.get(key)

    if (value === undefined) {
      return res.status(404).json({
        code: 404,
        message: '设置不存在',
        data: null
      })
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: { key, value }
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取设置失败',
      data: null
    })
  }
}

// 更新设置
export const updateSetting = async (req: AuthRequest, res: Response) => {
  try {
    const key = req.params.key as string
    const { value, remark, type, category, defaultValue } = req.body

    if (value === undefined || value === '') {
      return res.status(400).json({
        code: 400,
        message: '设置值不能为空',
        data: null
      })
    }

    // 获取操作人信息
    let userName: string | undefined
    if (req.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { name: true }
      })
      userName = user?.name
    }

    await configService.set(key, String(value), {
      type,
      category,
      remark,
      defaultValue,
      userId: req.userId,
      userName
    })

    res.json({
      code: 0,
      message: '更新成功',
      data: { key, value }
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新设置失败',
      data: null
    })
  }
}

// 批量更新设置（事务性）
export const batchUpdateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body

    if (!Array.isArray(settings)) {
      return res.status(400).json({
        code: 400,
        message: '设置格式错误',
        data: null
      })
    }

    // 获取操作人信息
    let userName: string | undefined
    if (req.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { name: true }
      })
      userName = user?.name
    }

    await configService.batchSet(
      settings.map((s: any) => ({
        key: s.key,
        value: String(s.value),
        type: s.type,
        category: s.category,
        remark: s.remark,
        defaultValue: s.defaultValue
      })),
      { userId: req.userId, userName }
    )

    res.json({
      code: 0,
      message: '批量更新成功',
      data: null
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '批量更新失败',
      data: null
    })
  }
}

// 获取系统信息（真实数据）
export const getSystemInfo = async (_req: AuthRequest, res: Response) => {
  try {
    const memUsage = process.memoryUsage()
    const [settingCount, userCount, employeeCount] = await Promise.all([
      prisma.setting.count(),
      prisma.user.count(),
      prisma.employee.count()
    ])

    // 读取 package.json 获取版本号
    let version = '1.0.0'
    try {
      const pkg = require('../../package.json')
      version = pkg.version || '1.0.0'
    } catch {}

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        version,
        nodeVersion: process.version,
        env: config.nodeEnv,
        dbVersion: '5.20.0',
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024)
        },
        settingCount,
        userCount,
        employeeCount
      }
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取系统信息失败',
      data: null
    })
  }
}

// 获取配置审计日志
export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { settingKey, page = '1', pageSize = '20' } = req.query

    const result = await configService.getAuditLogs({
      settingKey: settingKey as string | undefined,
      page: Number(page),
      pageSize: Number(pageSize)
    })

    res.json({
      code: 0,
      message: '获取成功',
      data: result
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取审计日志失败',
      data: null
    })
  }
}
