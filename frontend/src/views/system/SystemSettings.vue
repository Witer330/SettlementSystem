<template>
  <div class="system-settings">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">系统设置</h1>
        <p class="page-description">配置系统参数和备份策略</p>
      </div>
    </div>

    <!-- Settings Tabs -->
    <el-tabs v-model="activeTab" class="settings-tabs">
      <!-- 外观设置 -->
      <el-tab-pane label="外观设置" name="appearance">
        <el-card class="setting-card" shadow="never">
          <h3 class="section-title">主题选择</h3>
          <p class="section-desc">选择系统的视觉风格，更改将立即生效。</p>

          <div class="theme-grid">
            <div
              v-for="theme in availableThemes"
              :key="theme.id"
              class="theme-card"
              :class="{ active: currentThemeId === theme.id }"
              @click="selectTheme(theme.id)"
            >
              <div class="theme-preview">
                <div class="preview-swatch" :style="{ background: theme.colors.primary }" />
                <div
                  class="preview-canvas"
                  :style="{ background: theme.colors.bgCanvas }"
                >
                  <div
                    class="preview-surface"
                    :style="{
                      background: theme.colors.bgSurface,
                      border: '1px solid ' + theme.colors.border
                    }"
                  />
                </div>
              </div>
              <div class="theme-info">
                <span class="theme-name">{{ theme.name }}</span>
                <span class="theme-desc">{{ theme.description }}</span>
              </div>
              <el-icon v-if="currentThemeId === theme.id" class="theme-check">
                <Check />
              </el-icon>
            </div>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 基础设置 -->
      <el-tab-pane label="基础设置" name="basic">
        <el-card class="setting-card" shadow="never">
          <el-form :model="basicSettings" label-width="150px">
            <el-form-item label="系统名称">
              <el-input v-model="basicSettings.systemName" />
            </el-form-item>
            <el-form-item label="公司名称">
              <el-input v-model="basicSettings.companyName" />
            </el-form-item>
            <el-form-item label="数据备份间隔（天））">
              <el-input-number
                v-model="basicSettings.backupInterval"
                :min="1"
                :max="30"
                style="width: 200px"
              />
            </el-form-item>
          </el-form>
          <el-button type="primary" :loading="saving" @click="saveBasicSettings">
            保存设置
          </el-button>
        </el-card>
      </el-tab-pane>

      <!-- 数据备份 -->
      <el-tab-pane label="数据备份" name="backup">
        <el-card class="setting-card" shadow="never">
          <div class="backup-section">
            <h3 class="section-title">立即备份</h3>
            <el-button
              type="primary"
              :icon="Download"
              :loading="backupLoading"
              @click="handleBackup"
            >
              创建备份
            </el-button>
            <p class="section-desc">系统会自动按照设定的间隔进行备份，您也可以手动创建备份。</p>
          </div>

          <el-divider />

          <div class="backup-section">
            <h3 class="section-title">备份历史</h3>
            <el-table :data="backupList" stripe style="width: 100%">
              <el-table-column prop="filename" label="备份文件" />
              <el-table-column prop="size" label="文件大小" width="120">
                <template #default="{ row }">
                  {{ formatSize(row.size) }}
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="创建时间" width="180" />
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button
                    link
                    type="primary"
                    :icon="Download"
                    @click="handleDownloadBackup(row)"
                  >
                    下载
                  </el-button>
                  <el-button link type="danger" :icon="Delete" @click="handleDeleteBackup(row)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 系统信息 -->
      <el-tab-pane label="系统信息" name="info">
        <el-card class="setting-card" shadow="never">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="系统版本">{{ systemInfo.version }}</el-descriptions-item>
            <el-descriptions-item label="数据库版本">{{
              systemInfo.dbVersion
            }}</el-descriptions-item>
            <el-descriptions-item label="运行环境">{{ systemInfo.env }}</el-descriptions-item>
            <el-descriptions-item label="Node.js 版本">{{
              systemInfo.nodeVersion
            }}</el-descriptions-item>
            <el-descriptions-item label="运行时间">{{ systemInfo.uptime }}</el-descriptions-item>
            <el-descriptions-item label="内存使用">{{ systemInfo.memory }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Delete, Check } from '@element-plus/icons-vue'
import { useThemeStore } from '@/stores/theme'

const activeTab = ref('appearance')

// Theme
const themeStore = useThemeStore()
const availableThemes = themeStore.availableThemes
const currentThemeId = computed(() => themeStore.currentThemeId)

const selectTheme = async (themeId: string) => {
  await themeStore.setTheme(themeId)
}
const saving = ref(false)
const backupLoading = ref(false)

const basicSettings = reactive({
  systemName: '结算系统',
  companyName: '',
  backupInterval: 7
})

const backupList = ref([
  { filename: 'settlement_20260410.db', size: 1024000, createdAt: '2026-04-10 10:30:00' },
  { filename: 'settlement_20260409.db', size: 1012000, createdAt: '2026-04-09 10:30:00' }
])

const systemInfo = reactive({
  version: '1.0.0',
  dbVersion: '1',
  env: 'development',
  nodeVersion: '18.17.0',
  uptime: '2天 5小时',
  memory: '256MB / 512MB'
})

const saveBasicSettings = async () => {
  try {
    saving.value = true
    // TODO: 调用API保存设置
    await new Promise((resolve) => setTimeout(resolve, 1000))
    ElMessage.success('设置保存成功')
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleBackup = async () => {
  try {
    backupLoading.value = true
    // TODO: 调用API创建备份
    await new Promise((resolve) => setTimeout(resolve, 1000))
    ElMessage.success('备份创建成功')
  } catch (error: any) {
    ElMessage.error(error.message || '备份创建失败')
  } finally {
    backupLoading.value = false
  }
}

const handleDownloadBackup = (row: any) => {
  ElMessage.success(`开始下载: ${row.filename}`)
  // TODO: 实现下载逻辑
}

const handleDeleteBackup = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要删除备份"${row.filename}"吗？`, '确认删除', {
      type: 'warning'
    })
    // TODO: 调用API删除备份
    ElMessage.success('删除成功')
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

onMounted(() => {
  // TODO: 加载设置
})
</script>

<style scoped>
.system-settings {
  padding: var(--space-6);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.header-content {
  flex: 1;
}

.page-title {
  margin: 0;
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-700);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.page-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.settings-tabs {
  margin-top: var(--space-4);
}

.setting-card {
  margin-bottom: var(--space-6);
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

.backup-section {
  margin-bottom: var(--space-6);
}

/* Theme Grid */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-6);
  margin-top: var(--space-6);
}

.theme-card {
  position: relative;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-base);
}

.theme-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.theme-card.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(83, 58, 253, 0.15);
}

.theme-preview {
  height: 120px;
  display: flex;
  flex-direction: column;
}

.preview-swatch {
  height: 24px;
}

.preview-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.preview-surface {
  width: 80%;
  height: 40px;
  border-radius: var(--radius-md);
}

.theme-info {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.theme-name {
  font-weight: var(--font-weight-600);
  font-size: var(--font-size-body);
}

.theme-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.theme-check {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  color: var(--color-primary);
  font-size: 20px;
}
</style>
