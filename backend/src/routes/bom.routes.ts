import { Router } from 'express'
import {
  getBomByProduct,
  saveBom,
  addBomItem,
  deleteBomItem
} from '../controllers/bom.controller'

const router = Router()

router.get('/product/:productId', getBomByProduct)
router.post('/product/:productId', saveBom)
router.post('/product/:productId/item', addBomItem)
router.delete('/:id', deleteBomItem)

export default router
