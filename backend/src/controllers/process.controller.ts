import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

// ── Process (工序) ──

export const getProcesses = async (req: Request, res: Response) => {
  try {
    const { status } = req.query
    const where: any = {}
    if (status) where.status = String(status)
    const list = await prisma.process.findMany({ where, orderBy: { code: 'asc' } })
    res.json({ code: 0, message: '获取成功', data: list })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

export const getProcess = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const record = await prisma.process.findUnique({
      where: { id },
      include: { productProcesses: { include: { product: true } }, processRates: { include: { employee: true } } }
    })
    if (!record) { res.status(404).json({ code: 404, message: '工序不存在' }); return }
    res.json({ code: 0, message: '获取成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

export const createProcess = async (req: Request, res: Response) => {
  try {
    const { name, code, defaultPrice, unit } = req.body
    const record = await prisma.process.create({
      data: { name, code, defaultPrice: defaultPrice || 0, unit: unit || 'piece' }
    })
    res.json({ code: 0, message: '创建成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建失败' })
  }
}

export const updateProcess = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { name, code, defaultPrice, unit, status } = req.body
    const record = await prisma.process.update({
      where: { id },
      data: { name, code, defaultPrice, unit, status }
    })
    res.json({ code: 0, message: '更新成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新失败' })
  }
}

export const deleteProcess = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    await prisma.process.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}

// ── ProductProcess (产品工序关联) ──

export const getProductProcesses = async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.productId)
    const list = await prisma.productProcess.findMany({
      where: { productId },
      include: { process: true },
      orderBy: { sequence: 'asc' }
    })
    res.json({ code: 0, message: '获取成功', data: list })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

export const saveProductProcesses = async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.productId)
    const { items } = req.body // [{ processId, sequence }]
    await prisma.productProcess.deleteMany({ where: { productId } })
    if (items && items.length > 0) {
      await prisma.productProcess.createMany({
        data: items.map((i: any, idx: number) => ({
          productId, processId: i.processId, sequence: i.sequence ?? idx + 1
        }))
      })
    }
    const list = await prisma.productProcess.findMany({
      where: { productId }, include: { process: true }, orderBy: { sequence: 'asc' }
    })
    res.json({ code: 0, message: '保存成功', data: list })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '保存失败' })
  }
}

// ── ProcessRate (员工工序单价) ──

export const getProcessRates = async (req: Request, res: Response) => {
  try {
    const { employeeId, processId } = req.query
    const where: any = {}
    if (employeeId) where.employeeId = Number(employeeId)
    if (processId) where.processId = Number(processId)
    const list = await prisma.processRate.findMany({
      where, include: { employee: true, process: true }
    })
    res.json({ code: 0, message: '获取成功', data: list })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取失败' })
  }
}

export const saveProcessRate = async (req: Request, res: Response) => {
  try {
    const { employeeId, productId, processId, price } = req.body
    // upsert: unique per (employeeId, productId, processId) combination
    const existing = await prisma.processRate.findFirst({
      where: { employeeId, productId: productId || null, processId }
    })
    let record
    if (existing) {
      record = await prisma.processRate.update({ where: { id: existing.id }, data: { price } })
    } else {
      record = await prisma.processRate.create({ data: { employeeId, productId: productId || null, processId, price } })
    }
    res.json({ code: 0, message: '保存成功', data: record })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '保存失败' })
  }
}

export const deleteProcessRate = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    await prisma.processRate.delete({ where: { id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除失败' })
  }
}
