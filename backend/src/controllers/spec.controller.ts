import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 创建产品规格
export const createProductSpec = async (req: Request, res: Response) => {
  try {
    const { productId, name, code, dimensions, material, craft, difficulty, basePrice } = req.body

    const spec = await prisma.productSpec.create({
      data: {
        productId,
        name,
        code,
        dimensions: dimensions || '{}',
        material: material || '{}',
        craft: craft || '{}',
        difficulty: difficulty || 'medium',
        basePrice: basePrice || 0
      },
      include: {
        product: true,
        specPrice: true
      }
    })

    // 自动计算单价
    const unitPrice = await calculateSpecPrice(spec.id)
    if (unitPrice) {
      // 更新或创建规格价目
      await prisma.specPrice.upsert({
        where: { specId: spec.id },
        update: { unitPrice },
        create: { specId: spec.id, unitPrice }
      })
    }

    res.json({
      code: 0,
      message: '创建成功',
      data: { ...spec, unitPrice }
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '创建失败',
      data: null
    })
  }
}

// 获取产品规格列表
export const getProductSpecs = async (req: Request, res: Response) => {
  try {
    const { productId, status } = req.query
    const where: any = {}
    if (productId) where.productId = parseInt(productId as string)
    if (status) {
      where.status = status
    } else {
      // 默认不返回已删除的记录
      where.status = { not: 'deleted' }
    }

    const specs = await prisma.productSpec.findMany({
      where,
      include: {
        product: true,
        specPrice: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({
      code: 0,
      message: '获取成功',
      data: specs
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    })
  }
}

// 获取规格详情
export const getProductSpec = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const spec = await prisma.productSpec.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        product: true,
        specPrice: true
      }
    })

    if (!spec) {
      return res.status(404).json({
        code: 404,
        message: '规格不存在',
        data: null
      })
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: spec
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '获取失败',
      data: null
    })
  }
}

// 更新产品规格
export const updateProductSpec = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, dimensions, material, craft, difficulty, basePrice } = req.body

    const spec = await prisma.productSpec.update({
      where: { id: parseInt(id as string) },
      data: {
        name,
        dimensions,
        material,
        craft,
        difficulty,
        basePrice
      },
      include: {
        product: true,
        specPrice: true
      }
    })

    // 重新计算单价
    const unitPrice = await calculateSpecPrice(spec.id)
    if (unitPrice) {
      await prisma.specPrice.upsert({
        where: { specId: spec.id },
        update: { unitPrice },
        create: { specId: spec.id, unitPrice }
      })
    }

    res.json({
      code: 0,
      message: '更新成功',
      data: { ...spec, unitPrice }
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '更新失败',
      data: null
    })
  }
}

// 删除产品规格（软删除）
export const deleteProductSpec = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // 检查规格是否存在
    const spec = await prisma.productSpec.findUnique({
      where: { id: parseInt(id as string) }
    })

    if (!spec) {
      return res.status(404).json({
        code: 404,
        message: '规格不存在',
        data: null
      })
    }

    // 软删除：将状态改为 deleted
    await prisma.productSpec.update({
      where: { id: parseInt(id as string) },
      data: { status: 'deleted' }
    })

    res.json({
      code: 0,
      message: '删除成功',
      data: null
    })
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '删除失败',
      data: null
    })
  }
}

// 计算规格单价（核心定价逻辑）
const calculateSpecPrice = async (specId: number): Promise<number | null> => {
  const spec = await prisma.productSpec.findUnique({
    where: { id: specId },
    include: { product: true }
  })

  if (!spec) return null

  const basePrice = spec.basePrice

  // 解析规格参数
  const dimensions =
    typeof spec.dimensions === 'string' ? JSON.parse(spec.dimensions) : spec.dimensions
  const material = typeof spec.material === 'string' ? JSON.parse(spec.material) : spec.material
  const craft = typeof spec.craft === 'string' ? JSON.parse(spec.craft) : spec.craft

  // 获取所有系数
  const coefficients = await prisma.specCoefficient.findMany({
    where: { status: 'active' },
    orderBy: { priority: 'desc' } // 优先级高的先匹配
  })

  // 计算总系数
  let totalCoefficient = 0

  for (const coeff of coefficients) {
    const matched = matchCoefficient(coeff, {
      dimensions,
      material,
      craft,
      difficulty: spec.difficulty
    })
    if (matched) {
      totalCoefficient += coeff.value
    }
  }

  // 计算最终单价
  const unitPrice = basePrice * (1 + totalCoefficient)

  return Math.round(unitPrice * 100) / 100 // 保留两位小数
}

// 匹配系数规则
const matchCoefficient = (coeff: any, params: any): boolean => {
  const { code, type } = coeff

  switch (type) {
    case 'dimension':
      // 尺寸系数匹配
      if (code.startsWith('diameter_gt_')) {
        const threshold = parseInt(code.replace('diameter_gt_', ''))
        return params.dimensions?.diameter > threshold
      } else if (code.startsWith('diameter_lt_')) {
        const threshold = parseInt(code.replace('diameter_lt_', ''))
        return params.dimensions?.diameter < threshold
      } else if (code.includes('diameter_') && code.includes('_')) {
        // 范围匹配，如 diameter_100_150
        const parts = code.replace('diameter_', '').split('_')
        if (parts.length === 2) {
          const [min, max] = parts.map(Number)
          return params.dimensions?.diameter >= min && params.dimensions?.diameter <= max
        }
      }
      return false

    case 'material':
      // 材质系数匹配
      return code === params.material?.type

    case 'craft':
      // 工艺系数匹配
      if (code.startsWith('surface_')) {
        const surface = code.replace('surface_', '')
        return params.craft?.surface === surface
      }
      return false

    case 'difficulty':
      // 复杂度系数匹配
      return code === `difficulty_${params.difficulty}`

    default:
      return false
  }
}

// 手动重新计算单价
export const recalculateSpecPrice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const unitPrice = await calculateSpecPrice(parseInt(id as string))

    if (unitPrice) {
      await prisma.specPrice.upsert({
        where: { specId: parseInt(id as string) },
        update: { unitPrice },
        create: { specId: parseInt(id as string), unitPrice }
      })

      res.json({
        code: 0,
        message: '重新计算成功',
        data: { unitPrice }
      })
    } else {
      res.status(404).json({
        code: 404,
        message: '规格不存在',
        data: null
      })
    }
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: error.message || '重新计算失败',
      data: null
    })
  }
}
