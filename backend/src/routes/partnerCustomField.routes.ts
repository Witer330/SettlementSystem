import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import {
  getCustomFields, createCustomField, updateCustomField,
  deleteCustomField, updateCustomFieldValues
} from '../controllers/partnerCustomField.controller'

const router = Router()
router.use(authenticate)

router.get('/', getCustomFields)
router.post('/', createCustomField)
router.put('/:id', updateCustomField)
router.delete('/:id', deleteCustomField)
router.put('/values/:partnerId', updateCustomFieldValues)

export default router
