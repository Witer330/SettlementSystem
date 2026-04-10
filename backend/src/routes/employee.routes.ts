import { Router } from 'express';
import { employeeController } from '../controllers/employee.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// 所有员工路由都需要认证
router.use(authenticate);

// 员工管理路由
router.get('/', employeeController.getList);
router.get('/:id', employeeController.getDetail);
router.post('/', employeeController.create);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.delete);

export default router;
