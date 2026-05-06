import { Router } from 'express'
import * as specController from '../controllers/spec.controller'

const router = Router()

// 产品规格管理
router.post('/', specController.createProductSpec)
router.get('/', specController.getProductSpecs)
router.get('/:id', specController.getProductSpec)
router.put('/:id', specController.updateProductSpec)
router.delete('/:id', specController.deleteProductSpec)

// 重新计算单价
router.post('/:id/recalculate', specController.recalculateSpecPrice)

export default router
