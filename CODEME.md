# SettlementSystem Code Wiki（索引）

本文件面向开发者与自动化分析工具，用于快速理解仓库的代码结构、模块边界与关键约束。面向“如何使用产品”的内容请参阅 [README.md](file:///c:/Users/witer/Documents/pro/SettlementSystem/README.md)。

## 1. 代码总览

- 单体仓库，包含前端、后端与 Windows 安装包构建脚本：
  - 前端：Vue 3 + TypeScript + Vite + Element Plus（[frontend/](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend)）
  - 后端：Node.js + Express + Prisma（[backend/](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend)）
  - 部署：Inno Setup 安装包与托盘启动脚本（[deploy/](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy)）
- 核心数据流：浏览器 UI → 前端 API（axios）→ 后端 REST API（/api/v1）→ Prisma → SQLite（可切换 MySQL）
- 通用 API 返回结构：`{ code, message, data }`（前端在 [request.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/api/request.ts#L22-L34) 统一解包）

## 2. 模块边界

- Backend
  - 路由聚合与静态托管入口：[backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts)
  - 资源路由：`backend/src/routes/*.routes.ts`
  - 控制器：`backend/src/controllers/*.controller.ts`
  - 鉴权中间件：JWT Bearer（[auth.middleware.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/middleware/auth.middleware.ts)）
  - 认证服务：用户/密码/JWT（[auth.service.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/services/auth.service.ts)）
  - 数据模型：Prisma schema（[schema.prisma](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/prisma/schema.prisma)）
- Frontend
  - 入口：[frontend/src/main.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/main.ts)
  - 路由与登录守卫：[router/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/router/index.ts)
  - API 层：`frontend/src/api/*.ts` + 统一 axios 实例（[request.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/api/request.ts)）
  - 状态：Pinia（`frontend/src/stores/*`）
  - 页面：`frontend/src/views/*`

## 3. 关键约束/已知差异

- 开发端口在文档与配置中存在不一致：后端默认 `PORT=3000`（[backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts#L12)），但 Vite 代理默认指向 `http://localhost:4000`（[vite.config.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/vite.config.ts#L12-L18)）；应以实际 `.env` 为准并保持一致。
- `backend/src/index.ts` 在错误处理中打印 `err.stack`；生产环境如需更严格的日志策略，应通过配置/日志组件统一管理。

## 4. 完整 Wiki

完整的结构化 Wiki 位于 [docs/wiki/README.md](file:///c:/Users/witer/Documents/pro/SettlementSystem/docs/wiki/README.md)。

