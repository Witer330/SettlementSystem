import { Router } from 'express'
import { getDashboardStats, getFlowStatus } from '../controllers/dashboard.controller'

const router = Router()

router.get('/stats', getDashboardStats)
router.get('/flow-status', getFlowStatus)

export default router
