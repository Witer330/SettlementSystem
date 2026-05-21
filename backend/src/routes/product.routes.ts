import { Router } from 'express'
import * as productController from '../controllers/product.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

router.get('/', authenticate, validate({ query: productController.ProductListQuerySchema }), productController.getProducts)
router.get('/:id', authenticate, productController.getProduct)
router.post('/', authenticate, validate({ body: productController.ProductCreateSchema }), productController.createProduct)
router.put('/:id', authenticate, validate({ body: productController.ProductUpdateSchema }), productController.updateProduct)
router.delete('/:id', authenticate, productController.deleteProduct)
router.patch('/:id/restore', authenticate, productController.restoreProduct)

export default router
