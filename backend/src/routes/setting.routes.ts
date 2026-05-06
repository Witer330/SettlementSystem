import { Router } from 'express'
import * as settingController from '../controllers/setting.controller'

const router = Router()

// Settings management
router.get('/', settingController.getSettings)
router.get('/:key', settingController.getSetting)
router.put('/:key', settingController.updateSetting)
router.post('/batch', settingController.batchUpdateSettings)

export default router
