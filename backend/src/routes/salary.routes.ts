import { Router } from 'express'
import { salaryController } from '../controllers/salary.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

// 所有工资路由都需要认证
router.use(authenticate)

// 工资计算
router.post('/calculate/:period', salaryController.calculateSalary)

// 获取工资单列表
router.get('/bills', salaryController.getSalaryBills)

// 获取工资单详情
router.get('/bills/:id', salaryController.getSalaryBillDetail)

// 审核工资单
router.put('/bills/:id/approve', salaryController.approveSalaryBill)

export default router
