import { Router } from 'express'
import * as productController from '../controllers/product.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.get('/', authenticate, productController.getProducts)
router.get('/:id', authenticate, productController.getProduct)
router.post('/', authenticate, productController.createProduct)
router.put('/:id', authenticate, productController.updateProduct)
router.delete('/:id', authenticate, productController.deleteProduct)

export default router
