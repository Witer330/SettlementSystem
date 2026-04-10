import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 获取系统设置
export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: { key: 'asc' }
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: settings
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取设置失败',
      data: null
    });
  }
};

// 获取单个设置
export const getSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const setting = await prisma.setting.findUnique({
      where: { key }
    });

    if (!setting) {
      return res.status(404).json({
        code: 404,
        message: '设置不存在',
        data: null
      });
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: setting
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取设置失败',
      data: null
    });
  }
};

// 更新设置
export const updateSetting = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, remark } = req.body;

    const if (!value) {
      return res.status(400).json({
        code: 400,
        message: '设置值不能为空',
        data: null
      });
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value, remark },
      create: { key, value, remark }
    });

    res.json({
      code: 0,
      message: '更新成功',
      data: setting
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新设置失败',
      data: null
    });
  }
};

// 批量更新设置
export const batchUpdateSettings = async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({
        code: 400,
        message: '设置格式错误',
        data: null
      });
    }

    const results = [];
    for (const setting of settings) {
      const result = await prisma.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value, remark: setting.remark },
        create: { key: setting.key, value: setting.value, remark: setting.remark }
      });
      results.push(result);
    }

    res.json({
      code: 0,
      message: '批量更新成功',
      data: results
    });
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '批量更新失败',
      data: null
    });
  }
};
