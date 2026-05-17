import { Router } from 'express'
import {
  getWorkLogs,
  getWorkLog,
  createWorkLog,
  updateWorkLog,
  deleteWorkLog,
  getMonthlySummary
} from '../controllers/workLog.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.get('/', authenticate, getWorkLogs)
router.get('/summary/:employeeId/:period', authenticate, getMonthlySummary)
router.get('/:id', authenticate, getWorkLog)
router.post('/', authenticate, createWorkLog)
router.put('/:id', authenticate, updateWorkLog)
router.delete('/:id', authenticate, deleteWorkLog)

export default router
