import { Response } from 'express'
import { type AuthRequest } from '../middleware/auth.middleware'
import { configService } from '../services/config.service'
import * as backupService from '../services/backup.service'

// 列出备份
export const listBackups = async (_req: AuthRequest, res: Response) => {
  try {
    const backups = backupService.listBackups()
    res.json({ code: 0, message: '获取成功', data: backups })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取备份列表失败', data: null })
  }
}

// 创建备份
export const createBackup = async (_req: AuthRequest, res: Response) => {
  try {
    const backup = backupService.createBackup()
    res.json({ code: 0, message: '备份成功', data: backup })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '创建备份失败', data: null })
  }
}

// 恢复备份
export const restoreBackup = async (req: AuthRequest, res: Response) => {
  try {
    const filename = req.params.filename as string
    if (!filename) {
      return res.status(400).json({ code: 400, message: '文件名不能为空', data: null })
    }
    backupService.restoreBackup(filename)
    res.json({ code: 0, message: '恢复成功，请重启后端服务以生效', data: null })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '恢复备份失败', data: null })
  }
}

// 删除备份
export const deleteBackup = async (req: AuthRequest, res: Response) => {
  try {
    const filename = req.params.filename as string
    if (!filename) {
      return res.status(400).json({ code: 400, message: '文件名不能为空', data: null })
    }
    backupService.deleteBackup(filename)
    res.json({ code: 0, message: '删除成功', data: null })
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '删除备份失败', data: null })
  }
}
