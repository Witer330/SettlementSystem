import { Router } from 'express'
import * as departmentController from '../controllers/department.controller'

const router = Router()

// Department management
router.get('/', departmentController.getDepartments)
router.get('/:id', departmentController.getDepartment)
router.post('/', departmentController.createDepartment)
router.put('/:id', departmentController.updateDepartment)
router.delete('/:id', departmentController.deleteDepartment)

export default router
