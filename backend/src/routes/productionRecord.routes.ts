import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getProductionRecords, getProductionRecord, createProductionRecord, deleteProductionRecord } from '../controllers/productionRecord.controller'

const router = Router()
router.use(authenticate)
router.get('/', getProductionRecords)
router.get('/:id', getProductionRecord)
router.post('/', createProductionRecord)
router.delete('/:id', deleteProductionRecord)

export default router
