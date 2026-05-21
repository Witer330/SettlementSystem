import { ElMessage, ElMessageBox } from 'element-plus'

interface Blocker {
  type: string
  count: number
}

function formatBlockers(blockers?: Blocker[]): string {
  if (!blockers || blockers.length === 0) return ''
  return blockers.map(b => `${b.type}：${b.count} 条`).join('；')
}

interface ArchiveOptions {
  entityLabel: string // 如"产品"、"物料"
  entityName: string // 如"包装盒 A"
  onArchive: () => Promise<any>
  onSuccess?: () => void | Promise<void>
}

export async function confirmAndArchive(opts: ArchiveOptions) {
  try {
    await ElMessageBox.confirm(
      `确定要归档${opts.entityLabel}"${opts.entityName}"吗？归档后将不在常规列表显示，可通过"显示已归档"找回。`,
      `归档${opts.entityLabel}`,
      { type: 'warning', confirmButtonText: '确认归档', cancelButtonText: '取消' }
    )
  } catch {
    return // 取消
  }

  try {
    await opts.onArchive()
    ElMessage.success(`已归档${opts.entityLabel}`)
    await opts.onSuccess?.()
  } catch (err: any) {
    const blockers: Blocker[] | undefined = err?.blockers
    if (blockers && blockers.length > 0) {
      ElMessageBox.alert(
        `该${opts.entityLabel}存在以下关联数据，无法归档：\n${formatBlockers(blockers)}`,
        '无法归档',
        { type: 'error', confirmButtonText: '我知道了' }
      )
    } else {
      ElMessage.error(err?.message || `归档${opts.entityLabel}失败`)
    }
  }
}

interface RestoreOptions {
  entityLabel: string
  entityName: string
  onRestore: () => Promise<any>
  onSuccess?: () => void | Promise<void>
}

export async function confirmAndRestore(opts: RestoreOptions) {
  try {
    await ElMessageBox.confirm(
      `确定要恢复${opts.entityLabel}"${opts.entityName}"吗？恢复后将重新出现在常规列表中。`,
      `恢复${opts.entityLabel}`,
      { type: 'info', confirmButtonText: '确认恢复', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  try {
    await opts.onRestore()
    ElMessage.success(`已恢复${opts.entityLabel}`)
    await opts.onSuccess?.()
  } catch (err: any) {
    ElMessage.error(err?.message || `恢复${opts.entityLabel}失败`)
  }
}
