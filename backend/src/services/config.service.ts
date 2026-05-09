import { prisma } from '../lib/prisma'

interface CacheEntry {
  value: string
  type: string
  defaultValue?: string
  category: string
  remark?: string
}

class ConfigService {
  private cache = new Map<string, CacheEntry>()
  private initialized = false

  /** 启动时从 DB 加载所有配置到缓存 */
  async init(): Promise<void> {
    const settings = await prisma.setting.findMany()
    for (const s of settings) {
      this.cache.set(s.key, {
        value: s.value,
        type: s.type,
        defaultValue: s.defaultValue ?? undefined,
        category: s.category,
        remark: s.remark ?? undefined
      })
    }
    this.initialized = true
    console.log(`📋 配置服务已初始化，加载 ${settings.length} 条配置`)
  }

  /** 按 key 获取配置值，自动按 type 解析 */
  get<T = any>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    return this.parseValue(entry.value, entry.type) as T
  }

  /** 获取配置值，若不存在则返回默认值 */
  getOrDefault<T>(key: string, defaultValue: T): T {
    const val = this.get<T>(key)
    return val !== undefined ? val : defaultValue
  }

  /** 设置配置值（upsert DB + 更新缓存 + 写审计日志） */
  async set(key: string, value: string, options?: {
    type?: string
    category?: string
    remark?: string
    defaultValue?: string
    userId?: number
    userName?: string
  }): Promise<void> {
    const existing = await prisma.setting.findUnique({ where: { key } })
    const oldValue = existing?.value ?? null
    const isCreate = !existing

    await prisma.$transaction(async (tx) => {
      // Upsert setting
      await tx.setting.upsert({
        where: { key },
        update: {
          value,
          ...(options?.type && { type: options.type }),
          ...(options?.category && { category: options.category }),
          ...(options?.remark && { remark: options.remark }),
          ...(options?.defaultValue !== undefined && { defaultValue: options.defaultValue }),
          ...(options?.userId && { updatedBy: options.userId })
        },
        create: {
          key,
          value,
          type: options?.type || 'string',
          category: options?.category || 'general',
          remark: options?.remark,
          defaultValue: options?.defaultValue,
          createdBy: options?.userId,
          updatedBy: options?.userId
        }
      })

      // 写审计日志
      await tx.settingAuditLog.create({
        data: {
          settingKey: key,
          oldValue,
          newValue: value,
          action: isCreate ? 'create' : 'update',
          userId: options?.userId,
          userName: options?.userName
        }
      })
    })

    // 更新缓存
    const entry = this.cache.get(key)
    this.cache.set(key, {
      value,
      type: options?.type || entry?.type || 'string',
      defaultValue: options?.defaultValue ?? entry?.defaultValue,
      category: options?.category || entry?.category || 'general',
      remark: options?.remark ?? entry?.remark
    })
  }

  /** 事务批量设置 */
  async batchSet(settings: Array<{
    key: string
    value: string
    type?: string
    category?: string
    remark?: string
    defaultValue?: string
  }>, options?: { userId?: number; userName?: string }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const s of settings) {
        const existing = await tx.setting.findUnique({ where: { key: s.key } })
        const oldValue = existing?.value ?? null
        const isCreate = !existing

        await tx.setting.upsert({
          where: { key: s.key },
          update: {
            value: s.value,
            ...(s.type && { type: s.type }),
            ...(s.category && { category: s.category }),
            ...(s.remark && { remark: s.remark }),
            ...(s.defaultValue !== undefined && { defaultValue: s.defaultValue }),
            ...(options?.userId && { updatedBy: options.userId })
          },
          create: {
            key: s.key,
            value: s.value,
            type: s.type || 'string',
            category: s.category || 'general',
            remark: s.remark,
            defaultValue: s.defaultValue,
            createdBy: options?.userId,
            updatedBy: options?.userId
          }
        })

        await tx.settingAuditLog.create({
          data: {
            settingKey: s.key,
            oldValue,
            newValue: s.value,
            action: isCreate ? 'create' : 'update',
            userId: options?.userId,
            userName: options?.userName
          }
        })

        // 更新缓存
        this.cache.set(s.key, {
          value: s.value,
          type: s.type || 'string',
          defaultValue: s.defaultValue,
          category: s.category || 'general',
          remark: s.remark
        })
      }
    })
  }

  /** 获取所有配置，可按 category 过滤 */
  getAll(category?: string): Array<{ key: string } & CacheEntry> {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({ key, ...entry }))
    if (category) {
      return entries.filter(e => e.category === category)
    }
    return entries
  }

  /** 删除配置 */
  async remove(key: string, options?: { userId?: number; userName?: string }): Promise<boolean> {
    const existing = await prisma.setting.findUnique({ where: { key } })
    if (!existing) return false

    await prisma.$transaction(async (tx) => {
      await tx.setting.delete({ where: { key } })
      await tx.settingAuditLog.create({
        data: {
          settingKey: key,
          oldValue: existing.value,
          newValue: null,
          action: 'delete',
          userId: options?.userId,
          userName: options?.userName
        }
      })
    })

    this.cache.delete(key)
    return true
  }

  /** 清除缓存（key 为空则清除全部） */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  /** 获取审计日志 */
  async getAuditLogs(params: {
    settingKey?: string
    page?: number
    pageSize?: number
  }): Promise<{ list: any[]; total: number }> {
    const { settingKey, page = 1, pageSize = 20 } = params
    const where: any = {}
    if (settingKey) where.settingKey = settingKey

    const [list, total] = await Promise.all([
      prisma.settingAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.settingAuditLog.count({ where })
    ])

    return { list, total }
  }

  /** 按类型解析值 */
  private parseValue(value: string, type: string): any {
    switch (type) {
      case 'json':
        try { return JSON.parse(value) } catch { return value }
      case 'number':
        return Number(value)
      case 'boolean':
        return value === 'true'
      default:
        return value
    }
  }
}

export const configService = new ConfigService()
