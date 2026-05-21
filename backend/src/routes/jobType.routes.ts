import { Router } from 'express'
import * as jobTypeController from '../controllers/jobType.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

router.get('/next-code', authenticate, jobTypeController.getNextCode)
router.get('/', authenticate, validate({ query: jobTypeController.JobTypeListQuerySchema }), jobTypeController.getJobTypes)
router.get('/:id', authenticate, jobTypeController.getJobType)
router.post('/', authenticate, validate({ body: jobTypeController.JobTypeCreateSchema }), jobTypeController.createJobType)
router.put('/:id', authenticate, validate({ body: jobTypeController.JobTypeUpdateSchema }), jobTypeController.updateJobType)
router.delete('/:id', authenticate, jobTypeController.deleteJobType)
router.patch('/:id/restore', authenticate, jobTypeController.restoreJobType)

export default router
