import { ref, computed, watch } from 'vue'
import type { WatchStopHandle } from 'vue'

interface DraftApi {
  create: (data: any) => Promise<{ id: number }>
  update: (id: number, data: any) => Promise<any>
  delete: (id: number) => Promise<any>
}

/**
 * 草稿自动保存组合式函数
 * @param api - 包含 create / update / delete 的 API 对象
 * @param form - 响应式表单数据 { customerId/supplierId, remark, items }
 * @param partyField - 往来方字段名 'customerId' 或 'supplierId'
 * @param itemField - 明细行的关键字段 'productId' 或 'materialId'
 */
export function useDraftAutoSave(
  api: DraftApi,
  form: Record<string, any>,
  partyField: string,
  itemField: string
) {
  const draftId = ref<number | null>(null)
  const isSaving = ref(false)
  const lastSaveError = ref<string | null>(null)
  const lastSavedAt = ref<Date | null>(null)

  let stopWatcher: WatchStopHandle | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const isDraft = computed(() => draftId.value !== null)

  function hasMeaningfulContent(): boolean {
    const party = form[partyField]
    if (party && Number(party) > 0) return true
    if (form.remark && String(form.remark).trim() !== '') return true
    const items = form.items as any[]
    if (items && items.length > 0 && items.some((i: any) => Number(i[itemField]) > 0)) return true
    return false
  }

  async function saveToBackend() {
    if (isSaving.value) return
    isSaving.value = true
    lastSaveError.value = null

    try {
      if (draftId.value) {
        await api.update(draftId.value, { ...form })
      } else if (hasMeaningfulContent()) {
        const result = await api.create({ ...form, status: 'draft' })
        draftId.value = result.id
      }
      lastSavedAt.value = new Date()
    } catch {
      lastSaveError.value = '保存失败'
    } finally {
      isSaving.value = false
    }
  }

  function debouncedSave() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(saveToBackend, 1500)
  }

  function initAutoSave(existingDraft: { id: number } | null = null) {
    draftId.value = existingDraft?.id ?? null
    lastSavedAt.value = null

    stopWatcher = watch(
      () => ({ ...form, items: [...(form.items || [])] }),
      () => {
        if (hasMeaningfulContent() || draftId.value) {
          debouncedSave()
        }
      },
      { deep: true }
    )
  }

  function stopAutoSave() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (stopWatcher) {
      stopWatcher()
      stopWatcher = null
    }
  }

  /** 提交草稿：刷新待保存内容并转为正式单 */
  async function submitDraft(): Promise<any> {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
      await saveToBackend()
    }
    const result = await api.update(draftId.value!, {
      ...form,
      status: 'pending'
    })
    draftId.value = null
    lastSavedAt.value = null
    return result
  }

  /** 主动保存为草稿（立即刷新待保存内容，不关闭自动保存） */
  async function saveAsDraft(): Promise<void> {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (!hasMeaningfulContent() && !draftId.value) return
    await saveToBackend()
  }

  /** 删除空草稿 */
  async function discardDraft() {
    if (draftId.value && !hasMeaningfulContent()) {
      try { await api.delete(draftId.value) } catch { /* 忽略 */ }
    }
    draftId.value = null
  }

  return {
    draftId,
    isDraft,
    isSaving,
    lastSaveError,
    lastSavedAt,
    initAutoSave,
    stopAutoSave,
    submitDraft,
    saveAsDraft,
    discardDraft,
    hasMeaningfulContent
  }
}
