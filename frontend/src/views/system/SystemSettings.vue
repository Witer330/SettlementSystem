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
            <el-form-item label="默认时薪">
              <el-input-number v-model="basicSettings.defaultHourlyRate" :precision="2" :step="0.01" style="width: 200px" />
              <span class="unit">元/小时</span>
            </el-form-item>
            <el-form-item label="数据备份间隔（天）">
              <el-input-number v-model="basicSettings.backupInterval" :min="1" :max="30" style="width: 200px" />
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
            <el-button type="primary" :icon="Download" :loading="backupLoading" @click="handleBackup">
              创建备份
            </el-button>
            <p class="section-desc">
              系统会自动按照设定的间隔进行备份，您也可以手动创建备份。
            </p>
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
                  <el-button link type="primary" :icon="Download" @click="handleDownloadBackup(row)">
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
            <el-descriptions-item label="数据库版本">{{ systemInfo.dbVersion }}</el-descriptions-item>
            <el-descriptions-item label="运行环境">{{ systemInfo.env }}</el-descriptions-item>
            <el-descriptions-item label="Node.js 版本">{{ systemInfo.nodeVersion }}</el-descriptions-item>
            <el-descriptions-item label="运行时间">{{ systemInfo.uptime }}</el-descriptions-item>
            <el-descriptions-item label="内存使用">{{ systemInfo.memory }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download, Delete } from '@element-plus/icons-vue';

const activeTab = ref('basic');
const saving = ref(false);
const backupLoading = ref(false);

const basicSettings = reactive({
  systemName: '结算系统',
  companyName: '',
  defaultHourlyRate: 0,
  backupInterval: 7
});

const backupList = ref([
  { filename: 'settlement_20260410.db', size: 1024000, createdAt: '2026-04-10 10:30:00' },
  { filename: 'settlement_20260409.db', size: 1012000, createdAt: '2026-04-09 10:30:00' }
]);

const systemInfo = reactive({
  version: '1.0.0',
  dbVersion: '1',
  env: 'development',
  nodeVersion: '18.17.0',
  uptime: '2天 5小时',
  memory: '256MB / 512MB'
});

const saveBasicSettings = async () => {
  try {
    saving.value = true;
    // TODO: 调用API保存设置
    await new Promise(resolve => setTimeout(resolve, 1000));
    ElMessage.success('设置保存成功');
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败');
  } finally {
    saving.value = false;
  }
};

const handleBackup = async () => {
  try {
    backupLoading.value = true;
    // TODO: 调用API创建备份
    await new Promise(resolve => setTimeout(resolve, 1000));
    ElMessage.success('备份创建成功');
  } catch (error: any) {
    ElMessage.error(error.message || '备份创建失败');
  } finally {
    backupLoading.value = false;
  }
};

const handleDownloadBackup = (row: any) => {
  ElMessage.success(`开始下载: ${row.filename}`);
  // TODO: 实现下载逻辑
};

const handleDeleteBackup = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除备份"${row.filename}"吗？`,
      '确认删除',
      {
        type: 'warning'
      }
    );
    // TODO: 调用API删除备份
    ElMessage.success('删除成功');
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败');
    }
  }
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

onMounted(() => {
  // TODO: 加载设置
});
</script>

<style scoped>
.system-settings {
  padding: var(--spacing-6);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
}

.header-content {
  flex: 1;
}

.page-title {
  margin: 0;
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-700);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.page-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.settings-tabs {
  margin-top: var(--spacing-4);
}

.setting-card {
  margin-bottom: var(--spacing-6);
}

.section-title {
  margin: 0 0 var(--spacing-4) 0;
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-600);
}

.section-desc {
  margin: var(--spacing-2) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.unit {
  margin-left: var(--spacing-2);
  color: var(--color-text-secondary);
}
</style>
