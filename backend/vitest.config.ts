import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    // 在所有测试文件加载前设置环境变量（优先级高于 .env）
    env: {
      DATABASE_URL: 'file:./test-settlement.db',
      JWT_SECRET: 'test-secret-key',
      NODE_ENV: 'test'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
