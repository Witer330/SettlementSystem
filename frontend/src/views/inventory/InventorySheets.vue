<template>
  <div class="page-container">
    <div class="page-header">
      <h1>{{ isInbound ? '入库管理' : '出库管理' }}</h1>
      <el-button type="primary" @click="openNew"><el-icon><Plus /></el-icon>新增{{ isInbound ? '入库' : '出库' }}单</el-button>
    </div>

    <el-card shadow="never">
      <div class="filter-bar">
        <el-date-picker v-model="dateRange" type="month" placeholder="月份" format="YYYY-MM" value-format="YYYY-MM" @change="loadData" />
        <el-input v-model="keyword" placeholder="搜索物料/备注" clearable style="width:200px" @keyup.enter="loadData" />
        <el-button type="primary" @click="loadData">搜索</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe style="width:100%">
        <el-table-column label="单据号" width="160"><template #default="{ row }">{{ row.batchNo || `#${row.id}` }}</template></el-table-column>
        <el-table-column label="日期" width="110" align="center"><template #default="{ row }">{{ new Date(row.createdAt).toLocaleDateString('zh-CN') }}</template></el-table-column>
        <el-table-column label="物料" min-width="160"><template #default="{ row }">{{ row.material?.code }} {{ row.material?.name }}</template></el-table-column>
        <el-table-column label="数量" width="100" align="right"><template #default="{ row }">{{ row.quantity }}{{ row.pkgSpec ? row.pkgSpec : row.material?.unit || '' }}{{ row.unitRatio ? ` (${row.quantity * row.unitRatio}${row.material?.unit || ''})` : '' }}</template></el-table-column>
        <el-table-column label="备注" min-width="120" prop="remark" />
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="loadData" style="margin-top:16px;justify-content:flex-end" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { inventoryApi } from '@/api/inventory'
import { useTabStore } from '@/stores/tabs'
import { ElMessage } from 'element-plus'

const route = useRoute()
const tabStore = useTabStore()
const isInbound = computed(() => !route.path.includes('outbound'))
const sheetType = computed(() => isInbound.value ? 'in' : 'out')

const loading = ref(false); const tableData = ref<any[]>([]); const total = ref(0)
const page = ref(1); const pageSize = ref(20); const keyword = ref(''); const dateRange = ref('')

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value, type: sheetType.value }
    if (keyword.value) params.keyword = keyword.value
    if (dateRange.value) { const [y, m] = dateRange.value.split('-'); params.startDate = `${y}-${m}-01`; params.endDate = new Date(+y, +m, 0).toISOString().slice(0, 10) }
    const r = await inventoryApi.getLogs(params)
    tableData.value = r.list; total.value = r.total
  } catch (e: any) { ElMessage.error(e.message) } finally { loading.value = false }
}

function openNew() { tabStore.addTab(`inventory-${sheetType.value}`, `${isInbound ? '入库' : '出库'}单 - 新建`, { isNew: true, sheetType: sheetType.value }) }
function openEdit(row: any) { tabStore.addTab(`inventory-${sheetType.value}`, `${isInbound ? '入库' : '出库'}单 - 查看`, { sheetId: row.id, sheetType: sheetType.value, readonly: true }) }

onMounted(() => { const d = new Date(); dateRange.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; loadData() })
</script>

<style scoped>
.page-container { padding: var(--space-6); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.page-header h1 { margin: 0; font-size: var(--font-size-h3); font-weight: var(--font-weight-600); }
.filter-bar { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
</style>
