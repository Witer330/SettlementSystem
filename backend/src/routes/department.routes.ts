import { Router } from 'express'
import * as departmentController from '../controllers/department.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

router.get('/', authenticate, validate({ query: departmentController.DepartmentListQuerySchema }), departmentController.getDepartments)
router.get('/:id', authenticate, departmentController.getDepartment)
router.post('/', authenticate, validate({ body: departmentController.DepartmentCreateSchema }), departmentController.createDepartment)
router.put('/:id', authenticate, validate({ body: departmentController.DepartmentUpdateSchema }), departmentController.updateDepartment)
router.delete('/:id', authenticate, departmentController.deleteDepartment)
router.patch('/:id/restore', authenticate, departmentController.restoreDepartment)

export default router
