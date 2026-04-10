import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 获取部门列表
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        employees: {
          where: { status: 'active' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: departments
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取部门列表失败',
      data: null
    });
  }
};

// 获取部门详情
export const getDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        employees: true
      }
    });

    if (!department) {
      return res.status(404).json({
        code: 404,
        message: '部门不存在',
        data: null
      });
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: department
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取部门详情失败',
      data: null
    });
  }
};

// 创建部门
export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name, code, parentId } = req.body;

    // 检查部门编码是否重复
    const existing = await prisma.department.findUnique({
      where: { code }
    });

    if (existing) {
      return res.status(400).json({
        code: 400,
        message: '部门编码已存在',
        data: null
      });
    }

    const department = await prisma.department.create({
      data: {
        name,
        code,
        parentId: parentId ? parseInt(parentId) : null,
        status: 'active'
      },
      include: {
        employees: true
      }
    });

    res.json({
      code: 0,
      message: '创建成功',
      data: department
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '创建部门失败',
      data: null
    });
  }
};

// 更新部门
export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, parentId, status } = req.body;

    const department = await prisma.department.update({
      where: { id: parseInt(id as string) },
      data: {
        name,
        code,
        parentId: parentId ? parseInt(parentId) : null,
        status
      },
      include: {
        employees: true
      }
    });

    res.json({
      code: 0,
      message: '更新成功',
      data: department
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新部门失败',
      data: null
    });
  }
};

// 删除部门
export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查部门下是否有员工
    const department = await prisma.department.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        employees: true
      }
    });

    if (!department) {
      return res.status(404).json({
        code: 404,
        message: '部门不存在',
        data: null
      });
    }

    if (department.employees && department.employees.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '部门下存在员工，无法删除',
        data: null
      });
    }

    await prisma.department.delete({
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
      message: error.message || '删除部门失败',
      data: null
    });
  }
};
