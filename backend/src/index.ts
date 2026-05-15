import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { prisma } from './lib/prisma'
import { configService } from './services/config.service'

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
import customerRoutes from './routes/customer.routes'
import supplierRoutes from './routes/supplier.routes'
import purchaseOrderRoutes from './routes/purchaseOrder.routes'
import reportRoutes from './routes/report.routes'
import productionRecordRoutes from './routes/productionRecord.routes'
import processRoutes from './routes/process.routes'
import returnOrderRoutes from './routes/returnOrder.routes'

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
app.use('/api/v1/customers', customerRoutes)
app.use('/api/v1/suppliers', supplierRoutes)
app.use('/api/v1/purchase-orders', purchaseOrderRoutes)
app.use('/api/v1/reports', reportRoutes)
app.use('/api/v1/production-records', productionRecordRoutes)
app.use('/api/v1/processes', processRoutes)
app.use('/api/v1/return-orders', returnOrderRoutes)

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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    code: err.code || 500,
    message: err.message || 'Internal server error',
    data: null
  })
})

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
