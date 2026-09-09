import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { execSync } from 'child_process'
import { prisma } from './lib/prisma'
import { runSeed } from './lib/seed'
import { configService } from './services/config.service'
import { startSchedule, stopSchedule } from './services/backup.service'
import { auditLogger } from './middleware/audit.middleware'
import { errorHandler } from './middleware/error.middleware'

// Load environment variables
dotenv.config()

// SQLite 自动初始化：首次运行时自动执行迁移
function ensureDatabaseReady() {
  const dbUrl = process.env.DATABASE_URL || 'file:./data/settlement.db'
  if (!dbUrl.startsWith('file:')) return // 非 SQLite 不自动迁移

  // 检查数据库文件是否存在
  const dbPath = dbUrl.replace('file:', '').replace('sqlite:', '')
  const fullPath = path.resolve(dbPath)
  if (!require('fs').existsSync(fullPath)) {
    console.log('数据库未初始化，正在自动创建...')
  }

  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      timeout: 30000,
      env: { ...process.env }
    })
  } catch (e) {
    console.error('数据库迁移失败，请手动执行: npx prisma migrate deploy')
  }
}

ensureDatabaseReady()

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

// Middleware
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: 'Health check passed',
    data: {
      timestamp: new Date().toISOString()
    }
  })
})

// API Routes
import employeeRoutes from './routes/employee.routes'
import authRoutes from './routes/auth.routes'
import salaryRoutes from './routes/salary.routes'
import dailyPieceRoutes from './routes/dailyPiece.routes'
import productRoutes from './routes/product.routes'
import departmentRoutes from './routes/department.routes'
import jobTypeRoutes from './routes/jobType.routes'
import settingRoutes from './routes/setting.routes'
import materialRoutes from './routes/material.routes'
import salesOrderRoutes from './routes/salesOrder.routes'
import bomRoutes from './routes/bom.routes'
import inventoryRoutes from './routes/inventory.routes'
import dashboardRoutes from './routes/dashboard.routes'
import partnerRoutes from './routes/partner.routes'
import partnerCustomFieldRoutes from './routes/partnerCustomField.routes'
import purchaseOrderRoutes from './routes/purchaseOrder.routes'
import reportRoutes from './routes/report.routes'
import productionOrderRoutes from './routes/productionOrder.routes'
import workLogRoutes from './routes/workLog.routes'
import returnOrderRoutes from './routes/returnOrder.routes'
import salaryDetailRoutes from './routes/salaryDetail.routes'
import otherSalaryRoutes from './routes/otherSalary.routes'
import receivableRoutes from './routes/receivable.routes'
import pkgSpecRoutes from './routes/pkgSpec.routes'
import payableRoutes from './routes/payable.routes'
// updateRoutes 已移除，更新检查仅由 Tauri service-manager 直连 OSS 完成
import backupRoutes from './routes/backup.routes'

// 审计中间件 — 必须在所有业务路由之前；auth 中间件已在各路由内部挂载，req.userId 由 routes 内 authenticate 填入
app.use('/api/v1', auditLogger)

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/employees', employeeRoutes)
app.use('/api/v1/salary-detail', salaryDetailRoutes)
app.use('/api/v1/salary', salaryRoutes)
app.use('/api/v1/daily-records', dailyPieceRoutes)
app.use('/api/v1/products', productRoutes)
app.use('/api/v1/departments', departmentRoutes)
app.use('/api/v1/job-types', jobTypeRoutes)
app.use('/api/v1/settings', settingRoutes)
app.use('/api/v1/materials', materialRoutes)
app.use('/api/v1/sales-orders', salesOrderRoutes)
app.use('/api/v1/bom', bomRoutes)
app.use('/api/v1/inventory', inventoryRoutes)
app.use('/api/v1/dashboard', dashboardRoutes)
app.use('/api/v1/partners', partnerRoutes)
app.use('/api/v1/partner-custom-fields', partnerCustomFieldRoutes)
app.use('/api/v1/production-orders', productionOrderRoutes)
app.use('/api/v1/purchase-orders', purchaseOrderRoutes)
app.use('/api/v1/reports', reportRoutes)
app.use('/api/v1/work-logs', workLogRoutes)
app.use('/api/v1/other-salaries', otherSalaryRoutes)
app.use('/api/v1/return-orders', returnOrderRoutes)
app.use('/api/v1/receivables', receivableRoutes)
app.use('/api/v1/pkg-specs', pkgSpecRoutes)
app.use('/api/v1/payables', payableRoutes)
// 更新检查已移至 Tauri service-manager（Rust 直连 OSS），不再经过后端 API
app.use('/api/v1/backup', backupRoutes)

// Static file serving (production: serve frontend build)
const frontendDist = path.join(__dirname, '../../frontend/dist')
app.use(express.static(frontendDist))

// SPA fallback — 非 API 路由全部返回 index.html
app.get('/{*path}', (req, res) => {
  // 如果请求的是 API 路径但没匹配到路由，返回 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      code: 404,
      message: '接口不存在',
      data: null
    })
  }
  res.sendFile(path.join(frontendDist, 'index.html'))
})

// Error handling middleware — 统一错误响应（AppError / Zod / Prisma / 兜底 500）
app.use(errorHandler)

// Start server
async function start() {
  // 数据库种子（首次启动创建默认管理员 + 默认设置，幂等）
  try {
    await runSeed()
  } catch (e) {
    console.error('[seed] 初始化失败:', e)
  }

  // 初始化配置服务
  await configService.init()

  // 启动自动备份定时任务
  startSchedule()

  const server = app.listen(PORT, () => {
    const addr = server.address()
    const actualPort = typeof addr === 'object' && addr ? addr.port : PORT
    // PORT=0 时，Tauri 通过 stdout 捕获实际端口
    if (PORT === 0) {
      console.log(`__PORT__:${actualPort}`)
    } else {
      console.log(`Server is running on http://localhost:${actualPort}`)
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
    }
  })
}

start()

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  stopSchedule()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  stopSchedule()
  await prisma.$disconnect()
  process.exit(0)
})
