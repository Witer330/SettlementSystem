import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

export const getPkgSpecs = async (req: Request, res: Response) => {
  try {
    const { ownerType, ownerId } = req.query
    const where: any = {}
    if (ownerType) where.ownerType = String(ownerType)
    if (ownerId) where.ownerId = Number(ownerId)
    const list = await prisma.pkgSpec.findMany({ where, orderBy: { isDefault: 'desc' } })
    res.json({ code: 0, message: '获取成功', data: list })
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }) }
}

export const savePkgSpecs = async (req: Request, res: Response) => {
  try {
    const { ownerType, ownerId, specs } = req.body // specs: [{ id?, name, unitName, ratio, isDefault }]
    // 删掉该物料/产品的所有旧规格，重新建
    await prisma.pkgSpec.deleteMany({ where: { ownerType, ownerId: Number(ownerId) } })
    if (specs && specs.length > 0) {
      await prisma.pkgSpec.createMany({
        data: specs.map((s: any) => ({
          ownerType, ownerId: Number(ownerId),
          name: s.name, unitName: s.unitName, ratio: s.ratio,
          isDefault: s.isDefault || false
        }))
      })
    }
    const list = await prisma.pkgSpec.findMany({ where: { ownerType, ownerId: Number(ownerId) }, orderBy: { isDefault: 'desc' } })
    res.json({ code: 0, message: '保存成功', data: list })
  } catch (e: any) { res.status(500).json({ code: 500, message: e.message }) }
}
