import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 获取产品列表
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10, keyword, status } = req.query;
    const where: any = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword as string } },
        { code: { contains: keyword as string } }
      ];
    }
    if (status) where.status = status;

    const [list, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((page as number) - 1) * (pageSize as number),
        take: parseInt(pageSize as string)
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list,
        total,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        totalPages: Math.ceil(total / parseInt(pageSize as string))
      }
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    });
  }
};

// 获取产品详情
export const getProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id as string) }
    });

    if (!product) {
      return res.status(404).json({
        code: 404,
        message: '产品不存在',
        data: null
      });
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: product
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    });
  }
};

// 创建产品
export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, code, category, specification, unit } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        code,
        category,
        specification,
        unit,
        status: 'active'
      }
    });

    res.json({
      code: 0,
      message: '创建成功',
      data: product
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '创建失败',
      data: null
    });
  }
};

// 更新产品
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, category, specification, unit, status } = req.body;

    const product = await prisma.product.update({
      where: { id: parseInt(id as string) },
      data: {
        name,
        code,
        category,
        specification,
        unit,
        status
      }
    });

    res.json({
      code: 0,
      message: '更新成功',
      data: product
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新失败',
      data: null
    });
  }
};

// 删除产品
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({
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
