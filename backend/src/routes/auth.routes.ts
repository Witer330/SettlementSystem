import { Router } from 'express'
import { authController } from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

// 公开路由（无需认证）
router.post('/login', authController.login)

// 认证路由
router.post('/logout', authenticate, authController.logout)
router.get('/profile', authenticate, authController.getProfile)
router.post('/change-password', authenticate, authController.changePassword)

// 初始化管理员（开发//首次部署时使用）
router.post('/init-admin', authController.initAdmin)

// 用户管理路由
router.get('/users', authenticate, authController.getUsers)
router.post('/users', authenticate, authController.createUser)
router.put('/users/:id', authenticate, authController.updateUser)
router.delete('/users/:id', authenticate, authController.deleteUser)

export default router
