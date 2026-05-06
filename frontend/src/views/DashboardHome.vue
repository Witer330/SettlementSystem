<template>
  <div class="dashboard-home">
    <div class="welcome-section">
      <h1 class="text-display">欢迎使用结算系统</h1>
      <p class="text-h3-light">工资核算 · 进销存 · 一体化管理</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">员工总数</span>
          <el-icon class="stat-icon"><User /></el-icon>
        </div>
        <div class="stat-value">128</div>
        <div class="stat-trend positive">
          <el-icon><TrendCharts /></el-icon>
          <span>较上月 +5</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">本月报工</span>
          <el-icon class="stat-icon"><Document /></el-icon>
        </div>
        <div class="stat-value">2,456</div>
        <div class="stat-trend positive">
          <el-icon><TrendCharts /></el-icon>
          <span>较上月 +12%</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">本月工资</span>
          <el-icon class="stat-icon"><Money /></el-icon>
        </div>
        <div class="stat-value">¥156,780</div>
        <div class="stat-trend positive">
          <el-icon><TrendCharts /></el-icon>
          <span>较上月 +8%</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">库存预警</span>
          <el-icon class="stat-icon warning"><Warning /></el-icon>
        </div>
        <div class="stat-value">3</div>
        <div class="stat-trend negative">
          <el-icon><Top /></el-icon>
          <span>需要及时处理</span>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <h2 class="text-h3">快速操作</h2>
      <div class="actions-grid">
        <el-button class="action-card" @click="$router.push('/salary/production-records')">
          <el-icon class="action-icon"><Edit /></el-icon>
          <span>生产报工</span>
        </el-button>

        <el-button class="action-card" @click="$router.push('/salary/salary-calculation')">
          <el-icon class="action-icon"><Operation /></el-icon>
          <span>工资计算</span>
        </el-button>

        <el-button class="action-card" @click="$router.push('/inventory/materials')">
          <el-icon class="action-icon"><Box /></el-icon>
          <span>物料管理</span>
        </el-button>

        <el-button class="action-card" @click="$router.push('/inventory/inventory-query')">
          <el-icon class="action-icon"><Search /></el-icon>
          <span>库存查询</span>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  User,
  Document,
  Money,
  Warning,
  TrendCharts,
  Top,
  Edit,
  Operation,
  Box,
  Search
} from '@element-plus/icons-vue'
</script>

<style scoped>
.dashboard-home {
  padding: 0;
}

.welcome-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #ff6b6b 100%);
  padding: var(--space-14) var(--space-8);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-8);
  text-align: center;
  color: var(--color-white);
}

.welcome-section h1 {
  font-weight: var(--font-weight-700);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-display);
  margin-bottom: var(--space-4);
}

.welcome-section p {
  font-weight: var(--font-weight-340);
  line-height: var(--line-subheading);
  letter-spacing: var(--letter-subheading);
  opacity: 0.9;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.stat-card {
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.stat-label {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-450);
  letter-spacing: var(--letter-body);
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.stat-icon {
  width: 24px;
  height: 24px;
  color: var(--el-text-color-secondary);
}

.stat-icon.warning {
  color: var(--color-warning);
}

.stat-value {
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-700);
  line-height: var(--line-heading);
  letter-spacing: var(--letter-heading);
  color: var(--color-black);
  margin-bottom: var(--space-3);
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-330);
}

.stat-trend.positive {
  color: var(--color-success);
}

.stat-trend.negative {
  color: var(--color-warning);
}

/* Quick Actions */
.quick-actions {
  margin-top: var(--space-8);
}

.quick-actions h2 {
  font-weight: var(--font-weight-450);
  line-height: var(--line-subheading);
  letter-spacing: var(--letter-subheading);
  margin-bottom: var(--space-4);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.action-card {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 140px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--el-border-color);
}

.action-card:hover {
  box-shadow: var(--shadow-md);
  background-color: var(--glass-dark);
}

.action-icon {
  width: 40px;
  height: 40px;
  color: var(--el-color-primary);
}

.action-card span {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-330);
  letter-spacing: var(--letter-body);
}

/* Responsive */
@media (max-width: 768px) {
  .welcome-section {
    padding: var(--space-10) var(--space-6);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
