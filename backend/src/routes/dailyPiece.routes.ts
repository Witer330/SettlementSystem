import { Router } from 'express'
import * as dailyPieceController from '../controllers/dailyPiece.controller'

const router = Router()

// 每日计件记录管理
router.post('/', dailyPieceController.createDailyRecord)
router.get('/', dailyPieceController.getDailyRecords)
router.get('/:id', dailyPieceController.getDailyRecord)
router.put('/:id', dailyPieceController.updateDailyRecord)
router.delete('/:id', dailyPieceController.deleteDailyRecord)

// 月度汇总
router.get('/summary/:employeeId/:period', dailyPieceController.getMonthlySummary)

export default router
