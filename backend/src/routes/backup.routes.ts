import { Router } from 'express'
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup
} from '../controllers/backup.controller'
import { authenticate, requireRole } from '../middleware/auth.middleware'

const router = Router()

// 所有备份操作仅管理员可访问
router.get('/', authenticate, requireRole('admin'), listBackups)
router.post('/', authenticate, requireRole('admin'), createBackup)
router.post('/:filename/restore', authenticate, requireRole('admin'), restoreBackup)
router.delete('/:filename', authenticate, requireRole('admin'), deleteBackup)

export default router
