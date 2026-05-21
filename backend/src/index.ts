import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { prisma } from './lib/prisma'
import { configService } from './services/config.service'
import { auditLogger } from './middleware/audit.middleware'
import { errorHandler } from './middleware/error.middleware'

// Load environment variables
dotenv.config()

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

// Middleware
app.use(helmet())
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
import purchaseOrderRoutes from './routes/purchaseOrder.routes'
import reportRoutes from './routes/report.routes'
import productionOrderRoutes from './routes/productionOrder.routes'
import workLogRoutes from './routes/workLog.routes'
import returnOrderRoutes from './routes/returnOrder.routes'
import otherSalaryRoutes from './routes/otherSalary.routes'
import receivableRoutes from './routes/receivable.routes'
import payableRoutes from './routes/payable.routes'

// 审计中间件 — 必须在所有业务路由之前；auth 中间件已在各路由内部挂载，req.userId 由 routes 内 authenticate 填入
app.use('/api/v1', auditLogger)

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/employees', employeeRoutes)
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
app.use('/api/v1/production-orders', productionOrderRoutes)
app.use('/api/v1/purchase-orders', purchaseOrderRoutes)
app.use('/api/v1/reports', reportRoutes)
app.use('/api/v1/work-logs', workLogRoutes)
app.use('/api/v1/other-salaries', otherSalaryRoutes)
app.use('/api/v1/return-orders', returnOrderRoutes)
app.use('/api/v1/receivables', receivableRoutes)
app.use('/api/v1/payables', payableRoutes)

// Static file serving (production: serve frontend build)
const frontendDist = path.join(__dirname, '../../frontend/dist')
app.use(express.static(frontendDist))

// SPA fallback — 非 API 路由全部返回 index.html
app.get('{*path}', (req, res) => {
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
  // 初始化配置服务
  await configService.init()

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
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})
