import { Router } from 'express'
import {
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
  updateSalesOrderStatus,
  getMaterialRequirements
} from '../controllers/salesOrder.controller'

const router = Router()

router.get('/', getSalesOrders)
router.get('/:id', getSalesOrder)
router.post('/', createSalesOrder)
router.put('/:id', updateSalesOrder)
router.delete('/:id', deleteSalesOrder)
router.patch('/:id/status', updateSalesOrderStatus)
router.get('/:id/material-requirements', getMaterialRequirements)

export default router
