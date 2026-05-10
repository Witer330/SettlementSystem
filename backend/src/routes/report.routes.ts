import { Router } from 'express'
import {
  getPurchaseReport,
  getSalesReport,
  getInventoryReport,
  getSalaryReport
} from '../controllers/report.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.get('/purchase', authenticate, getPurchaseReport)
router.get('/sales', authenticate, getSalesReport)
router.get('/inventory', authenticate, getInventoryReport)
router.get('/salary', authenticate, getSalaryReport)

export default router
