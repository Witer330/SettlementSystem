#!/usr/bin/env node

/**
 * 后端服务健康检查脚本
 * 用途：检查后端服务是否正常运行，数据库连接是否正常
 * 使用：node scripts/health-check.js
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');

const PORT = process.env.PORT || 3000;
const HEALTH_URL = `http://localhost:${PORT}/health`;

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 检查 HTTP 端点
async function checkHttpEndpoint() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ success: response.code === 0, data: response });
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });
  });
}

// 检查数据库连接
async function checkDatabaseConnection() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return { success: true, message: 'Database connection OK' };
  } catch (err) {
    await prisma.$disconnect();
    return { success: false, error: err.message };
  }
}

// 主检查函数
async function runHealthCheck() {
  console.log('=== 后端服务健康检查 ===\n');

  // 1. HTTP 端点检查
  log('yellow', '1. 检查 HTTP 端点...');
  const httpCheck = await checkHttpEndpoint();
  if (httpCheck.success) {
    log('green', '   ✓ HTTP 端点正常');
  } else {
    log('red', `   ✗ HTTP 端点异常: ${httpCheck.error}`);
  }

  // 2. 数据库连接检查
  log('yellow', '2. 检查数据库连接...');
  const dbCheck = await checkDatabaseConnection();
  if (dbCheck.success) {
    log('green', '   ✓ 数据库连接正常');
  } else {
    log('red', `   ✗ 数据库连接异常: ${dbCheck.error}`);
  }

  // 3. 综合结果
  console.log('\n=== 检查结果 ===');
  if (httpCheck.success && dbCheck.success) {
    log('green', '✓ 所有检查通过，后端服务运行正常');
    process.exit(0);
  } else {
    log('red', '✗ 部分检查失败，请检查后端服务');
    process.exit(1);
  }
}

runHealthCheck().catch(err => {
  log('red', `健康检查异常: ${err.message}`);
  process.exit(1);
});
