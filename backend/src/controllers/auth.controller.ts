import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { type AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const authController = {
  // 用户登录
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          code: 400,
          message: '用户名和密码不能为空',
          data: null
        });
      }

      // 查找用户
      const user = await prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        return res.status(401).json({
          code: 401,
          message: '用户名或密码错误',
          data: null
        });
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          code: 401,
          message: '用户名或密码错误',
          data: null
        });
      }

      // 检查用户状态
      if (user.status !== 'active') {
        return res.status(403).json({
          code: 403,
          message: '账号已被禁用',
          data: null
        });
      }

      // 生成 JWT Token
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as any
      );

      // 200
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
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '登录失败',
        data: null
      });
    }
  },

  // 用户登出
  async logout(_req: AuthRequest, res: Response) {
    // 实际项目中可能需要将 token 加入黑名单
    res.json({
      code: 0,
      message: '登出成功',
      data: null
    });
  },

  // 获取当前用户信息
  async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          code: 401,
          message: '未认证',
          data: null
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          status: true,
          createdAt: true
        }
      });

      if (!user) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null
        });
      }

      res.json({
        code: 0,
        message: 'success',
        data: user
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '获取用户信息失败',
        data: null
      });
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
        });
      }

      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          code: 400,
          message: '旧密码和新密码不能为空',
          data: null
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          code: 400,
          message: '新密码长度至少6位',
          data: null
        });
      }

      // 获取用户
      const user = await prisma.user.findUnique({
        where: { id: req.userId }
      });

      if (!user) {
        return res.status(404).json({
          code: 404,
          message: '用户不存在',
          data: null
        });
      }

      // 验证旧密码
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

      if (!isPasswordValid) {
        return res.status(400).json({
          code: 400,
          message: '旧密码错误',
          data: null
        });
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 更新密码
      await prisma.user.update({
        where: { id: req.userId },
        data: { password: hashedPassword }
      });

      res.json({
        code: 0,
        message: '密码修改成功',
        data: null
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '修改密码失败',
        data: null
      });
    }
  },

  // 初始化默认管理员用户
  async initAdmin(req: Request, res: Response) {
    try {
      const { username, password, name } = req.body;

      // 检查是否已存在管理员
      const existingAdmin = await prisma.user.findFirst({
        where: { role: 'admin' }
      });

      if (existingAdmin) {
        return res.status(400).json({
          code: 400,
          message: '管理员账户已存在',
          data: null
        });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password || 'admin123', 10);

      // 创建管理员
      const admin = await prisma.user.create({
        data: {
          username: username || 'admin',
          password: hashedPassword,
          name: name || '系统管理员',
          role: 'admin',
          status: 'active'
        },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          status: true
        }
      });

      res.json({
        code: 0,
        message: '管理员账户创建成功',
        data: admin
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '创建管理员失败',
        data: null
      });
    }
  },

  // 获取用户列表
  async getUsers(req: Request, res: Response) {
    try {
      const { page = 1, pageSize = 10, keyword, role, status } = req.query;

      const where: any = {};
      if (keyword) {
        where.OR = [
          { name: { contains: keyword as string } },
          { username: { contains: keyword as string } }
        ];
      }
      if (role) where.role = role;
      if (status) where.status = status;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip: ((page as number) - 1) * (pageSize as number),
          take: parseInt(pageSize as string)
        }),
        prisma.user.count({ where })
      ]);

      res.json({
        code: 0,
        message: '获取成功',
        data: {
          list: users,
          total,
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string),
          totalPages: Math.ceil(total / parseInt(pageSize as string))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '获取用户列表失败',
        data: null
      });
    }
  },

  // 创建用户
  async createUser(req: Request, res: Response) {
    try {
      const { username, password, name, role, status = 'active' } = req.body;

      if (!username || !password || !name || !role) {
        return res.status(400).json({
          code: 400,
          message: '缺少必填字段',
          data: null
        });
      }

      // 检查用户名是否已存在
      const existing = await prisma.user.findUnique({
        where: { username }
      });

      if (existing) {
        return res.status(400).json({
          code: 400,
          message: '用户名已存在',
          data: null
        });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          name,
          role,
          status
        },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json({
        code: 0,
        message: '创建成功',
        data: user
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '创建用户失败',
        data: null
      });
    }
  },

  // 更新用户
  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { username, password, name, role, status } = req.body;

      // 检查用户名是否已被其他用户使用
      const existing = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: parseInt(id as string) }
        }
      });

      if (existing) {
        return res.status(400).json({
          code: 400,
          message: '用户名已被使用',
          data: null
        });
      }

      const data: any = {
        name,
        role,
        status
      };

      if (username) data.username = username;

      if (password) {
        data.password = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id: parseInt(id as string) },
        data,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json({
        code: 0,
        message: '更新成功',
        data: user
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '更新用户失败',
        data: null
      });
    }
  },

  // 删除用户
  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // 不允许删除自己
      if (req.userId === parseInt(id as string)) {
        return res.status(400).json({
          code: 400,
          message: '不能删除当前登录的用户',
          data: null
        });
      }

      await prisma.user.delete({
        where: { id: parseInt(id as string) }
      });

      res.json({
        code: 0,
        message: '删除成功',
        data: null
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '删除用户失败',
        data: null
      });
    }
  }
};
