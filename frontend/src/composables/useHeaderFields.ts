import { ref, computed } from 'vue'
import { settingApi } from '@/api/setting'
import { partnerCustomFieldApi, type PartnerCustomField } from '@/api/partnerCustomField'

/** 单据表头字段定义 */
export interface HeaderFieldDef {
  key: string
  label: string
  type: 'input' | 'select' | 'date' | 'number' | 'checkbox' | 'display'
  options?: string[]
  width?: number
  fullRow?: boolean
  visible: boolean
  source?: 'partner' // 来源：往来管理自定义字段
}

/** 持久化的配置结构 */
interface HeaderFieldConfig {
  fields: HeaderFieldDef[]
  perRow: number
}

const PF_PREFIX = 'pf_'

/** 将 PartnerCustomField 转为 HeaderFieldDef */
function partnerFieldToHeaderDef(pf: PartnerCustomField): HeaderFieldDef {
  let type: HeaderFieldDef['type'] = 'input'
  if (pf.type === 'number') type = 'number'
  else if (pf.type === 'select') type = 'select'
  else if (pf.type === 'textarea') type = 'input'

  return {
    key: PF_PREFIX + pf.key,
    label: pf.label,
    type,
    options: pf.options ? JSON.parse(pf.options) : undefined,
    visible: false,
    source: 'partner'
  }
}

/** 销货单默认字段配置 */
const SALES_ORDER_DEFAULTS: HeaderFieldConfig = {
  perRow: 3,
  fields: [
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
}

const SETTING_KEY = 'salesOrder.headerFields'

export function useHeaderFields() {
  const fields = ref<HeaderFieldDef[]>([])
  const perRow = ref(3)
  const loading = ref(false)
  // 往来管理可用字段列表
  const partnerFields = ref<PartnerCustomField[]>([])
  const partnerFieldsLoading = ref(false)

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
        if (current.length >= perRow.value) { groups.push(current); current = [] }
      }
    }
    if (current.length > 0) groups.push(current)
    return groups
  })

  /** 当前配置中引用的往来字段 keys（去除 pf_ 前缀） */
  const referencedPartnerKeys = computed(() => {
    return fields.value
      .filter(f => f.key.startsWith(PF_PREFIX))
      .map(f => f.key.slice(PF_PREFIX.length))
  })

  async function loadConfig() {
    loading.value = true
    try {
      const data = await settingApi.getTyped<HeaderFieldConfig | null>(SETTING_KEY)
      if (data && Array.isArray(data.fields)) {
        fields.value = data.fields
        perRow.value = data.perRow || 3
      } else {
        fields.value = JSON.parse(JSON.stringify(SALES_ORDER_DEFAULTS.fields))
        perRow.value = SALES_ORDER_DEFAULTS.perRow
      }
    } catch {
      fields.value = JSON.parse(JSON.stringify(SALES_ORDER_DEFAULTS.fields))
      perRow.value = SALES_ORDER_DEFAULTS.perRow
    } finally {
      loading.value = false
    }
  }

  /** 加载往来管理自定义字段列表 */
  async function loadPartnerFields() {
    partnerFieldsLoading.value = true
    try {
      const list = await partnerCustomFieldApi.getFields()
      partnerFields.value = list
    } catch { /* 忽略 */ }
    finally { partnerFieldsLoading.value = false }
  }

  /** 添加/移除往来字段到表头 */
  function togglePartnerField(pf: PartnerCustomField, add: boolean) {
    const headerKey = PF_PREFIX + pf.key
    if (add) {
      if (!fields.value.some(f => f.key === headerKey)) {
        fields.value.push(partnerFieldToHeaderDef(pf))
      }
    } else {
      const idx = fields.value.findIndex(f => f.key === headerKey)
      if (idx >= 0) fields.value.splice(idx, 1)
    }
  }

  /** 判断往来字段是否已被表头引用 */
  function isPartnerFieldReferenced(pfKey: string): boolean {
    return fields.value.some(f => f.key === PF_PREFIX + pfKey)
  }

  async function saveConfig(newFields: HeaderFieldDef[], newPerRow?: number) {
    fields.value = newFields
    if (newPerRow !== undefined) perRow.value = newPerRow
    const config: HeaderFieldConfig = { fields: newFields, perRow: perRow.value }
    await settingApi.updateSetting(SETTING_KEY, JSON.stringify(config), '销货单表头字段配置', 'json')
  }

  function resetToDefault() {
    fields.value = JSON.parse(JSON.stringify(SALES_ORDER_DEFAULTS.fields))
    perRow.value = SALES_ORDER_DEFAULTS.perRow
  }

  return {
    fields, perRow, fieldGroups, loading,
    partnerFields, partnerFieldsLoading, referencedPartnerKeys,
    loadConfig, loadPartnerFields,
    togglePartnerField, isPartnerFieldReferenced,
    saveConfig, resetToDefault
  }
}
