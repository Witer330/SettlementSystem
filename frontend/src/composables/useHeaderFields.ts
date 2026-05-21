import { ref, computed } from 'vue'
import { settingApi } from '@/api/setting'

/** 单据表头字段定义 */
export interface HeaderFieldDef {
  key: string
  label: string
  type: 'input' | 'select' | 'date' | 'number' | 'checkbox' | 'display'
  options?: string[]
  width?: number
  fullRow?: boolean
  visible: boolean
}

/** 销货单默认字段配置 */
const SALES_ORDER_DEFAULTS: HeaderFieldDef[] = [
  { key: 'orderDate', label: '单据日期', type: 'date', width: 140, visible: true },
  { key: 'orderNo', label: '单据编号', type: 'display', width: 140, visible: true },
  { key: 'businessType', label: '业务类型', type: 'select', options: ['销售', '代销', '赠品'], width: 120, visible: true },
  { key: 'customerId', label: '结算客户', type: 'select', width: 180, visible: true },
  { key: 'deliveryMethod', label: '配送方式', type: 'select', options: ['自提', '送货', '物流', '快递'], width: 120, visible: true },
  { key: 'salesperson', label: '业务员', type: 'input', width: 100, visible: true },
  { key: 'deliveryPerson', label: '送货人', type: 'input', width: 100, visible: true },
  { key: 'returnDate', label: '返货日期', type: 'date', width: 140, visible: true },
  { key: 'paymentMethod', label: '收款方式', type: 'select', options: ['现金', '转账', '月结', '预收'], width: 120, visible: true },
  { key: 'contactInfo', label: '联系方式', type: 'input', width: 140, visible: true },
  { key: 'wholeDiscount', label: '整单折扣', type: 'number', width: 100, visible: true },
  { key: 'usePrepayment', label: '使用预收', type: 'checkbox', visible: true },
  { key: 'shippingAddress', label: '收货地址', type: 'input', fullRow: true, visible: true },
]

const SETTING_KEY = 'salesOrder.headerFields'
const FIELDS_PER_ROW = 3

export function useHeaderFields() {
  const fields = ref<HeaderFieldDef[]>([])
  const loading = ref(false)

  /** 按行分组：fullRow 字段独占一行，其余每 FIELDS_PER_ROW 个一行 */
  const fieldGroups = computed(() => {
    const visible = fields.value.filter(f => f.visible)
    const groups: HeaderFieldDef[][] = []
    let current: HeaderFieldDef[] = []
    for (const f of visible) {
      if (f.fullRow) {
        if (current.length > 0) { groups.push(current); current = [] }
        groups.push([f])
      } else {
        current.push(f)
        if (current.length >= FIELDS_PER_ROW) { groups.push(current); current = [] }
      }
    }
    if (current.length > 0) groups.push(current)
    return groups
  })

  async function loadConfig() {
    loading.value = true
    try {
      const data = await settingApi.getTyped<HeaderFieldDef[] | null>(SETTING_KEY)
      if (data && Array.isArray(data) && data.length > 0) {
        fields.value = data
      } else {
        fields.value = JSON.parse(JSON.stringify(SALES_ORDER_DEFAULTS))
      }
    } catch {
      fields.value = JSON.parse(JSON.stringify(SALES_ORDER_DEFAULTS))
    } finally {
      loading.value = false
    }
  }

  async function saveConfig(newFields: HeaderFieldDef[]) {
    fields.value = newFields
    await settingApi.updateSetting(
      SETTING_KEY,
      JSON.stringify(newFields),
      '销货单表头字段配置',
      'json'
    )
  }

  function resetToDefault() {
    fields.value = JSON.parse(JSON.stringify(SALES_ORDER_DEFAULTS))
  }

  return { fields, fieldGroups, loading, loadConfig, saveConfig, resetToDefault }
}
