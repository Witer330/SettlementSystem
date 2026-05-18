import { Router } from 'express'
import {
  getPayables, getPayable, getAvailablePurchaseOrders,
  createPayable, updatePayable, deletePayable,
  approvePayable, revokePayable
} from '../controllers/payable.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

// 可引用的采购单
router.get('/available-purchase-orders', getAvailablePurchaseOrders)

// CRUD
router.get('/', getPayables)
router.get('/:id', getPayable)
router.post('/', createPayable)
router.put('/:id', updatePayable)
router.delete('/:id', deletePayable)

// 审核/反审
router.put('/:id/approve', approvePayable)
router.put('/:id/revoke', revokePayable)

export default router
