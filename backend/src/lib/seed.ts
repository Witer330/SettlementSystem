/**
 * 数据库初始化（首次启动自动执行）
 *
 * 幂等：所有写入均带唯一键判重，重复调用安全。
 * 默认账号: admin / admin123（首次创建后请尽快修改）
 */

import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

const DEFAULT_SETTINGS = [
  { key: 'ui.theme', value: 'stripe', type: 'string', category: 'ui', remark: 'UI 主题' },
  { key: 'system.name', value: '结算系统', type: 'string', category: 'system', remark: '系统名称' },
  { key: 'system.companyName', value: '', type: 'string', category: 'system', remark: '公司名称' },
  { key: 'system.backupInterval', value: '7', type: 'number', category: 'system', remark: '数据备份间隔（天）' },
  { key: 'system.backupRetainDays', value: '30', type: 'number', category: 'system', remark: '备份保留天数' },
  { key: 'workflow.guide', value: '[]', type: 'json', category: 'workflow', remark: '首页流程引导配置' },
  { key: 'dashboard.quickActions', value: '[]', type: 'json', category: 'dashboard', remark: '首页快速操作入口' },
  { key: 'system.endpointRegistry', value: '[]', type: 'json', category: 'system', remark: '页面接口别名注册表' },
]

export async function runSeed(): Promise<void> {
  // 1. 管理员账户（首次启动）
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: '系统管理员',
        role: 'admin',
        status: 'active',
      },
    })
    console.log('[seed] 已创建默认管理员: admin / admin123（请尽快修改密码）')
  }

  // 2. 默认系统设置（幂等 upsert）
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }
}
