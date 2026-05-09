import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import express from 'express'
import settingRoutes from '../../src/routes/setting.routes'
import { configService } from '../../src/services/config.service'
import { config } from '../../src/config'

// 使用 vitest.config.ts 中设置的共享测试数据库
const prisma = new PrismaClient()
let app: express.Express
let adminToken: string
let operatorToken: string

beforeAll(async () => {
  // 同步数据库
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: 'pipe'
  })
  await prisma.$connect()

  // 清理旧测试数据
  await prisma.settingAuditLog.deleteMany()
  await prisma.setting.deleteMany()
  await prisma.user.deleteMany()

  // 创建测试用户
  const admin = await prisma.user.create({
    data: { username: 'test-admin', password: 'hashed', name: '测试管理员', role: 'admin', status: 'active' }
  })
  const operator = await prisma.user.create({
    data: { username: 'test-operator', password: 'hashed', name: '测试操作员', role: 'operator', status: 'active' }
  })

  adminToken = jwt.sign({ userId: admin.id, role: 'admin' }, config.jwt.secret, { expiresIn: '1h' })
  operatorToken = jwt.sign({ userId: operator.id, role: 'operator' }, config.jwt.secret, { expiresIn: '1h' })

  // 初始化 ConfigService 缓存
  await configService.init()

  // 创建 Express 应用
  app = express()
  app.use(express.json())
  app.use('/api/v1/settings', settingRoutes)
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await prisma.settingAuditLog.deleteMany()
  await prisma.setting.deleteMany()
  configService.invalidateCache()
  // 重新初始化缓存（空的）
  await configService.init()
})

// 通过临时服务器发送请求
async function request(method: string, path: string, options?: {
  body?: any
  token?: string
}): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const addr = server.address() as any
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (options?.token) headers['Authorization'] = `Bearer ${options.token}`

      try {
        const res = await fetch(`http://localhost:${addr.port}${path}`, {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined
        })
        const body = await res.json()
        server.close()
        resolve({ status: res.status, body })
      } catch (err: any) {
        server.close()
        resolve({ status: 500, body: { error: err.message } })
      }
    })
  })
}

describe('GET /api/v1/settings', () => {
  it('无鉴权应返回 401', async () => {
    const { status } = await request('GET', '/api/v1/settings')
    expect(status).toBe(401)
  })

  it('已登录用户应获取设置列表', async () => {
    await configService.set('test.key', 'test-value', { type: 'string', category: 'general' })

    const { status, body } = await request('GET', '/api/v1/settings', { token: adminToken })
    expect(status).toBe(200)
    expect(body.code).toBe(0)
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('应支持按 category 过滤', async () => {
    await configService.set('k1', 'v1', { type: 'string', category: 'ui' })
    await configService.set('k2', 'v2', { type: 'string', category: 'system' })

    const { status, body } = await request('GET', '/api/v1/settings?category=ui', { token: adminToken })
    expect(status).toBe(200)
    expect(body.data.every((s: any) => s.category === 'ui')).toBe(true)
  })
})

describe('GET /api/v1/settings/:key', () => {
  it('应获取单个设置值', async () => {
    await configService.set('my.setting', 'hello', { type: 'string', category: 'general' })

    const { status, body } = await request('GET', '/api/v1/settings/my.setting', { token: adminToken })
    expect(status).toBe(200)
    expect(body.data.key).toBe('my.setting')
    expect(body.data.value).toBe('hello')
  })

  it('不存在的 key 应返回 404', async () => {
    const { status } = await request('GET', '/api/v1/settings/nonexistent', { token: adminToken })
    expect(status).toBe(404)
  })
})

describe('PUT /api/v1/settings/:key', () => {
  it('admin 应能更新设置并创建审计日志', async () => {
    await configService.set('test.update', 'old', { type: 'string', category: 'general' })
    // 清理 setup 阶段产生的审计日志
    await prisma.settingAuditLog.deleteMany()

    const { status, body } = await request('PUT', '/api/v1/settings/test.update', {
      token: adminToken,
      body: { value: 'new', remark: '更新测试' }
    })
    expect(status).toBe(200)
    expect(body.code).toBe(0)

    // 验证 ConfigService 缓存已更新
    expect(configService.get('test.update')).toBe('new')

    // 验证审计日志已创建
    const logs = await prisma.settingAuditLog.findMany({ where: { settingKey: 'test.update' } })
    expect(logs).toHaveLength(1)
    expect(logs[0].oldValue).toBe('old')
    expect(logs[0].newValue).toBe('new')
    expect(logs[0].action).toBe('update')
  })

  it('operator 应返回 403', async () => {
    const { status } = await request('PUT', '/api/v1/settings/test.key', {
      token: operatorToken,
      body: { value: 'new' }
    })
    expect(status).toBe(403)
  })

  it('空值应返回 400', async () => {
    const { status } = await request('PUT', '/api/v1/settings/test.key', {
      token: adminToken,
      body: { value: '' }
    })
    expect(status).toBe(400)
  })
})

describe('POST /api/v1/settings/batch', () => {
  it('admin 应能批量更新设置（事务性）', async () => {
    const { status, body } = await request('POST', '/api/v1/settings/batch', {
      token: adminToken,
      body: {
        settings: [
          { key: 'batch.k1', value: 'v1', remark: '批量1' },
          { key: 'batch.k2', value: 'v2', remark: '批量2' }
        ]
      }
    })
    expect(status).toBe(200)
    expect(body.code).toBe(0)

    // 验证 ConfigService 缓存中已有两条记录
    expect(configService.get('batch.k1')).toBe('v1')
    expect(configService.get('batch.k2')).toBe('v2')

    // 验证审计日志
    const logs = await prisma.settingAuditLog.count()
    expect(logs).toBe(2)
  })
})

describe('GET /api/v1/settings/system-info', () => {
  it('应返回真实系统信息', async () => {
    const { status, body } = await request('GET', '/api/v1/settings/system-info', { token: adminToken })
    expect(status).toBe(200)
    expect(body.code).toBe(0)
    expect(body.data.version).toBeDefined()
    expect(body.data.nodeVersion).toBeDefined()
    expect(body.data.env).toBeDefined()
    expect(typeof body.data.uptime).toBe('number')
    expect(body.data.memory).toBeDefined()
    expect(typeof body.data.memory.used).toBe('number')
    expect(typeof body.data.memory.total).toBe('number')
  })
})
