import { ref } from 'vue'
import { settingApi } from '@/api/setting'

/** 可配置的字段定义 */
export interface FieldDef {
  key: string
  label: string
  type: 'input' | 'number' | 'select' | 'textarea'
  tab: string
  visible: boolean
  required: boolean
}

/** 持久化的字段配置 */
export interface FieldConfig {
  fields: FieldDef[]
}

export function useFieldConfig(settingKey: string, defaults: FieldConfig) {
  const fields = ref<FieldDef[]>([])
  const loading = ref(false)

  async function loadConfig() {
    loading.value = true
    try {
      const data = await settingApi.getTyped<FieldConfig | null>(settingKey)
      if (data && Array.isArray(data.fields)) {
        fields.value = data.fields
      } else {
        fields.value = JSON.parse(JSON.stringify(defaults.fields))
      }
    } catch {
      fields.value = JSON.parse(JSON.stringify(defaults.fields))
    } finally {
      loading.value = false
    }
  }

  async function saveConfig(newFields: FieldDef[]) {
    fields.value = newFields
    const config: FieldConfig = { fields: newFields }
    await settingApi.updateSetting(settingKey, JSON.stringify(config), '往来单位字段配置', 'json')
  }

  function resetToDefault() {
    fields.value = JSON.parse(JSON.stringify(defaults.fields))
  }

  return { fields, loading, loadConfig, saveConfig, resetToDefault }
}
