import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const prisma = new PrismaClient()

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
import specRoutes from './routes/spec.routes'
import dailyPieceRoutes from './routes/dailyPiece.routes'
import productRoutes from './routes/product.routes'
import departmentRoutes from './routes/department.routes'
import jobTypeRoutes from './routes/jobType.routes'
import settingRoutes from './routes/setting.routes'
import materialRoutes from './routes/material.routes'
import salesOrderRoutes from './routes/salesOrder.routes'
import bomRoutes from './routes/bom.routes'

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/employees', employeeRoutes)
app.use('/api/v1/salary', salaryRoutes)
app.use('/api/v1/specs', specRoutes)
app.use('/api/v1/daily-records', dailyPieceRoutes)
app.use('/api/v1/products', productRoutes)
app.use('/api/v1/departments', departmentRoutes)
app.use('/api/v1/job-types', jobTypeRoutes)
app.use('/api/v1/settings', settingRoutes)
app.use('/api/v1/materials', materialRoutes)
app.use('/api/v1/sales-orders', salesOrderRoutes)
app.use('/api/v1/bom', bomRoutes)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    code: 0,
    message: 'Settlement System API',
    data: {
      version: '1.0.0',
      status: 'running'
    }
  })
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
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`)
})

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
