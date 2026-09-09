import { Router } from 'express'
import { getDashboardStats, getFlowStatus } from '../controllers/dashboard.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/stats', getDashboardStats)
router.get('/flow-status', getFlowStatus)

export default router
