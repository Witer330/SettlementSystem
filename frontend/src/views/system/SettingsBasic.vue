<template>
  <el-card class="setting-card" shadow="never">
    <el-form :model="basicSettings" label-width="150px">
      <el-form-item label="系统名称">
        <el-input v-model="basicSettings.systemName" placeholder="请输入系统名称" />
      </el-form-item>
      <el-form-item label="公司名称">
        <el-input v-model="basicSettings.companyName" placeholder="请输入公司名称" />
      </el-form-item>
    </el-form>
    <h3 class="section-title" style="margin-top:24px">侧边栏可见性</h3>
    <p class="section-desc">隐藏暂时不需要的功能模块。已隐藏的模块不会显示在左侧菜单。</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px">
      <el-checkbox v-for="m in allMenuKeys" :key="m.key" v-model="m.visible" :label="m.label" />
    </div>
    <el-button type="primary" :loading="saving" @click="saveBasicSettings" style="margin-top:16px">
      保存设置
    </el-button>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useSidebarStore } from '@/stores/sidebar'
import { settingApi } from '@/api/setting'

const saving = ref(false)
const basicSettings = reactive({
  systemName: '',
  companyName: ''
})

const allMenuKeys = reactive([
  { key: 'sales', label: '销售', visible: true },
  { key: 'purchase', label: '采购', visible: true },
  { key: 'inventory', label: '库存', visible: true },
  { key: 'finance', label: '应收应付', visible: true },
  { key: 'production', label: '生产管理', visible: true },
  { key: 'salary', label: '工资核算', visible: true },
  { key: 'basic-info', label: '基础信息', visible: true },
  { key: 'system', label: '系统设置', visible: true }
])

const loadBasicSettings = async () => {
  try {
    const [settings, hiddenRaw] = await Promise.all([
      settingApi.getList('system'),
      settingApi.getTyped<string>('ui.sidebar.hidden')
    ])
    const map = Object.fromEntries(settings.map((s: any) => [s.key, s.value]))
    basicSettings.systemName = map['system.name'] || '结算系统'
    basicSettings.companyName = map['system.companyName'] || ''
    let hidden: string[] = []
    try { if (hiddenRaw) hidden = Array.isArray(hiddenRaw) ? hiddenRaw : JSON.parse(hiddenRaw) } catch {}
    const hiddenSet = new Set(hidden)
    allMenuKeys.forEach(m => { m.visible = !hiddenSet.has(m.key) })
    useSidebarStore().setHidden(hidden)
  } catch {}
}

const saveBasicSettings = async () => {
  saving.value = true
  try {
    const hidden = JSON.stringify(allMenuKeys.filter(m => !m.visible).map(m => m.key))
    await settingApi.batchUpdate([
      { key: 'system.name', value: basicSettings.systemName, type: 'string', category: 'system', remark: '系统名称' },
      { key: 'system.companyName', value: basicSettings.companyName, type: 'string', category: 'system', remark: '公司名称' },
      { key: 'ui.sidebar.hidden', value: hidden, type: 'json', category: 'ui', remark: '侧边栏隐藏菜单' }
    ])
    ElMessage.success('设置保存成功')
    useSidebarStore().setHidden(allMenuKeys.filter(m => !m.visible).map(m => m.key))
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadBasicSettings)
</script>
