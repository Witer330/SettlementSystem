import { api } from './request'

export interface WorkflowStep {
  id: number
  title: string
  desc: string
  link: string
  icon: string
}

export interface QuickAction {
  id: number
  title: string
  desc: string
  link: string
  icon: string
}

export interface FlowStepStatus {
  status: string
  count: number
  latest?: string
}

// 流程步骤 link → 后端 flow-status key 的映射
const linkToStatusKey: Record<string, string> = {
  '/dashboard/system/employees': 'employees',
  '/dashboard/basic-info/bom': 'bom',
  '/dashboard/inventory/sales-orders': 'salesOrders',
  '/dashboard/inventory/material-requirements': 'salesOrders',
  '/dashboard/inventory/purchase-orders': 'purchaseOrders',
  '/dashboard/inventory/inventory-query': 'inventory',
  '/dashboard/inventory/materials': 'inventory',
  '/dashboard/salary/daily-records': 'dailyRecords',
  '/dashboard/salary/salary-calculation': 'salary'
}

export const workflowApi = {
  getGuide: async (): Promise<WorkflowStep[]> => {
    try {
      const res = await api.get<{ key: string; value: string }>('/settings/workflow.guide')
      return JSON.parse(res.value)
    } catch {
      return []
    }
  },

  saveGuide: (steps: WorkflowStep[]) =>
    api.put('/settings/workflow.guide', {
      value: JSON.stringify(steps),
      remark: '首页流程引导步骤配置'
    }),

  getQuickActions: async (): Promise<QuickAction[]> => {
    try {
      const res = await api.get<{ key: string; value: string }>('/settings/dashboard.quickActions')
      return JSON.parse(res.value)
    } catch {
      return []
    }
  },

  saveQuickActions: (actions: QuickAction[]) =>
    api.put('/settings/dashboard.quickActions', {
      value: JSON.stringify(actions),
      remark: '首页快速操作入口配置'
    }),

  getFlowStatus: async (): Promise<Record<string, FlowStepStatus>> => {
    try {
      return await api.get<Record<string, FlowStepStatus>>('/dashboard/flow-status')
    } catch {
      return {}
    }
  },

  // 根据 step.link 获取对应的 flow status key
  getStatusKey: (link: string): string | undefined => linkToStatusKey[link]
}
