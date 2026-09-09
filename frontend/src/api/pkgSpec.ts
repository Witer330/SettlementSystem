import { api } from './request'

export interface PkgSpec {
  id?: number
  ownerType: string
  ownerId: number
  name: string
  unitName: string
  ratio: number
  isDefault: boolean
}

export const pkgSpecApi = {
  getList: (ownerType: string, ownerId: number) =>
    api.get<PkgSpec[]>(`/pkg-specs?ownerType=${ownerType}&ownerId=${ownerId}`),

  save: (ownerType: string, ownerId: number, specs: Omit<PkgSpec, 'id' | 'ownerType' | 'ownerId'>[]) =>
    api.put<PkgSpec[]>('/pkg-specs', { ownerType, ownerId, specs })
}
