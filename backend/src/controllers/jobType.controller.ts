import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 获取下一个工种编码
export const getNextCode = async (req: Request, res: Response) => {
  try {
    // 查找最大编码
    const lastJobType = await prisma.jobType.findFirst({
      where: {
        code: {
          startsWith: 'JT'
        }
      },
      orderBy: {
        code: 'desc'
      },
      select: {
        code: true
      }
    });

    let nextCode = 'JT001';
    if (lastJobType) {
      const lastNum = parseInt(lastJobType.code.replace('JT', ''));
      const nextNum = lastNum + 1;
      nextCode = `JT${String(nextNum).padStart(3, '0')}`;
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: nextCode
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取下一个工种编码失败',
      data: null
    });
  }
};

// 获取工种列表
export const getJobTypes = async (req: Request, res: Response) => {
  try {
    const jobTypes = await prisma.jobType.findMany({
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
      data: jobTypes
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取工种列表失败',
      data: null
    });
  }
};

// 获取工种详情
export const getJobType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const jobType = await prisma.jobType.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        employees: true
      }
    });

    if (!jobType) {
      return res.status(404).json({
        code: 404,
        message: '工种不存在',
        data: null
      });
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: jobType
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取工种详情失败',
      data: null
    });
  }
};

// 创建工种
export const createJobType = async (req: Request, res: Response) => {
  try {
    let { name, code } = req.body;

    // 如果 code 为空，自动生成编码
    if (!code) {
      const lastJobType = await prisma.jobType.findFirst({
        where: {
          code: {
            startsWith: 'JT'
          }
        },
        orderBy: {
          code: 'desc'
        },
        select: {
          code: true
        }
      });

      if (lastJobType) {
        const lastNum = parseInt(lastJobType.code.replace('JT', ''));
        const nextNum = lastNum + 1;
        code = `JT${String(nextNum).padStart(3, '0')}`;
      } else {
        code = 'JT001';
      }
    }

    // 检查工种编码是否重复
    const existing = await prisma.jobType.findUnique({
      where: { code }
    });

    if (existing) {
      return res.status(400).json({
        code: 400,
        message: '工种编码已存在',
        data: null
      });
    }

    const jobType = await prisma.jobType.create({
      data: {
        name,
        code,
        status: 'active'
      },
      include: {
        employees: true
      }
    });

    res.json({
      code: 0,
      message: '创建成功',
      data: jobType
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '创建工种失败',
      data: null
    });
  }
};

// 更新工种
export const updateJobType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, status } = req.body;

    const jobType = await prisma.jobType.update({
      where: { id: parseInt(id as string) },
      data: {
        name,
        code,
        status
      },
      include: {
        employees: true
      }
    });

    res.json({
      code: 0,
      message: '更新成功',
      data: jobType
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新工种失败',
      data: null
    });
  }
};

// 删除工种
export const deleteJobType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查工种下是否有员工
    const jobType = await prisma.jobType.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        employees: true
      }
    });

    if (!jobType) {
      return res.status(404).json({
        code: 404,
        message: '工种不存在',
        data: null
      });
    }

    if (jobType.employees && jobType.employees.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '工种下存在员工，无法删除',
        data: null
      });
    }

    await prisma.jobType.delete({
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
      message: error.message || '删除工种失败',
      data: null
    });
  }
};
