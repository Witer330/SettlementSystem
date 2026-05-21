import { ref, type Ref } from 'vue'

export interface TableNavOptions {
  /** 响应式数据源 */
  items: Ref<any[]>
  /** 新增空行 */
  addItemRow: () => void
  /** 删除指定行 */
  removeItem: (row: any) => void
  /** 保存草稿 */
  saveDraft: () => Promise<void>
  /** 提交 */
  submit: () => Promise<void>
  /** 可编辑列的索引（按 Tab/Enter 导航顺序） */
  editableCols: number[]
}

/**
 * 工业工作台表格键盘导航
 *
 * 按键映射：
 *   Enter / Tab       → 确认输入，跳到下一个可编辑单元格（同行下一列，或下一行首列）
 *   Shift+Tab         → 跳到上一个可编辑单元格
 *   Ctrl+S            → 保存草稿
 *   Ctrl+Enter        → 提交
 *   Ctrl+D            → 删除当前行
 *   Escape            → 取消编辑（聚焦到表体容器，不触发操作）
 */
export function useKeyboardNavigation(options: TableNavOptions) {
  const { items, addItemRow, removeItem, saveDraft, submit, editableCols } = options

  /** 当前聚焦单元格：{ row, col }（col 为 editableCols 中的索引，非 DOM 列号） */
  const focusedCell = ref<{ row: number; col: number } | null>(null)

  /** 根据 DOM 列号获取 editableCols 中的索引，找不到返回 -1 */
  function editableColIndex(domCol: number): number {
    return editableCols.indexOf(domCol)
  }

  /** 聚焦指定单元格 */
  function focusCell(rowIndex: number, colDomIndex: number) {
    const table = document.querySelector('.ws-body .el-table__body-wrapper table') as HTMLTableElement | null
    if (!table) return

    const rows = table.querySelectorAll('tbody tr')
    const row = rows[rowIndex] as HTMLTableRowElement | undefined
    if (!row) return

    const cells = row.querySelectorAll('td')
    const cell = cells[colDomIndex] as HTMLTableCellElement | undefined
    if (!cell) return

    const input = cell.querySelector('input') as HTMLInputElement | null
    if (input) {
      input.focus()
      input.select()
    }
    // 对于 el-select（点击触发），尝试触发其打开
    const selectTrigger = cell.querySelector('.el-select .el-select__wrapper') as HTMLElement | null
    if (selectTrigger) selectTrigger.click()

    const colIdx = editableColIndex(colDomIndex)
    if (colIdx >= 0) focusedCell.value = { row: rowIndex, col: colIdx }
  }

  /** 获取当前聚焦单元格的 rowIndex 和 domColIndex */
  function currentCell(): { rowIndex: number; domCol: number } | null {
    const active = document.activeElement as HTMLElement | null
    if (!active) return null
    const td = active.closest('td') as HTMLTableCellElement | null
    if (!td) return null
    const tr = td.closest('tr') as HTMLTableRowElement | null
    if (!tr) return null
    const tbody = tr.closest('tbody')
    if (!tbody) return null
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr)
    const domCol = Array.from(tr.querySelectorAll('td')).indexOf(td)
    return { rowIndex, domCol }
  }

  /** 跳到下一个可编辑单元格 */
  function goNext() {
    const cur = currentCell()
    if (!cur) return
    const curEditableIdx = editableColIndex(cur.domCol)

    // 当前在可编辑列上 → 找同行下一个可编辑列
    if (curEditableIdx >= 0) {
      const nextEditableIdx = curEditableIdx + 1
      if (nextEditableIdx < editableCols.length) {
        focusCell(cur.rowIndex, editableCols[nextEditableIdx])
        return
      }
    }

    // 当前在最后一列（或非可编辑列） → 下一行首列
    const nextRow = cur.rowIndex + 1
    if (nextRow < items.value.length) {
      focusCell(nextRow, editableCols[0])
    } else {
      // 已是最后一行 → 自动新增行
      addItemRow()
      // 等 Vue 渲染后再聚焦
      setTimeout(() => focusCell(items.value.length - 1, editableCols[0]), 50)
    }
  }

  /** 跳到上一个可编辑单元格 */
  function goPrev() {
    const cur = currentCell()
    if (!cur) return
    const curEditableIdx = editableColIndex(cur.domCol)

    if (curEditableIdx >= 0) {
      const prevEditableIdx = curEditableIdx - 1
      if (prevEditableIdx >= 0) {
        focusCell(cur.rowIndex, editableCols[prevEditableIdx])
        return
      }
    }

    // 当前在第一列 → 上一行最后一列
    if (cur.rowIndex > 0) {
      focusCell(cur.rowIndex - 1, editableCols[editableCols.length - 1])
    }
  }

  /** 表体键盘事件：处理行级操作（Ctrl+S/Ctrl+Enter/Ctrl+D/Escape） */
  function onTableKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveDraft(); return }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); submit(); return }
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault()
      const cur = currentCell()
      if (cur && items.value.length > 1) {
        removeItem(items.value[cur.rowIndex])
      }
      return
    }
    if (e.key === 'Escape') {
      // 将焦点移出输入框到表体容器
      const body = document.querySelector('.ws-body') as HTMLElement | null
      body?.focus()
      focusedCell.value = null
    }
    // Enter 在非输入区域时新增行
    if (e.key === 'Enter' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
      addItemRow()
    }
  }

  /** 检查是否有下拉/弹窗打开（el-select / el-autocomplete） */
  function hasOpenDropdown(): boolean {
    return !!(document.querySelector('.el-select-dropdown:not(.is-hidden)') ||
              document.querySelector('.el-popper.is-light:not(.is-hidden)') ||
              document.querySelector('.el-autocomplete-suggestion:not(.is-hidden)'))
  }

  /** 单元格键盘事件：处理 Enter/Tab 跳转 */
  function onCellKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.ctrlKey) {
      // 下拉/弹窗打开时，让 el-select / el-autocomplete 处理选项选择
      if (hasOpenDropdown()) return
      e.preventDefault(); goNext(); return
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      if (hasOpenDropdown()) return
      e.preventDefault(); goNext(); return
    }
    if (e.key === 'Tab' && e.shiftKey) {
      if (hasOpenDropdown()) return
      e.preventDefault(); goPrev(); return
    }
  }

  return { focusedCell, focusCell, onTableKeydown, onCellKeydown }
}
