import { api } from './request'

export interface TrendItem {
  month?: string
  period?: string
  total: number
  hourly?: number
  piece?: number
  inflow?: number
  outflow?: number
}

export interface BreakdownItem {
  name: string
  value: number
}

export interface ProductRankingItem {
  name: string
  quantity: number
  amount: number
}

export interface ReportSummary {
  totalAmount?: number
  totalOrders?: number
  totalMaterials?: number
  normalCount?: number
  lowStockCount?: number
  emptyStockCount?: number
  totalHourly?: number
  totalPiece?: number
  billCount?: number
}

export interface PurchaseReport {
  trend: TrendItem[]
  breakdown: BreakdownItem[]
  statusDistribution: BreakdownItem[]
  summary: ReportSummary
}

export interface SalesReport {
  trend: TrendItem[]
  breakdown: BreakdownItem[]
  productRanking: ProductRankingItem[]
  summary: ReportSummary
}

export interface InventoryReport {
  categoryOverview: Array<{ name: string; totalQuantity: number; itemCount: number }>
  movementTrend: TrendItem[]
  statusDistribution: BreakdownItem[]
  summary: ReportSummary
}

export interface SalaryReport {
  trend: TrendItem[]
  breakdown: BreakdownItem[]
  summary: ReportSummary
}

export const reportApi = {
  getPurchase(params?: { startDate?: string; endDate?: string }): Promise<PurchaseReport> {
    return api.get<PurchaseReport>('/reports/purchase', { params })
  },

  getSales(params?: { startDate?: string; endDate?: string }): Promise<SalesReport> {
    return api.get<SalesReport>('/reports/sales', { params })
  },

  getInventory(): Promise<InventoryReport> {
    return api.get<InventoryReport>('/reports/inventory')
  },

  getSalary(params?: { startDate?: string; endDate?: string }): Promise<SalaryReport> {
    return api.get<SalaryReport>('/reports/salary', { params })
  }
}
