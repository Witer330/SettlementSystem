# 07. 运行手册（开发/生产）与排障

## 1. 开发环境运行

### 1.1 安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 1.2 初始化数据库（开发）

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 1.3 启动后端

```bash
cd backend
npm run dev
```

后端入口为 [backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts)，端口由 `PORT` 环境变量控制（默认 3000）。

### 1.4 启动前端

```bash
cd frontend
npm run dev
```

Vite 开发服务器默认端口 5173（见 [frontend/package.json](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/package.json#L6-L9)）。

### 1.5 端口与代理对齐（重要）

当前仓库存在“默认端口”不一致：

- 后端默认 3000（[backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts#L12)）
- 前端 Vite 代理默认转发到 4000（[vite.config.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/vite.config.ts#L12-L18)）
- 后端 `.env.example` 也使用 4000（[backend/.env.example](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/.env.example#L4)）

建议二选一（保持前后端一致即可）：

- 方案 A：后端使用 4000（推荐与当前 Vite 配置一致）
  - 在 `backend/.env` 设置 `PORT=4000`
- 方案 B：前端代理改到 3000
  - 修改 [vite.config.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/vite.config.ts#L12-L18) 的 target

## 2. 生产构建与运行

### 2.1 构建产物

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

### 2.2 后端生产运行（开发者本地）

```bash
cd backend
npm start
```

注意：后端在生产模式下会尝试托管 `frontend/dist`（[backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts#L71-L76)），因此需要确保前端已构建。

## 3. Windows 安装包部署

详见 [06_Deploy.md](file:///c:/Users/witer/Documents/pro/SettlementSystem/docs/wiki/06_Deploy.md)。

高层流程：

1. 运行安装包安装应用
2. 首次运行执行 [deploy/first-run.bat](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/first-run.bat)（Prisma generate + migrate deploy）
3. 通过托盘脚本 [deploy/tray.ps1](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/tray.ps1) 启动后端服务并打开浏览器

## 4. 常见问题排查

### 4.1 前端接口 404 或网络错误

- 检查后端是否启动、端口是否与前端代理一致（见“1.5 端口与代理对齐”）
- 若设置了 `VITE_API_BASE`，确保其与后端地址一致（[frontend/.env.example](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/.env.example)）

### 4.2 401 未认证/频繁跳转登录

- 前端对 401 会清理 token 并强制跳转 `/login`（[request.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/api/request.ts#L38-L49)）
- 检查：token 是否被写入 `localStorage`；后端 `JWT_SECRET` 是否变更导致旧 token 失效

### 4.3 Prisma 报错：Client 未生成/迁移失败

- 开发环境：
  - `npx prisma generate`
  - `npx prisma migrate dev`
- 生产环境：
  - `npx prisma migrate deploy`
  - 安装包模式使用 [first-run.bat](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/first-run.bat)

### 4.4 SPA 刷新后 404（生产）

- 后端做了 SPA fallback：`app.get('{*path}', ...)`（[backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts#L74-L76)）
- 若仍出现 404，检查 `frontend/dist` 是否在后端静态目录期望位置（构建/复制是否正确）

