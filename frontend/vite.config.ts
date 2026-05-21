import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy) => {
          // 替换 http-proxy-middleware 默认的 error 日志，避免打印冗长的 AggregateError
          proxy.on('error', (_err, req, res) => {
            const target = (proxy as any).options?.target || 'http://localhost:3000'

            console.warn(`[Proxy] 后端服务未启动 (${target}) — ${req.method} ${req.url}`)

            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
            }
            res.end(JSON.stringify({
              code: 502,
              message: `后端服务未启动 (${target})`,
              data: null
            }))
          })
        }
      }
    }
  }
})
