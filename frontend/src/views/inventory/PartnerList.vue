<template>
  <div class="page-container">
    <div class="page-header">
      <h1>往来管理</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>新增往来单位
      </el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-input
          v-model="queryParams.keyword"
          placeholder="搜索名称、编码或联系人"
          clearable
          style="width: 260px"
          @keyup.enter="loadData"
        />
        <el-select v-model="roleFilter" placeholder="身份" clearable style="width: 140px" @change="loadData">
          <el-option label="客户" value="customer" />
          <el-option label="供应商" value="supplier" />
        </el-select>
        <el-select v-model="queryParams.status" placeholder="状态" clearable style="width: 120px" @change="loadData">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
          <el-option label="已归档" value="archived" />
        </el-select>
        <el-switch v-model="includeArchived" active-text="显示已归档" @change="loadData" />
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="code" label="编码" width="100" />
        <el-table-column prop="name" label="名称" min-width="130" />
        <el-table-column label="身份" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.isCustomer" type="primary" size="small" style="margin-right:4px">客户</el-tag>
            <el-tag v-if="row.isSupplier" type="warning" size="small">供应商</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="80" />
        <el-table-column prop="level" label="等级" width="70" />
        <el-table-column prop="region" label="区域" width="80" />
        <el-table-column prop="phone" label="电话" width="120" />
        <el-table-column label="信用额度" width="100">
          <template #default="{ row }">
            <span v-if="row.isCustomer && row.creditLimit > 0" class="clickable-amount" @click="toggleItemReveal(row.id)">
              {{ maskAmount(row.creditLimit, { visible: itemRevealed[`${row.id}`] }) }}
            </span>
            <span v-else style="color: var(--color-text-muted)">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)" :disabled="row.status === 'archived'">编辑</el-button>
            <el-button v-if="row.status !== 'archived'" link type="danger" @click="handleArchive(row)">归档</el-button>
            <el-button v-else link type="success" @click="handleRestore(row)">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="queryParams.page"
        v-model:page-size="queryParams.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadData"
        style="margin-top: 16px; justify-content: flex-end"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" width="680px">
      <template #header>
        <span style="font-size:18px;font-weight:600">{{ isEdit ? '编辑往来单位' : '新增往来单位' }}</span>
        <el-button :icon="Setting" size="small" style="float:right" title="字段配置" @click="configDrawerVisible = true" />
      </template>
      <el-form ref="formRef" :model="form" :rules="mergedRules" label-width="90px">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="基本信息" name="basic">
            <el-form-item label="身份" prop="identities" required>
              <el-checkbox-group v-model="form.identities">
                <el-checkbox label="customer">客户</el-checkbox>
                <el-checkbox label="supplier">供应商</el-checkbox>
              </el-checkbox-group>
              <div style="color:var(--color-text-muted);font-size:12px;margin-top:4px">至少选择一种身份；可同时勾选两种</div>
            </el-form-item>
            <el-row v-if="vis('name') || vis('code')" :gutter="16">
              <el-col v-if="vis('name')" :span="12">
                <el-form-item label="名称" prop="name" :required="req('name')">
                  <el-input v-model="form.name" placeholder="请输入名称" />
                </el-form-item>
              </el-col>
              <el-col v-if="vis('code')" :span="12">
                <el-form-item label="编码" prop="code" :required="req('code')">
                  <el-input v-model="form.code" placeholder="请输入编码" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row v-if="vis('shortName') || vis('category')" :gutter="16">
              <el-col v-if="vis('shortName')" :span="12">
                <el-form-item label="简称" :required="req('shortName')">
                  <el-input v-model="form.shortName" placeholder="请输入简称" />
                </el-form-item>
              </el-col>
              <el-col v-if="vis('category')" :span="12">
                <el-form-item label="分类" :required="req('category')">
                  <el-input v-model="form.category" placeholder="如：经销商/生产商" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row v-if="vis('level') || vis('region')" :gutter="16">
              <el-col v-if="vis('level')" :span="12">
                <el-form-item label="等级" :required="req('level')">
                  <el-input v-model="form.level" placeholder="如：VIP/A/B/C" />
                </el-form-item>
              </el-col>
              <el-col v-if="vis('region')" :span="12">
                <el-form-item label="区域" :required="req('region')">
                  <el-input v-model="form.region" placeholder="如：华东/华南" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row v-if="vis('salespersonId') || vis('defaultDiscount')" :gutter="16">
              <el-col v-if="vis('salespersonId')" :span="12">
                <el-form-item label="业务员" :required="req('salespersonId')">
                  <el-select v-model="form.salespersonId" placeholder="请选择" clearable filterable style="width:100%">
                    <el-option v-for="e in employees" :key="e.id" :label="e.name" :value="e.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col v-if="vis('defaultDiscount')" :span="12">
                <el-form-item label="默认折扣" :required="req('defaultDiscount')">
                  <el-input-number v-model="form.defaultDiscount" :min="0" :max="100" :precision="0" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row v-if="form.identities.includes('customer')" :gutter="16">
              <el-col :span="12">
                <el-form-item label="信用额度">
                  <el-input-number v-model="form.creditLimit" :min="0" :precision="2" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item v-if="isEdit" label="状态">
              <el-select v-model="form.status" style="width:200px">
                <el-option label="启用" value="active" />
                <el-option label="停用" value="inactive" />
              </el-select>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="联系方式" name="contact">
            <el-row v-if="vis('contact') || vis('phone')" :gutter="16">
              <el-col v-if="vis('contact')" :span="12">
                <el-form-item label="联系人" :required="req('contact')">
                  <el-input v-model="form.contact" placeholder="请输入联系人" />
                </el-form-item>
              </el-col>
              <el-col v-if="vis('phone')" :span="12">
                <el-form-item label="电话" :required="req('phone')">
                  <el-input v-model="form.phone" placeholder="请输入联系电话" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row v-if="vis('email') || vis('fax')" :gutter="16">
              <el-col v-if="vis('email')" :span="12">
                <el-form-item label="邮箱" :required="req('email')">
                  <el-input v-model="form.email" placeholder="请输入邮箱" />
                </el-form-item>
              </el-col>
              <el-col v-if="vis('fax')" :span="12">
                <el-form-item label="传真" :required="req('fax')">
                  <el-input v-model="form.fax" placeholder="请输入传真" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item v-if="vis('address')" label="地址" :required="req('address')">
              <el-input v-model="form.address" placeholder="请输入地址" />
            </el-form-item>
            <el-form-item v-if="vis('shippingAddress')" label="发货地址" :required="req('shippingAddress')">
              <el-input v-model="form.shippingAddress" placeholder="请输入发货地址" />
            </el-form-item>
            <el-form-item v-if="vis('website')" label="网址" :required="req('website')">
              <el-input v-model="form.website" placeholder="请输入网址" />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="附加信息" name="extra">
            <el-row v-if="vis('legalPerson') || vis('registeredCapital')" :gutter="16">
              <el-col v-if="vis('legalPerson')" :span="12">
                <el-form-item label="法人" :required="req('legalPerson')">
                  <el-input v-model="form.legalPerson" placeholder="请输入法人" />
                </el-form-item>
              </el-col>
              <el-col v-if="vis('registeredCapital')" :span="12">
                <el-form-item label="注册资本" :required="req('registeredCapital')">
                  <el-input-number v-model="form.registeredCapital" :min="0" :precision="2" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item v-if="vis('businessScope')" label="经营范围" :required="req('businessScope')">
              <el-input v-model="form.businessScope" type="textarea" :rows="2" placeholder="请输入经营范围" />
            </el-form-item>
            <el-form-item v-if="vis('remark')" label="备注" :required="req('remark')">
              <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane v-if="customFields.length > 0" label="自定义字段" name="custom">
            <el-form-item v-for="cf in customFields" :key="cf.key" :label="cf.label" v-show="vis(cf.key)" :required="req(cf.key)">
              <el-select
                v-if="cf.type === 'select'"
                v-model="customFieldValues[cf.key]"
                :placeholder="`请选择${cf.label}`"
                clearable
                style="width:100%"
              >
                <el-option
                  v-for="opt in parseOptions(cf.options)"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
              <el-input-number
                v-else-if="cf.type === 'number'"
                v-model="customFieldValues[cf.key]"
                :min="0"
                :precision="2"
                style="width:100%"
              />
              <el-input
                v-else-if="cf.type === 'textarea'"
                v-model="customFieldValues[cf.key]"
                type="textarea"
                :rows="2"
                :placeholder="`请输入${cf.label}`"
              />
              <el-input
                v-else
                v-model="customFieldValues[cf.key]"
                :placeholder="`请输入${cf.label}`"
              />
            </el-form-item>
            <div v-if="customFields.length === 0" style="color:var(--color-text-muted);font-size:13px;padding:16px 0">暂无可自定义字段，请在字段配置中添加</div>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <PartnerFieldConfig v-model="configDrawerVisible" :fields="partnerFields" @save="saveConfig" @reset="resetToDefault" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormRules } from 'element-plus'
import { Plus, Setting } from '@element-plus/icons-vue'
import { partnerApi, type Partner } from '@/api/partner'
import { employeeApi, type Employee } from '@/api/employee'
import { useAmountPrivacy } from '@/composables/useAmountPrivacy'
import { confirmAndArchive, confirmAndRestore } from '@/composables/useArchive'
import { useFieldConfig, type FieldConfig, type FieldDef } from '@/composables/useFieldConfig'
import PartnerFieldConfig from '@/components/PartnerFieldConfig.vue'
import { partnerCustomFieldApi, type PartnerCustomField } from '@/api/partnerCustomField'

const SETTING_KEY = 'partner.fieldConfig'
const PARTNER_DEFAULTS: FieldConfig = {
  fields: [
    { key: 'name',         label: '名称',     type: 'input',    tab: 'basic',   visible: true, required: true },
    { key: 'code',         label: '编码',     type: 'input',    tab: 'basic',   visible: true, required: true },
    { key: 'shortName',    label: '简称',     type: 'input',    tab: 'basic',   visible: true, required: false },
    { key: 'category',     label: '分类',     type: 'input',    tab: 'basic',   visible: true, required: false },
    { key: 'level',        label: '等级',     type: 'input',    tab: 'basic',   visible: true, required: false },
    { key: 'region',       label: '区域',     type: 'input',    tab: 'basic',   visible: true, required: false },
    { key: 'defaultDiscount', label: '默认折扣', type: 'number', tab: 'basic',  visible: true, required: false },
    { key: 'salespersonId',label: '业务员',   type: 'select',   tab: 'basic',   visible: true, required: false },
    { key: 'contact',      label: '联系人',   type: 'input',    tab: 'contact', visible: true, required: false },
    { key: 'phone',        label: '电话',     type: 'input',    tab: 'contact', visible: true, required: false },
    { key: 'email',        label: '邮箱',     type: 'input',    tab: 'contact', visible: true, required: false },
    { key: 'fax',          label: '传真',     type: 'input',    tab: 'contact', visible: true, required: false },
    { key: 'address',      label: '地址',     type: 'input',    tab: 'contact', visible: true, required: false },
    { key: 'shippingAddress', label: '发货地址', type: 'input',  tab: 'contact', visible: true, required: false },
    { key: 'website',      label: '网址',     type: 'input',    tab: 'contact', visible: true, required: false },
    { key: 'legalPerson',  label: '法人',     type: 'input',    tab: 'extra',   visible: true, required: false },
    { key: 'registeredCapital', label: '注册资本', type: 'number', tab: 'extra', visible: true, required: false },
    { key: 'businessScope',label: '经营范围', type: 'textarea',  tab: 'extra',   visible: true, required: false },
    { key: 'remark',       label: '备注',     type: 'textarea',  tab: 'extra',   visible: true, required: false }
  ]
}

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<Partner[]>([])
const total = ref(0)
const includeArchived = ref(false)
const roleFilter = ref<'' | 'customer' | 'supplier'>('')
const employees = ref<Employee[]>([])
const activeTab = ref('basic')
const customFields = ref<PartnerCustomField[]>([])
const customFieldValues = reactive<Record<string, any>>({})

function parseOptions(options?: string | null): string[] {
  if (!options) return []
  try { return JSON.parse(options) } catch { return [] }
}

async function loadCustomFields() {
  try { customFields.value = await partnerCustomFieldApi.getFields() }
  catch { customFields.value = [] }
  // 将自定义字段合并到 partnerFields 中，使 vis/req 能控制它们
  partnerFields.value = partnerFields.value.filter(f => f.tab !== 'custom')
  for (const cf of customFields.value) {
    if (!partnerFields.value.find(f => f.key === cf.key)) {
      partnerFields.value.push({
        key: cf.key,
        label: cf.label,
        type: cf.type === 'textarea' ? 'input' : cf.type === 'select' ? 'input' : cf.type as any,
        tab: 'custom',
        visible: true,
        required: false
      })
    }
  }
}

const { maskAmount } = useAmountPrivacy()
const itemRevealed = reactive<Record<string, boolean>>({})
const toggleItemReveal = (id: number) => { itemRevealed[`${id}`] = !itemRevealed[`${id}`] }

const { fields: partnerFields, loadConfig, saveConfig, resetToDefault } = useFieldConfig(SETTING_KEY, PARTNER_DEFAULTS)
const configDrawerVisible = ref(false)

const fieldMap = computed(() => new Map<string, FieldDef>(partnerFields.value.map(f => [f.key, f] as [string, FieldDef])))
const vis = (key: string) => fieldMap.value.get(key)?.visible ?? true
const req = (key: string) => fieldMap.value.get(key)?.required ?? false

const dynamicRules = computed(() => {
  const r: Record<string, any> = {}
  for (const f of partnerFields.value) {
    if (f.visible && f.required) {
      const msg = f.type === 'select' ? `请选择${f.label}` : `请输入${f.label}`
      r[f.key] = [{ required: true, message: msg, trigger: 'blur' }]
    }
  }
  return r
})

const mergedRules = computed<FormRules>(() => ({
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  identities: [{
    validator: (_rule, value, callback) => {
      if (!Array.isArray(value) || value.length === 0) callback(new Error('至少选择一种身份'))
      else callback()
    },
    trigger: 'change'
  }],
  ...dynamicRules.value
}))

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const formRef = ref()

const queryParams = reactive({ page: 1, pageSize: 20, keyword: '', status: '' })

const form = reactive({
  name: '',
  code: '',
  shortName: '',
  contact: '',
  phone: '',
  email: '',
  fax: '',
  address: '',
  shippingAddress: '',
  website: '',
  region: '',
  category: '',
  level: '',
  identities: [] as Array<'customer' | 'supplier'>,
  creditLimit: 0,
  defaultDiscount: 100,
  salespersonId: null as number | null,
  legalPerson: '',
  registeredCapital: null as number | null,
  businessScope: '',
  remark: '',
  status: 'active'
})

const statusLabel = (s: string) => s === 'active' ? '启用' : s === 'inactive' ? '停用' : s === 'archived' ? '已归档' : s
const statusTagType = (s: string): 'success' | 'info' | 'warning' => s === 'active' ? 'success' : s === 'archived' ? 'warning' : 'info'

const listParams = computed(() => {
  const p: any = { ...queryParams, includeArchived: includeArchived.value }
  if (roleFilter.value === 'customer') p.isCustomer = true
  if (roleFilter.value === 'supplier') p.isSupplier = true
  return p
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await partnerApi.getList(listParams.value)
    tableData.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

const openDialog = (row?: Partner) => {
  isEdit.value = !!row
  editId.value = row?.id || 0
  form.name = row?.name || ''
  form.code = row?.code || ''
  form.shortName = row?.shortName || ''
  form.contact = row?.contact || ''
  form.phone = row?.phone || ''
  form.email = row?.email || ''
  form.fax = row?.fax || ''
  form.address = row?.address || ''
  form.shippingAddress = row?.shippingAddress || ''
  form.website = row?.website || ''
  form.region = row?.region || ''
  form.category = row?.category || ''
  form.level = row?.level || ''
  form.creditLimit = row?.creditLimit || 0
  form.defaultDiscount = row?.defaultDiscount ?? 100
  form.salespersonId = row?.salespersonId ?? null
  form.legalPerson = row?.legalPerson || ''
  form.registeredCapital = row?.registeredCapital ?? null
  form.businessScope = row?.businessScope || ''
  form.remark = row?.remark || ''
  form.status = row?.status || 'active'
  form.identities = []
  if (row?.isCustomer) form.identities.push('customer')
  if (row?.isSupplier) form.identities.push('supplier')
  // 加载自定义字段值
  Object.keys(customFieldValues).forEach(k => delete customFieldValues[k])
  if (row?.customFieldValues) {
    for (const cv of row.customFieldValues) {
      customFieldValues[cv.field.key] = cv.value
    }
  }
  activeTab.value = 'basic'
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value?.validate()
  // 自定义字段必填校验
  for (const cf of customFields.value) {
    if (vis(cf.key) && req(cf.key)) {
      const val = customFieldValues[cf.key]
      if (val === undefined || val === null || val === '') {
        ElMessage.warning(`请填写${cf.label}`)
        return
      }
    }
  }
  submitting.value = true
  try {
    const payload: any = {
      name: form.name,
      code: form.code,
      shortName: form.shortName || null,
      contact: form.contact || null,
      phone: form.phone || null,
      email: form.email || null,
      fax: form.fax || null,
      address: form.address || null,
      shippingAddress: form.shippingAddress || null,
      website: form.website || null,
      region: form.region || null,
      category: form.category || null,
      level: form.level || null,
      isCustomer: form.identities.includes('customer'),
      isSupplier: form.identities.includes('supplier'),
      creditLimit: form.identities.includes('customer') ? form.creditLimit : 0,
      defaultDiscount: form.defaultDiscount,
      salespersonId: form.salespersonId,
      legalPerson: form.legalPerson || null,
      registeredCapital: form.registeredCapital,
      businessScope: form.businessScope || null,
      remark: form.remark || null
    }
    let partnerId = editId.value
    if (isEdit.value) {
      payload.status = form.status
      await partnerApi.update(editId.value, payload)
      ElMessage.success('更新成功')
    } else {
      const created = await partnerApi.create(payload)
      partnerId = created.id
      ElMessage.success('创建成功')
    }
    // 保存自定义字段值
    if (customFields.value.length > 0 && partnerId) {
      const vals = customFields.value.map(cf => ({
        fieldId: cf.id,
        value: customFieldValues[cf.key] ?? null
      }))
      await partnerCustomFieldApi.saveValues(partnerId, vals).catch(() => {})
    }
    dialogVisible.value = false
    loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally { submitting.value = false }
}

const handleArchive = (row: Partner) =>
  confirmAndArchive({
    entityLabel: '往来单位',
    entityName: row.name,
    onArchive: () => partnerApi.delete(row.id),
    onSuccess: loadData
  })

const handleRestore = (row: Partner) =>
  confirmAndRestore({
    entityLabel: '往来单位',
    entityName: row.name,
    onRestore: () => partnerApi.restore(row.id),
    onSuccess: loadData
  })

onMounted(() => {
  loadData()
  loadConfig()
  loadCustomFields()
  employeeApi.getList({ page: 1, pageSize: 1000, status: 'active' }).then(r => employees.value = r.list)
})
</script>

<style scoped>
.page-container { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
.page-header h1 { margin: 0; font-size: var(--font-size-h3); font-weight: var(--font-weight-600); }
.filter-bar { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); align-items: center; }
.clickable-amount { cursor: pointer; padding: 2px 4px; border-radius: var(--radius-sm); transition: background-color 0.15s; display: inline-block; }
.clickable-amount:hover { background-color: var(--el-fill-color-light); }
</style>
