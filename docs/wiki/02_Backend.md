# 02. 后端（backend）架构与关键逻辑

## 1. 技术栈与依赖

- 运行时：Node.js（后端 package 见 [backend/package.json](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/package.json)）
- Web 框架：Express 5
- 安全/通用中间件：helmet、cors
- 配置：dotenv（在 [backend/src/config/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/config/index.ts) 与 [backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts#L8-L9) 均调用）
- ORM：Prisma（[schema.prisma](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/prisma/schema.prisma)）
- 认证：jsonwebtoken + bcryptjs
- 校验：zod（依赖已引入，但当前控制器中尚未统一使用）

## 2. 入口与装配

入口文件： [backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts)

- 中间件：`helmet()`、`cors()`、`express.json()`、`express.urlencoded()`
- 健康检查：`GET /health`（无鉴权）
- API 基路径：`/api/v1/*`（按资源拆分挂载）
- 生产静态托管：`express.static(frontend/dist)` + SPA fallback（`app.get('{*path}', ...)`）
- 错误处理中间件：统一返回 `{code,message,data}`（注意：会 `console.error(err.stack)`）

## 3. 分层与目录职责

### 3.1 routes（路由层）

目录：`backend/src/routes/`

- 负责 HTTP path 与控制器函数的绑定
- 常见模式：
  - 某些模块 `router.use(authenticate)` 进行全局鉴权（如工资 [salary.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/salary.routes.ts#L7-L9)）
  - 某些模块当前未加鉴权（如规格 [spec.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/spec.routes.ts)），以代码现状为准

### 3.2 controllers（控制器层）

目录：`backend/src/controllers/`

- 负责请求参数解析、业务流程编排、返回统一结构
- 数据库访问：大多在控制器内直接创建 `new PrismaClient()` 并读写（目前未抽离成统一 data access/service 层）

### 3.3 services（服务层）

目录：`backend/src/services/`

当前主要集中在认证领域：

- [auth.service.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/services/auth.service.ts)：密码 hash/compare、JWT 生成、用户 CRUD 与分页查询

### 3.4 middleware（中间件）

- [auth.middleware.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/middleware/auth.middleware.ts)：JWT Bearer 鉴权与角色检查

## 4. 配置与环境变量

集中读取： [backend/src/config/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/config/index.ts)

- `PORT`：服务端口（默认 3000）
- `NODE_ENV`：环境（默认 development）
- `JWT_SECRET`、`JWT_EXPIRES_IN`：JWT 配置
- `DATABASE_URL`：Prisma datasource 连接串（默认 sqlite 文件路径）

示例文件： [backend/.env.example](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/.env.example)

## 5. 关键模块与函数

### 5.1 鉴权（Auth）

#### authenticate（JWT 校验）

- 文件：[auth.middleware.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/middleware/auth.middleware.ts#L11-L36)
- 输入：`Authorization: Bearer <token>`
- 输出：
  - 成功：写入 `req.userId`、`req.userRole` 并 `next()`
  - 失败：401 `{code:401,message:'认证令牌无效或已过期'}`

#### authController.login（登录）

- 文件：[auth.controller.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/controllers/auth.controller.ts#L6-L73)
- 流程：查用户 → bcrypt 校验 → 校验 status → 签发 JWT → 返回 `{token,user}`

#### authService.generateToken（签发 JWT）

- 文件：[auth.service.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/services/auth.service.ts#L17-L21)
- 使用配置：`config.jwt.secret` / `config.jwt.expiresIn`

### 5.2 工资核算（Salary）

路由：[salary.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/salary.routes.ts)

#### salaryController.calculateSalary（生成工资单）

- 文件：[salary.controller.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/controllers/salary.controller.ts#L7-L187)
- 入参：`POST /api/v1/salary/calculate/:period`，period 形如 `YYYY-MM`
- 核心逻辑：
  - 根据 `employeeId/employeeIds` 筛选员工，否则全量 active 员工
  - 若当期工资单已存在则跳过
  - 时薪员工：汇总 `WorkLog`（`hours * hourlyRate`）
  - 计件员工：遍历 `ProductionRecord`，单价通过 `getPieceRate` 分层回退
  - 创建 `SalaryBill` + 批量写入 `SalaryBillDetail`

#### salaryController.getPieceRate（计件单价回退链）

- 文件：[salary.controller.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/controllers/salary.controller.ts#L189-L224)
- 优先级：
  1. 员工 + 产品 + 工序的 `ProcessRate`
  2. 员工 + 工序（productId 为 null）的 `ProcessRate`
  3. `Process.defaultPrice`
  4. `Employee.pieceRate`
  5. 默认 0

### 5.3 产品规格计件（Spec / Daily Piece）

#### specController.calculateSpecPrice（规格定价核心）

- 文件：[spec.controller.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/controllers/spec.controller.ts#L208-L250)
- 公式：`unitPrice = basePrice * (1 + sum(coeff.value for matched))`，保留两位小数
- 系数来源：`SpecCoefficient`（按 `priority desc` 迭代匹配）
- 匹配策略：由 `matchCoefficient` 解析 `coeff.type` 与 `coeff.code`（[spec.controller.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/controllers/spec.controller.ts#L252-L294)）

#### createDailyRecord（每日计件记录创建）

- 文件：[dailyPiece.controller.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/controllers/dailyPiece.controller.ts#L6-L83)
- 行为：对每个 `specId` 查询 `ProductSpec + SpecPrice`，计算明细金额并汇总 `DailyPieceRecord.totalAmount`

### 5.4 BOM（物料清单）

- 文件：[bom.controller.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/controllers/bom.controller.ts)
- 典型接口：
  - `getBomByProduct`：按产品查 BOM 明细并 include material
  - `saveBom`：整体替换（先 deleteMany 再 createMany）

## 6. 错误处理与响应规范

- 业务错误：控制器多使用 `res.status(x).json({code,message,data:null})`
- 全局兜底：入口文件 error middleware（[backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts#L78-L86)）
- 前端处理：当 `code != 0` 或 HTTP 401 时统一拦截（见 [request.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/api/request.ts#L22-L51)）

