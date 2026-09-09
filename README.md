# 结算系统 (SettlementSystem)

小型工贸企业结算系统 - 工资核算 + 进销存一体化管理

## 项目结构

```
SettlementSystem/
├── backend/                    # 后端服务 (Node.js + Express + Prisma)
│   ├── src/                   # 源代码
│   ├── prisma/                # 数据库配置和迁移
│   ├── data/                  # 数据目录（运行时生成）
│   └── package.json
├── frontend/                   # 前端应用 (Vue 3 + TypeScript + Element Plus)
│   ├── src/                   # 源代码
│   └── package.json
├── docs/                       # 项目文档
│   └── PLAN.md               # 开发规划
└── README.md                  # 本文件
```

## 技术栈

### 前端
- Vue 3
- TypeScript
- Element Plus
- Vue Router
- Pinia
- Axios

### 后端
- Node.js 18+
- Express
- Prisma ORM
- SQLite

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd frontend
npm install
```

### 初始化数据库

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 启动开发环境

```bash
# 终端1 - 启动后端
cd backend
npm run dev

# 终端2 - 启动前端
cd frontend
npm run dev
```

访问地址：
- 前端：http://localhost:5173
- 后端 API：http://localhost:3000
- Prisma Studio：http://localhost:5555 (运行 `npx prisma studio`)

### 构建生产版本

```bash
# 后端构建
cd backend
npm run build

# 前端构建
cd frontend
npm run build
```

## 开发命令

### 后端
```bash
npm run dev              # 开发模式
npm run build            # 构建
npm start               # 启动生产版本
npm run prisma:generate  # 生成 Prisma Client
npm run prisma:migrate   # 运行数据库迁移
npm run prisma:studio    # 打开 Prisma Studio
```

### 前端
```bash
npm run dev    # 开发模式
npm run build  # 构建
npm run preview  # 预览构建结果
```

## 环境变量

### 后端 (.env)
```bash
DATABASE_URL="file:./data/settlement.db"
JWT_SECRET="settlement-system-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
```

### 数据库

使用 SQLite，首次启动自动初始化，无需手动配置。

## 功能模块

- [x] 项目基础架构
- [ ] 用户认证与权限
- [ ] 工资核算模块
  - [ ] 员工管理
  - [ ] 产品管理
  - [ ] 工序管理
  - [ ] 生产报工
  - [ ] 工资计算
- [ ] 进销存模块
  - [ ] 供应商管理
  - [ ] 客户管理
  - [ ] 物料管理
  - [ ] 采购管理
  - [ ] 销售管理
  - [ ] 库存管理
- [ ] 系统设置
  - [ ] 用户管理
  - [ ] 部门管理
  - [ ] 系统配置

## 文档

详细开发规划请参阅：[docs/PLAN.md](docs/PLAN.md)

## 许可证

ISC
