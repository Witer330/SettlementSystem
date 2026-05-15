import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getReturnOrders, getReturnOrder, createReturnOrder, completeReturnOrder, cancelReturnOrder, scrapReturnOrder } from '../controllers/returnOrder.controller'

const router = Router()
router.use(authenticate)

router.get('/', getReturnOrders)
router.get('/:id', getReturnOrder)
router.post('/', createReturnOrder)
router.patch('/:id/complete', completeReturnOrder)
router.patch('/:id/cancel', cancelReturnOrder)
router.patch('/:id/scrap', scrapReturnOrder)

export default router
