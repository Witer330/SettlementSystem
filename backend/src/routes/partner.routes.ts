import { Router } from 'express'
import * as partnerController from '../controllers/partner.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

router.get('/', authenticate, validate({ query: partnerController.PartnerListQuerySchema }), partnerController.getPartners)
router.get('/:id', authenticate, partnerController.getPartner)
router.post('/', authenticate, validate({ body: partnerController.PartnerCreateSchema }), partnerController.createPartner)
router.put('/:id', authenticate, validate({ body: partnerController.PartnerUpdateSchema }), partnerController.updatePartner)
router.delete('/:id', authenticate, partnerController.deletePartner)
router.patch('/:id/restore', authenticate, partnerController.restorePartner)

export default router
