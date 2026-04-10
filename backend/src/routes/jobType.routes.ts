import { Router } from 'express';
import * as jobTypeController from '../controllers/jobType.controller';

const router = Router();

// JobType management
router.get('/next-code', jobTypeController.getNextCode);
router.get('/', jobTypeController.getJobTypes);
router.get('/:id', jobTypeController.getJobType);
router.post('/', jobTypeController.createJobType);
router.put('/:id', jobTypeController.updateJobType);
router.delete('/:id', jobTypeController.deleteJobType);

export default router;
