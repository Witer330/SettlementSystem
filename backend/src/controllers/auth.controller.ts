import { Request, Response } from 'express'
import { type AuthRequest } from '../middleware/auth.middleware'
import { authService } from '../services/auth.service'

export const authController = {
  // 用户登录
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body

      if (!username || !password) {
        return res.status(400).json({
          code: 400,
          message: '用户名和密码不能为空',
          data: null
        })
      }

      const user = await authService.findUserByUsername(username)

      if (!user) {
        return res.status(401).json({
          code: 401,
          message: '用户名或密码错误',
          data: null
        })
      }

      const isPasswordValid = await authService.comparePassword(password, user.password)

      if (!isPasswordValid) {
        return res.status(401).json({
          code: 401,
          message: '用户名或密码错误',
          data: null
        })
      }

      if (user.status !== 'active') {
        return res.status(403).json({
          code: 403,
          message: '账号已被禁用',
          data: null
        })
      }

      const token = authService.generateToken({
        userId: user.id,
        username: user.username,
        role: user.role
      })

      res.json({
        code: 0,
        message: '登录成功',
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
          }
        }
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '登录失败',
        data: null
      })
    }
  },

  // 用户登出
  async logout(_req: AuthRequest, res: Response) {
    res.json({
      code: 0,
      message: '登出成功',
      data: null
    })
  },

  // 获取当前用户信息
  async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          code: 401,
          message: '未认证',
          data: null
        })
      }

      const user = await authService.findUserById(req.userId)

      if (!user) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null
        })
      }

      res.json({
        code: 0,
        message: '操作成功',
        data: user
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '获取用户信息失败',
        data: null
      })
    }
  },

  // 修改密码
  async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          code: 401,
          message: '未认证',
          data: null
        })
      }

      const { oldPassword, newPassword } = req.body

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          code: 400,
          message: '旧密码和新密码不能为空',
          data: null
        })
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          code: 400,
          message: '新密码长度至少6位',
          data: null
        })
      }

      const user = await authService.findUserByIdFull(req.userId)

      if (!user) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null
        })
      }

      const isPasswordValid = await authService.comparePassword(oldPassword, user.password)

      if (!isPasswordValid) {
        return res.status(400).json({
          code: 400,
          message: '旧密码错误',
          data: null
        })
      }

      const hashedPassword = await authService.hashPassword(newPassword)

      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      await prisma.user.update({
        where: { id: req.userId },
        data: { password: hashedPassword }
      })

      res.json({
        code: 0,
        message: '密码修改成功',
        data: null
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '修改密码失败',
        data: null
      })
    }
  },

  // 初始化默认管理员用户
  async initAdmin(req: Request, res: Response) {
    try {
      const { username, password, name } = req.body

      const existingAdmin = await authService.findExistingAdmin()

      if (existingAdmin) {
        return res.status(400).json({
          code: 400,
          message: '管理员账户已存在',
          data: null
        })
      }

      const admin = await authService.createUser({
        username: username || 'admin',
        password: password || 'admin123',
        name: name || '系统管理员',
        role: 'admin'
      })

      res.json({
        code: 0,
        message: '管理员账户创建成功',
        data: admin
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '创建管理员失败',
        data: null
      })
    }
  },

  // 获取用户列表
  async getUsers(req: Request, res: Response) {
    try {
      const { page = 1, pageSize = 10, keyword, role, status } = req.query

      const result = await authService.getUsers({
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        keyword: keyword as string,
        role: role as string,
        status: status as string
      })

      res.json({
        code: 0,
        message: '获取成功',
        data: result
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '获取用户列表失败',
        data: null
      })
    }
  },

  // 创建用户
  async createUser(req: Request, res: Response) {
    try {
      const { username, password, name, role, status = 'active' } = req.body

      if (!username || !password || !name || !role) {
        return res.status(400).json({
          code: 400,
          message: '缺少必填字段',
          data: null
        })
      }

      const existing = await authService.findExistingUsername(username)

      if (existing) {
        return res.status(400).json({
          code: 400,
          message: '用户名已存在',
          data: null
        })
      }

      const user = await authService.createUser({ username, password, name, role, status })

      res.json({
        code: 0,
        message: '创建成功',
        data: user
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '创建用户失败',
        data: null
      })
    }
  },

  // 更新用户
  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { username, password, name, role, status } = req.body

      const existing = await authService.findExistingUsername(username, parseInt(id as string))

      if (existing) {
        return res.status(400).json({
          code: 400,
          message: '用户名已被使用',
          data: null
        })
      }

      const user = await authService.updateUser(parseInt(id as string), {
        username,
        password,
        name,
        role,
        status
      })

      res.json({
        code: 0,
        message: '更新成功',
        data: user
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '更新用户失败',
        data: null
      })
    }
  },

  // 删除用户
  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      if (req.userId === parseInt(id as string)) {
        return res.status(400).json({
          code: 400,
          message: '不能删除当前登录的用户',
          data: null
        })
      }

      await authService.deleteUser(parseInt(id as string))

      res.json({
        code: 0,
        message: '删除成功',
        data: null
      })
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '删除用户失败',
        data: null
      })
    }
  }
}
