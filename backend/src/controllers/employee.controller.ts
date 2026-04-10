import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export const employeeController = {
  // 获取员工列表
  async getList(req: Request, res: Response) {
    try {
      const { page = 1, pageSize = 10, keyword, status, departmentId } = req.query;

      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const where: any = {};

      if (keyword) {
        where.OR = [
          { name: { contains: String(keyword) } },
          { code: { contains: String(keyword) } }
        ];
      }

      if (status) {
        where.status = status;
      }

      if (departmentId) {
        where.departmentId = Number(departmentId);
      }

      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take,
          include: {
            department: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }),
        prisma.employee.count({ where })
      ]);

      res.json({
        code: 0,
        message: 'success',
        data: {
          list: employees,
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(total / Number(pageSize))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '获取员工列表失败',
        data: null
      });
    }
  },

  // 获取员工详情
  async getDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const employee = await prisma.employee.findUnique({
        where: { id: Number(id) },
        include: {
          department: true,
          processRates: {
            include: {
              process: true
            }
          }
        }
      });

      if (!employee) {
        return res.status(404).json({
          code: 404,
          message: '员工不存在',
          data: null
        });
      }

      res.json({
        code: 0,
        message: 'success',
        data: employee
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '获取员工详情失败',
        data: null
      });
    }
  },

  // 创建员工
  async create(req: AuthRequest, res: Response) {
    try {
      const { name, code, departmentId, jobType, payType, hourlyRate, status = 'active' } = req.body;

      if (!name || !code || !jobType) {
        return res.status(400).json({
          code: 400,
          message: '缺少必填字段',
          data: null
        });
      }

      // 检查工号是否重复
      const existing = await prisma.employee.findUnique({
        where: { code }
      });

      if (existing) {
        return res.status(400).json({
          code: 400,
          message: '工号已存在',
          data: null
        });
      }

      const employee = await prisma.employee.create({
        data: {
          name,
          code,
          departmentId: departmentId ? Number(departmentId) : null,
          jobType,
          payType: payType || 'hourly',
          hourlyRate: hourlyRate || 0,
          status
        },
        include: {
          department: true
        }
      });

      res.json({
        code: 0,
        message: '创建成功',
        data: employee
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '创建员工失败',
        data: null
      });
    }
  },

  // 更新员工
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, code, departmentId, jobType, payType, hourlyRate, status } = req.body;

      const employee = await prisma.employee.update({
        where: { id: Number(id) },
        data: {
          ...(name !== undefined && { name }),
          ...(code !== undefined && { code }),
          ...(departmentId !== undefined && { departmentId: departmentId ? Number(departmentId) : null }),
          ...(jobType !== undefined && { jobType }),
          ...(payType !== undefined && { payType }),
          ...(hourlyRate !== undefined && { hourlyRate }),
          ...(status !== undefined && { status })
        },
        include: {
          department: true
        }
      });

      res.json({
        code: 0,
        message: '更新成功',
        data: employee
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '更新员工失败',
        data: null
      });
    }
  },

  // 删除员工
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await prisma.employee.delete({
        where: { id: Number(id) }
      });

      res.json({
        code: 0,
        message: '删除成功',
        data: null
      });
    } catch (error: any) {
      res.status(500).json({
        code: 500,
        message: error.message || '删除员工失败',
        data: null
      });
    }
  }
};
