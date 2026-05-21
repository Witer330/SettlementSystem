import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth.middleware'

// 路径前缀 → module 映射（从 /api/v1/{slug}/... 推断）
const SLUG_TO_MODULE: Record<string, { module: string; entityType: string }> = {
  products: { module: 'product', entityType: 'Product' },
  materials: { module: 'material', entityType: 'Material' },
  partners: { module: 'partner', entityType: 'Partner' },
  departments: { module: 'department', entityType: 'Department' },
  'job-types': { module: 'jobType', entityType: 'JobType' },
  employees: { module: 'employee', entityType: 'Employee' },
  'sales-orders': { module: 'salesOrder', entityType: 'SalesOrder' },
  'purchase-orders': { module: 'purchaseOrder', entityType: 'PurchaseOrder' },
  'production-orders': { module: 'productionOrder', entityType: 'ProductionOrder' },
  'return-orders': { module: 'returnOrder', entityType: 'ReturnOrder' },
  'daily-records': { module: 'dailyPiece', entityType: 'DailyPieceRecord' },
  'work-logs': { module: 'workLog', entityType: 'WorkLog' },
  'other-salaries': { module: 'otherSalary', entityType: 'OtherSalary' },
  receivables: { module: 'receivable', entityType: 'Receivable' },
  payables: { module: 'payable', entityType: 'Payable' },
  bom: { module: 'bom', entityType: 'BillOfMaterial' },
  inventory: { module: 'inventory', entityType: 'Inventory' },
  salary: { module: 'salary', entityType: 'SalaryBill' },
  settings: { module: 'setting', entityType: 'Setting' },
  auth: { module: 'auth', entityType: 'User' }
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function detectAction(method: string, path: string): string {
  if (method === 'DELETE') return 'delete'
  if (/\/archive(\/|$|\?)/.test(path)) return 'archive'
  if (/\/restore(\/|$|\?)/.test(path)) return 'restore'
  if (method === 'POST') return 'create'
  return 'update' // PUT / PATCH
}

function extractSlug(path: string): string | null {
  // path 形如 /api/v1/products/123 或 /products/123
  const m = path.match(/\/api\/v1\/([^/?]+)/) || path.match(/^\/([^/?]+)/)
  return m ? m[1] : null
}

function extractEntityId(req: AuthRequest, responseData: any): string | null {
  // 优先从 params 拿 id
  const pid = (req.params && (req.params.id || req.params.key))
  if (pid) return String(pid)
  // 否则从响应体的 data.id 拿
  if (responseData && typeof responseData === 'object') {
    if ('id' in responseData) return String(responseData.id)
    if ('key' in responseData) return String(responseData.key)
  }
  return null
}

export function auditLogger(req: AuthRequest, res: Response, next: NextFunction) {
  if (!WRITE_METHODS.has(req.method)) return next()

  // 跳过非 /api/v1 的写请求
  if (!req.path.startsWith('/api/v1/')) return next()

  const slug = extractSlug(req.path)
  if (!slug) return next()

  // 跳过 auth 的登录接口（不算审计目标，避免日志噪声）
  if (slug === 'auth' && (req.path.endsWith('/login') || req.path.endsWith('/logout'))) {
    return next()
  }

  const meta = SLUG_TO_MODULE[slug] || { module: slug, entityType: slug }
  const action = detectAction(req.method, req.path)

  const originalJson = res.json.bind(res)
  res.json = function (body: any) {
    // 仅在业务成功（code === 0 或 HTTP 2xx）时记录
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300 && body && body.code === 0
    if (isSuccess) {
      const entityId = extractEntityId(req, body?.data)
      // 截断 newValue 防止过大
      let newValueStr: string | null = null
      try {
        if (body?.data) {
          const json = JSON.stringify(body.data)
          newValueStr = json.length > 4000 ? json.slice(0, 4000) + '...(truncated)' : json
        }
      } catch {
        newValueStr = null
      }

      // 异步写入，失败不影响响应
      ;(prisma as any).operationLog
        .create({
          data: {
            module: meta.module,
            entityType: meta.entityType,
            entityId,
            action,
            method: req.method,
            path: req.path,
            oldValue: null,
            newValue: newValueStr,
            userId: req.userId ?? null,
            userName: null,
            ip: (req.headers['x-forwarded-for'] as string) || req.ip || null,
            status: res.statusCode
          }
        })
        .catch((err: any) => {
          console.error('[audit] write failed:', err?.message || err)
        })
    }
    return originalJson(body)
  }

  next()
}
