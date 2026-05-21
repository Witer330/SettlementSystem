import { prisma } from '../lib/prisma'

export interface Blocker {
  type: string
  count: number
}

// ============ Product ============
export async function checkProductReferences(id: number): Promise<Blocker[]> {
  const [bom, daily, prod, ret, sales] = await Promise.all([
    prisma.billOfMaterial.count({ where: { productId: id } }),
    prisma.dailyPieceRecordItem.count({ where: { productId: id } }),
    prisma.productionOrder.count({ where: { productId: id } }),
    prisma.returnOrderItem.count({ where: { productId: id } }),
    prisma.salesItem.count({ where: { productId: id } })
  ])
  const blockers: Blocker[] = []
  if (bom > 0) blockers.push({ type: 'BOM 物料清单', count: bom })
  if (prod > 0) blockers.push({ type: '生产单', count: prod })
  if (sales > 0) blockers.push({ type: '销货单明细', count: sales })
  if (daily > 0) blockers.push({ type: '计件记录', count: daily })
  if (ret > 0) blockers.push({ type: '退货单', count: ret })
  return blockers
}

// ============ Material ============
// Inventory 行存在即阻止（无论 stock 是否为 0），InventoryLog 不阻止
export async function checkMaterialReferences(id: number): Promise<Blocker[]> {
  const [bom, inv, log, purchase, picking] = await Promise.all([
    prisma.billOfMaterial.count({ where: { materialId: id } }),
    prisma.inventory.count({ where: { materialId: id } }),
    prisma.inventoryLog.count({ where: { materialId: id } }),
    prisma.purchaseItem.count({ where: { materialId: id } }),
    prisma.productionPickingItem.count({ where: { materialId: id } })
  ])
  const blockers: Blocker[] = []
  if (inv > 0) blockers.push({ type: '库存记录（请先清理库存）', count: inv })
  if (bom > 0) blockers.push({ type: 'BOM 物料清单', count: bom })
  if (purchase > 0) blockers.push({ type: '采购单明细', count: purchase })
  if (picking > 0) blockers.push({ type: '生产领料明细', count: picking })
  // InventoryLog 仅提示，不阻止
  if (log > 0) blockers.push({ type: '库存变动日志（仅提示）', count: log })
  return blockers
}

// 区分阻止性 blocker 和仅提示性 blocker
export function isMaterialBlockerHard(b: Blocker): boolean {
  return !b.type.includes('仅提示')
}

// ============ Partner（往来单位） ============
// role: 'customer' 只查销售侧；'supplier' 只查采购侧；'both' 查全部
export type PartnerRole = 'customer' | 'supplier' | 'both'

export async function checkPartnerReferences(
  id: number,
  role: PartnerRole = 'both'
): Promise<Blocker[]> {
  const tasks: Promise<number>[] = []
  const checkCustomer = role === 'customer' || role === 'both'
  const checkSupplier = role === 'supplier' || role === 'both'

  tasks.push(checkCustomer ? prisma.salesOrder.count({ where: { partnerId: id } }) : Promise.resolve(0))
  tasks.push(checkCustomer ? prisma.receivable.count({ where: { partnerId: id } }) : Promise.resolve(0))
  tasks.push(checkSupplier ? prisma.purchaseOrder.count({ where: { partnerId: id } }) : Promise.resolve(0))
  tasks.push(checkSupplier ? prisma.payable.count({ where: { partnerId: id } }) : Promise.resolve(0))

  const [so, rec, po, pay] = await Promise.all(tasks)
  const blockers: Blocker[] = []
  if (so > 0) blockers.push({ type: '销货单', count: so })
  if (rec > 0) blockers.push({ type: '应收单', count: rec })
  if (po > 0) blockers.push({ type: '采购单', count: po })
  if (pay > 0) blockers.push({ type: '应付单', count: pay })
  return blockers
}

// ============ Department ============
// 仅检查 active/inactive 员工，archived/deleted 不阻止
export async function checkDepartmentReferences(id: number): Promise<Blocker[]> {
  const emp = await prisma.employee.count({
    where: { departmentId: id, status: { notIn: ['archived', 'deleted'] } }
  })
  const blockers: Blocker[] = []
  if (emp > 0) blockers.push({ type: '在职员工', count: emp })
  return blockers
}

// ============ JobType ============
export async function checkJobTypeReferences(id: number): Promise<Blocker[]> {
  const emp = await prisma.employee.count({
    where: { jobTypeId: id, status: { notIn: ['archived', 'deleted'] } }
  })
  const blockers: Blocker[] = []
  if (emp > 0) blockers.push({ type: '在职员工', count: emp })
  return blockers
}

// 辅助：把 blocker 列表格式化成中文提示
export function formatBlockers(blockers: Blocker[]): string {
  return blockers.map(b => `${b.type}：${b.count} 条`).join('；')
}
