import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

// 使用 vitest.config.ts 中设置的共享测试数据库
const prisma = new PrismaClient()

// 在测试前同步数据库
beforeAll(async () => {
  const { execSync } = await import('child_process')
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: 'pipe'
  })
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})

// 每个测试前清理
beforeEach(async () => {
  await prisma.settingAuditLog.deleteMany()
  await prisma.setting.deleteMany()
})

describe('Setting 模型', () => {
  it('应该能创建设置项', async () => {
    const setting = await prisma.setting.create({
      data: {
        key: 'test.key',
        value: 'test-value',
        type: 'string',
        category: 'general',
        remark: '测试配置'
      }
    })

    expect(setting.key).toBe('test.key')
    expect(setting.value).toBe('test-value')
    expect(setting.type).toBe('string')
    expect(setting.category).toBe('general')
    expect(setting.createdAt).toBeDefined()
  })

  it('应该能更新设置项', async () => {
    await prisma.setting.create({
      data: { key: 'test.key', value: 'old-value', type: 'string', category: 'general' }
    })

    const updated = await prisma.setting.update({
      where: { key: 'test.key' },
      data: { value: 'new-value' }
    })

    expect(updated.value).toBe('new-value')
  })

  it('应该能批量创建设置项', async () => {
    const settings = [
      { key: 'key1', value: 'val1', type: 'string', category: 'general' },
      { key: 'key2', value: '42', type: 'number', category: 'system' },
      { key: 'key3', value: '{"a":1}', type: 'json', category: 'ui' }
    ]

    for (const s of settings) {
      await prisma.setting.create({ data: s })
    }

    const count = await prisma.setting.count()
    expect(count).toBe(3)
  })

  it('应该按 category 过滤', async () => {
    await prisma.setting.create({ data: { key: 'k1', value: 'v1', type: 'string', category: 'ui' } })
    await prisma.setting.create({ data: { key: 'k2', value: 'v2', type: 'string', category: 'system' } })
    await prisma.setting.create({ data: { key: 'k3', value: 'v3', type: 'string', category: 'ui' } })

    const uiSettings = await prisma.setting.findMany({ where: { category: 'ui' } })
    expect(uiSettings).toHaveLength(2)
  })
})

describe('SettingAuditLog 模型', () => {
  it('应该能创建审计日志', async () => {
    const log = await prisma.settingAuditLog.create({
      data: {
        settingKey: 'test.key',
        oldValue: 'old',
        newValue: 'new',
        action: 'update',
        userId: 1,
        userName: '管理员'
      }
    })

    expect(log.settingKey).toBe('test.key')
    expect(log.action).toBe('update')
    expect(log.userName).toBe('管理员')
  })

  it('应该按 settingKey 过滤审计日志', async () => {
    await prisma.settingAuditLog.create({
      data: { settingKey: 'key.a', action: 'create' }
    })
    await prisma.settingAuditLog.create({
      data: { settingKey: 'key.b', action: 'create' }
    })
    await prisma.settingAuditLog.create({
      data: { settingKey: 'key.a', action: 'update' }
    })

    const logs = await prisma.settingAuditLog.findMany({ where: { settingKey: 'key.a' } })
    expect(logs).toHaveLength(2)
  })

  it('应该按 createdAt 倒序排列', async () => {
    const log1 = await prisma.settingAuditLog.create({
      data: { settingKey: 'k', action: 'create' }
    })
    // 确保时间差
    await new Promise(r => setTimeout(r, 10))
    const log2 = await prisma.settingAuditLog.create({
      data: { settingKey: 'k', action: 'update' }
    })

    const logs = await prisma.settingAuditLog.findMany({
      orderBy: { createdAt: 'desc' }
    })
    expect(logs[0].id).toBe(log2.id)
    expect(logs[1].id).toBe(log1.id)
  })
})

describe('ConfigService 逻辑', () => {
  // 测试值解析逻辑（不需要 DB）
  function parseValue(value: string, type: string): any {
    switch (type) {
      case 'json': try { return JSON.parse(value) } catch { return value }
      case 'number': return Number(value)
      case 'boolean': return value === 'true'
      default: return value
    }
  }

  it('应该正确解析 string 类型', () => {
    expect(parseValue('hello', 'string')).toBe('hello')
  })

  it('应该正确解析 number 类型', () => {
    expect(parseValue('42', 'number')).toBe(42)
    expect(parseValue('3.14', 'number')).toBe(3.14)
  })

  it('应该正确解析 boolean 类型', () => {
    expect(parseValue('true', 'boolean')).toBe(true)
    expect(parseValue('false', 'boolean')).toBe(false)
  })

  it('应该正确解析 json 类型', () => {
    expect(parseValue('{"a":1}', 'json')).toEqual({ a: 1 })
    expect(parseValue('[1,2,3]', 'json')).toEqual([1, 2, 3])
  })

  it('JSON 解析失败时返回原始字符串', () => {
    expect(parseValue('not-json', 'json')).toBe('not-json')
  })
})
