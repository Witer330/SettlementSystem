import { Router } from 'express'
import {
  getInventoryList,
  getInventoryLogs,
  adjustInventory,
  getInventoryDetail,
  getProductStockList,
  adjustProductStock
} from '../controllers/inventory.controller'

const router = Router()

// 原材料库存
router.get('/', getInventoryList)
router.get('/logs', getInventoryLogs)
router.get('/:materialId', getInventoryDetail)
router.post('/adjust', adjustInventory)

// 成品库存
router.get('/products/list', getProductStockList)
router.post('/products/adjust', adjustProductStock)

export default router
