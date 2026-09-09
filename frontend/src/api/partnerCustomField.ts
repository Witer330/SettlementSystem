import { api } from './request'

export interface PartnerCustomField {
  id: number
  key: string
  label: string
  type: 'input' | 'number' | 'select' | 'textarea'
  options?: string | null
  orderBy: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface PartnerCustomFieldValue {
  id: number
  partnerId: number
  fieldId: number
  value?: string | null
  field?: PartnerCustomField
  createdAt: string
  updatedAt: string
}

export const partnerCustomFieldApi = {
  async getFields(): Promise<PartnerCustomField[]> {
    return await api.get('/partner-custom-fields')
  },

  async createField(data: Partial<PartnerCustomField>): Promise<PartnerCustomField> {
    return await api.post('/partner-custom-fields', data)
  },

  async updateField(id: number, data: Partial<PartnerCustomField>): Promise<PartnerCustomField> {
    return await api.put(`/partner-custom-fields/${id}`, data)
  },

  async deleteField(id: number): Promise<void> {
    await api.delete(`/partner-custom-fields/${id}`)
  },

  async saveValues(partnerId: number, values: Array<{ fieldId: number; value: string | null }>): Promise<PartnerCustomFieldValue[]> {
    return await api.put(`/partner-custom-fields/values/${partnerId}`, { values })
  }
}
