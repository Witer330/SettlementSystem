import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import {
  getProcesses, getProcess, createProcess, updateProcess, deleteProcess,
  getProductProcesses, saveProductProcesses,
  getProcessRates, saveProcessRate, deleteProcessRate
} from '../controllers/process.controller'

const router = Router()
router.use(authenticate)

// 产品工序关联（必须在 /:id 之前）
router.get('/product/:productId', getProductProcesses)
router.post('/product/:productId', saveProductProcesses)

// 员工工序单价（必须在 /:id 之前）
router.get('/rates/list', getProcessRates)
router.post('/rates', saveProcessRate)
router.delete('/rates/:id', deleteProcessRate)

// 工序 CRUD
router.get('/', getProcesses)
router.get('/:id', getProcess)
router.post('/', createProcess)
router.put('/:id', updateProcess)
router.delete('/:id', deleteProcess)

export default router
