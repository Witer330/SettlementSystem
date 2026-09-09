import { Router } from 'express'
import {
  getInventoryList,
  getInventoryLogs,
  adjustInventory,
  getInventoryDetail,
  getProductStockList,
  adjustProductStock,
  batchCreateLogs,
  approveBatch,
  unapproveBatch
} from '../controllers/inventory.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

// 原材料库存
router.get('/', getInventoryList)
router.get('/logs', getInventoryLogs)
router.get('/:materialId', getInventoryDetail)
router.post('/batch', batchCreateLogs)
router.post('/batch/approve', approveBatch)
router.post('/batch/unapprove', unapproveBatch)
router.post('/adjust', adjustInventory)

// 成品库存
router.get('/products/list', getProductStockList)
router.post('/products/adjust', adjustProductStock)

export default router
