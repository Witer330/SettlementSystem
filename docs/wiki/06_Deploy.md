# 06. Windows 安装包与托盘部署（deploy）

## 1. 目标形态

部署后目录（由构建脚本组装，实际路径由安装包决定）包含：

- `frontend/dist/`：前端静态资源
- `backend/dist/`：后端编译产物（Node + Express）
- `backend/node_modules/`：生产依赖（包含 prisma CLI）
- `backend/prisma/`：schema + migrations + data 目录
- `node/`：内置 Node 便携版（node.exe）
- `tray.ps1`：托盘程序，控制后端启停并写入 PID
- `start.bat` / `stop.bat` / `first-run.bat`：简化操作脚本
- `logs/`：后端 stdout/stderr 日志

## 2. 构建安装包（开发者侧）

构建脚本：[deploy/build.js](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/build.js)

核心流程（按脚本顺序）：

- 构建前端：`frontend npm install && npm run build`
- 构建后端：`backend npm install && npm run build`
- 组装输出目录：复制 `frontend/dist` 与 `backend/dist`
- 打包生产依赖：
  - 基于 `backend/package.json` 的 `dependencies`
  - 额外引入 `prisma` CLI（用于 `generate` 与 `migrate deploy`）
- 生成 Prisma Client：运行 `prisma generate`
- 下载并缓存 Node 便携版：脚本内置 Node 版本变量 `NODE_VERSION`
- 生成生产 `.env`：写入 `backend/.env`（包含 `PORT=4000`, `NODE_ENV=production`）
- 调用 Inno Setup 编译：执行 `ISCC.exe` 编译 [installer.iss](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/installer.iss)

产物位置（脚本约定）：`dist/SettlementSystem-<version>-Setup.exe`

## 3. 首次运行初始化（用户侧/装机后）

初始化脚本：[deploy/first-run.bat](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/first-run.bat)

- `prisma generate`
- `prisma migrate deploy`

对应数据库文件（生产脚本约定）：`backend/prisma/data/settlement.db`（由安装包生成 `.env` 决定）

## 4. 启动与托盘

### 4.1 托盘程序（推荐）

托盘脚本：[deploy/tray.ps1](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/tray.ps1)

- `Start-Server`：用内置 `node\node.exe` 启动 `backend/dist/index.js`，并写 `server.pid`
- 日志：
  - stdout：`logs/server.log`
  - stderr：`logs/error.log`
- 菜单：启动/停止服务、打开浏览器、查看日志、退出

### 4.2 bat 启动/停止

- 启动：[deploy/start.bat](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/start.bat)（直接执行后端）
- 停止：[deploy/stop.bat](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/stop.bat)（依赖 `server.pid`；通常由托盘写入）

## 5. 端口约定

- 生产侧：构建脚本写入 `.env` 中 `PORT=4000`（[build.js](file:///c:/Users/witer/Documents/pro/SettlementSystem/deploy/build.js#L246-L254)）
- 前端生产侧：通常由后端静态托管同源访问 `/api/v1`，不需要额外代理配置

