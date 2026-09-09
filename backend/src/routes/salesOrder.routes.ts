import { Router } from 'express'
import {
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
  restoreSalesOrder,
  updateSalesOrderStatus,
  shipSalesOrder,
  getMaterialRequirements
} from '../controllers/salesOrder.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/', getSalesOrders)
router.get('/:id', getSalesOrder)
router.post('/', createSalesOrder)
router.put('/:id', updateSalesOrder)
router.delete('/:id', deleteSalesOrder)
router.patch('/:id/restore', restoreSalesOrder)
router.post('/:id/ship', shipSalesOrder)
router.patch('/:id/status', updateSalesOrderStatus)
router.get('/:id/material-requirements', getMaterialRequirements)

export default router
