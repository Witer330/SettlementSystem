import { Router } from 'express'
import {
  getProductionOrders,
  getProductionOrder,
  createProductionOrder,
  updateProductionOrder,
  deleteProductionOrder,
  generatePickingItems,
  pickMaterials,
  completeProduction,
  updateProductionOrderStatus
} from '../controllers/productionOrder.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.get('/', authenticate, getProductionOrders)
router.get('/:id', authenticate, getProductionOrder)
router.post('/', authenticate, createProductionOrder)
router.put('/:id', authenticate, updateProductionOrder)
router.delete('/:id', authenticate, deleteProductionOrder)
router.post('/:id/generate-picking', authenticate, generatePickingItems)
router.post('/:id/pick', authenticate, pickMaterials)
router.post('/:id/complete', authenticate, completeProduction)
router.patch('/:id/status', authenticate, updateProductionOrderStatus)

export default router
