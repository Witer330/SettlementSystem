import { Router } from 'express'
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '../controllers/supplier.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.get('/', authenticate, getSuppliers)
router.get('/:id', authenticate, getSupplier)
router.post('/', authenticate, createSupplier)
router.put('/:id', authenticate, updateSupplier)
router.delete('/:id', authenticate, deleteSupplier)

export default router
