/**
 * 订单状态标签映射 — 销货单/采购单共用
 */
export function useStatusHelpers() {
  const label = (s: string) => ({ draft: '草稿', pending: '待确认', confirmed: '已确认', completed: '已完成' }[s] || s)
  const tagType = (s: string) => ({ draft: 'info', pending: 'warning', confirmed: 'primary', completed: 'success' }[s] || '')

  const helpText = {
    confirm: '确认后订单进入"已确认"状态，表示审核通过，可以安排生产或备货。流转条件：客户已确认交期和价格。',
    complete: '完成后订单进入"已完成"状态，表示全部商品已发货完毕。流转条件：所有商品已出库并发货。将扣减成品库存。',
    returned: '退货后生成独立退货单，成品库存自动回加。填写实际退回数量即可。退货不改变销货单状态。',
  }

  return { statusLabel: label, statusType: tagType, statusHelp: helpText }
}
