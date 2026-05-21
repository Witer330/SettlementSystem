import { Router } from 'express'
import {
  getMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  restoreMaterial,
  MaterialCreateSchema,
  MaterialUpdateSchema,
  MaterialListQuerySchema
} from '../controllers/material.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

router.get('/', authenticate, validate({ query: MaterialListQuerySchema }), getMaterials)
router.get('/:id', authenticate, getMaterial)
router.post('/', authenticate, validate({ body: MaterialCreateSchema }), createMaterial)
router.put('/:id', authenticate, validate({ body: MaterialUpdateSchema }), updateMaterial)
router.delete('/:id', authenticate, deleteMaterial)
router.patch('/:id/restore', authenticate, restoreMaterial)

export default router
