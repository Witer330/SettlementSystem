import { Router } from 'express'
import { getPkgSpecs, savePkgSpecs } from '../controllers/pkgSpec.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()
router.use(authenticate)

router.get('/', getPkgSpecs)
router.put('/', savePkgSpecs)

export default router
