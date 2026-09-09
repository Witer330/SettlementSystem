<template>
  <!-- 备份策略 -->
  <el-card class="setting-card" shadow="never">
    <h3 class="section-title">备份策略</h3>
    <el-form :model="strategy" label-width="150px">
      <el-form-item label="自动备份间隔">
        <el-input-number v-model="strategy.backupInterval" :min="1" :max="30" style="width: 200px" />
        <span class="form-unit">天</span>
      </el-form-item>
      <el-form-item label="备份保留天数">
        <el-input-number v-model="strategy.backupRetainDays" :min="1" :max="365" style="width: 200px" />
        <span class="form-unit">天（超期自动删除）</span>
      </el-form-item>
    </el-form>
    <el-button type="primary" :loading="strategySaving" @click="saveStrategy">保存策略</el-button>
  </el-card>

  <!-- 手动操作 -->
  <el-card class="setting-card" shadow="never" style="margin-top:16px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <h3 class="section-title" style="margin-bottom:4px">手动备份</h3>
        <p class="section-desc">立即创建一份完整的数据库备份</p>
      </div>
      <el-button type="primary" :loading="creating" @click="handleCreateBackup">立即备份</el-button>
    </div>
  </el-card>

  <!-- 备份记录 -->
  <el-card class="setting-card" shadow="never" style="margin-top:16px">
    <h3 class="section-title">备份记录</h3>
    <el-table :data="backups" v-loading="loadingList" stripe style="width: 100%">
      <el-table-column label="文件名" prop="filename" min-width="260" />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatSize(row.size) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleRestore(row.filename)">恢复</el-button>
          <el-button link type="danger" @click="handleDelete(row.filename)">删除</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <span style="color: var(--color-text-muted)">暂无备份记录</span>
      </template>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { settingApi } from '@/api/setting'
import { listBackups, createBackup, restoreBackup, deleteBackup, type BackupInfo } from '@/api/backup'

// ── 策略 ──
const strategySaving = ref(false)
const strategy = reactive({
  backupInterval: 7,
  backupRetainDays: 30
})

const loadStrategy = async () => {
  try {
    const settings = await settingApi.getList('system')
    const map = Object.fromEntries(settings.map((s: any) => [s.key, s.value]))
    strategy.backupInterval = Number(map['system.backupInterval'] || '7')
    strategy.backupRetainDays = Number(map['system.backupRetainDays'] || '30')
  } catch {}
}

const saveStrategy = async () => {
  strategySaving.value = true
  try {
    await settingApi.batchUpdate([
      { key: 'system.backupInterval', value: String(strategy.backupInterval), type: 'number', category: 'system', remark: '数据备份间隔（天）' },
      { key: 'system.backupRetainDays', value: String(strategy.backupRetainDays), type: 'number', category: 'system', remark: '备份保留天数' }
    ])
    ElMessage.success('备份策略已保存')
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    strategySaving.value = false
  }
}

// ── 手动备份 ──
const creating = ref(false)

const handleCreateBackup = async () => {
  creating.value = true
  try {
    await createBackup()
    ElMessage.success('备份创建成功')
    loadBackups()
  } catch (e: any) {
    ElMessage.error(e.message || '备份失败')
  } finally {
    creating.value = false
  }
}

// ── 备份列表 ──
const loadingList = ref(false)
const backups = ref<BackupInfo[]>([])

const loadBackups = async () => {
  loadingList.value = true
  try {
    backups.value = await listBackups()
  } catch {
    backups.value = []
  } finally {
    loadingList.value = false
  }
}

const handleRestore = async (filename: string) => {
  try {
    await ElMessageBox.confirm(
      `恢复备份将用「${filename}」替换当前数据库，恢复后需重启后端服务。此操作不可撤销，是否继续？`,
      '确认恢复',
      { confirmButtonText: '确认恢复', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  try {
    await restoreBackup(filename)
    ElMessage.success('备份已恢复，请重启后端服务以生效')
    loadBackups()
  } catch (e: any) {
    ElMessage.error(e.message || '恢复失败')
  }
}

const handleDelete = async (filename: string) => {
  try {
    await ElMessageBox.confirm(
      `确定删除备份「${filename}」？此操作不可撤销。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  try {
    await deleteBackup(filename)
    ElMessage.success('备份已删除')
    loadBackups()
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

// ── 工具函数 ──
const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const formatTime = (iso: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

onMounted(() => {
  loadStrategy()
  loadBackups()
})
</script>

<style scoped>
.setting-card {
  margin-bottom: 0;
}
.section-title {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-600);
}
.section-desc {
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.form-unit {
  margin-left: 8px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
</style>
