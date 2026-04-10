import { Router } from 'express';
import * as coefficientController from '../controllers/coefficient.controller';

const router = Router();

// 规格系数管理
router.post('/', coefficientController.createCoefficient);
router.get('/', coefficientController.getCoefficients);
router.put('/:id', coefficientController.updateCoefficient);
router.delete('/:id', coefficientController.deleteCoefficient);

// 初始化默认系数
router.post('/init', coefficientController.initDefaultCoefficients);

export default router;
