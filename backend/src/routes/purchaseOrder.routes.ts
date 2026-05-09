import { Router } from 'express'
import {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrder
} from '../controllers/purchaseOrder.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.get('/', authenticate, getPurchaseOrders)
router.get('/:id', authenticate, getPurchaseOrder)
router.post('/', authenticate, createPurchaseOrder)
router.put('/:id', authenticate, updatePurchaseOrder)
router.delete('/:id', authenticate, deletePurchaseOrder)
router.patch('/:id/status', authenticate, updatePurchaseOrderStatus)
router.post('/:id/receive', authenticate, receivePurchaseOrder)

export default router
