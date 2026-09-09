import { Router } from 'express'
import { getSheets, getSheet, createSheet, updateSheet, approveSheet, unapproveSheet, getApprovedItems } from '../controllers/salaryDetail.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', getSheets)
router.get('/approved-items', getApprovedItems)
router.get('/:id', getSheet)
router.post('/', createSheet)
router.put('/:id', updateSheet)
router.patch('/:id/approve', approveSheet)
router.patch('/:id/unapprove', unapproveSheet)

export default router
