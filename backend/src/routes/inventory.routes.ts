import { Router } from 'express'
import {
  getInventoryList,
  getInventoryLogs,
  adjustInventory,
  getInventoryDetail
} from '../controllers/inventory.controller'

const router = Router()

router.get('/', getInventoryList)
router.get('/logs', getInventoryLogs)
router.get('/:materialId', getInventoryDetail)
router.post('/adjust', adjustInventory)

export default router
