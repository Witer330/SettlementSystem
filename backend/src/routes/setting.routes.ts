import { Router } from 'express'
import {
  getSettings,
  getSetting,
  updateSetting,
  batchUpdateSettings,
  getSystemInfo,
  getAuditLogs
} from '../controllers/setting.controller'
import { authenticate, requireRole } from '../middleware/auth.middleware'

const router = Router()

// GET 路由：任何已登录用户可访问
router.get('/', authenticate, getSettings)
router.get('/system-info', authenticate, getSystemInfo)
router.get('/audit-logs', authenticate, requireRole('admin'), getAuditLogs)
router.get('/:key', authenticate, getSetting)

// PUT/POST 路由：仅管理员可操作
router.put('/:key', authenticate, requireRole('admin'), updateSetting)
router.post('/batch', authenticate, requireRole('admin'), batchUpdateSettings)

export default router
