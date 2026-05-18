import { Router } from 'express'
import {
  getReceivables, getReceivable, getAvailableSalesOrders,
  createReceivable, updateReceivable, deleteReceivable,
  approveReceivable, revokeReceivable
} from '../controllers/receivable.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

// 可引用的销货单
router.get('/available-sales-orders', getAvailableSalesOrders)

// CRUD
router.get('/', getReceivables)
router.get('/:id', getReceivable)
router.post('/', createReceivable)
router.put('/:id', updateReceivable)
router.delete('/:id', deleteReceivable)

// 审核/反审
router.put('/:id/approve', approveReceivable)
router.put('/:id/revoke', revokeReceivable)

export default router
