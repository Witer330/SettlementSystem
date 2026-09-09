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

// 反审工资单（仅已审核可反审）
router.put('/bills/:id/revoke', salaryController.revokeSalaryBill)

// 发放工资单（终态，生成数据哈希）
router.put('/bills/:id/issue', salaryController.issueSalaryBill)
router.put('/unissue-test', (req, res) => { res.json({ ok: true }) })
router.put('/bills/:id/unissue', (req, res) => { res.json({ ok: true, id: req.params.id }) })
router.post('/bills/:id/unissue', (req, res) => { res.json({ ok: true, id: req.params.id }) })

// TEST
router.get('/test-unissue', (req, res) => res.json({ ok: true }))

// 删除工资单（仅 pending 可删）
router.delete('/bills/:id', salaryController.deleteSalaryBill)

// 验证工资单数据完整性
router.get('/bills/:id/verify', salaryController.verifySalaryBill)

export default router
