import { Router } from 'express'
import * as otherSalaryController from '../controllers/otherSalary.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', otherSalaryController.getOtherSalaries)
router.post('/', otherSalaryController.createOtherSalary)
router.put('/:id', otherSalaryController.updateOtherSalary)
router.delete('/:id', otherSalaryController.deleteOtherSalary)

export default router
