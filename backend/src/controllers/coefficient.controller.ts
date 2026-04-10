import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 创建规格系数
export const createCoefficient = async (req: Request, res: Response) => {
  try {
    const { type, code, name, value, priority } = req.body;

    const coefficient = await prisma.specCoefficient.create({
      data: {
        type,
        code,
        name,
        value,
        priority: priority || 0
      }
    });

    res.json({
      code: 0,
      message: '创建成功',
      data: coefficient
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '创建失败',
      data: null
    });
  }
};

// 获取规格系数列表
export const getCoefficients = async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query;
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const coefficients = await prisma.specCoefficient.findMany({
      where,
      orderBy: [{ type: 'asc' }, { priority: 'desc' }]
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: coefficients
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    });
  }
};

// 更新规格系数
export const updateCoefficient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, value, priority, status } = req.body;

    const coefficient = await prisma.specCoefficient.update({
      where: { id: parseInt(id as string) },
      data: {
        name,
        value,
        priority,
        status
      }
    });

    res.json({
      code: 0,
      message: '更新成功',
      data: coefficient
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新失败',
      data: null
    });
  }
};

// 删除规格系数
export const deleteCoefficient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.specCoefficient.delete({
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
      message: error.message || '删除失败',
      data: null
    });
  }
};

// 批量初始化默认系数
export const initDefaultCoefficients = async (req: Request, res: Response) => {
  try {
    // 检查是否已初始化
    const existing = await prisma.specCoefficient.count();
    if (existing > 0) {
      return res.json({
        code: 400,
        message: '系数已存在，无需初始化',
        data: null
      });
    }

    // 尺寸系数
    const dimensionCoefficients = [
      { type: 'dimension', code: 'diameter_gt_150', name: '直径>150mm', value: 0.20, priority: 10 },
      { type: 'dimension', code: 'diameter_100_150', name: '直径100-150mm', value: 0.10, priority: 5 },
      { type: 'dimension', code: 'diameter_lt_100', name: '直径<100mm', value: 0.00, priority: 1 }
    ];

    // 材质系数
    const materialCoefficients = [
      { type: 'material', code: 'stainless', name: '不锈钢', value: 0.15, priority: 10 },
      { type: 'material', code: 'steel', name: '普通钢', value: 0.00, priority: 5 },
      { type: 'material', code: 'aluminum', name: '铝合金', value: 0.08, priority: 8 }
    ];

    // 工艺系数
    const craftCoefficients = [
      { type: 'craft', code: 'surface_galvanized', name: '镀锌处理', value: 0.10, priority: 5 },
      { type: 'craft', code: 'surface_polished', name: '抛光处理', value: 0.15, priority: 10 },
      { type: 'craft', code: 'surface_none', name: '无处理', value: 0.00, priority: 1 }
    ];

    // 复杂度系数
    const difficultyCoefficients = [
      { type: 'difficulty', code: 'difficulty_hard', name: '困难', value: 0.25, priority: 10 },
      { type: 'difficulty', code: 'difficulty_medium', name: '中等', value: 0.10, priority: 5 },
      { type: 'difficulty', code: 'difficulty_easy', name: '简单', value: 0.00, priority: 1 }
    ];

    const allCoefficients = [
      ...dimensionCoefficients,
      ...materialCoefficients,
      ...craftCoefficients,
      ...difficultyCoefficients
    ];

    await prisma.specCoefficient.createMany({
      data: allCoefficients
    });

    res.json({
      code: 0,
      message: '初始化成功',
      data: { count: allCoefficients.length }
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '初始化失败',
      data: null
    });
  }
};
