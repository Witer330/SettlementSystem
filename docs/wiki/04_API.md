# 04. API 约定与路由清单（/api/v1）

## 1. 基本约定

- Base Path：`/api/v1`
- 通用响应：`{ code, message, data }`
- 成功判定：`code === 0`
- Token：`Authorization: Bearer <jwt>`

前端会对所有响应进行统一解包与错误处理（[request.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/api/request.ts)）。

## 2. 路由挂载点（入口聚合）

入口文件：[backend/src/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/index.ts#L46-L57)

- `/api/v1/auth` → [auth.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/auth.routes.ts)
- `/api/v1/employees` → [employee.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/employee.routes.ts)
- `/api/v1/salary` → [salary.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/salary.routes.ts)
- `/api/v1/specs` → [spec.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/spec.routes.ts)
- `/api/v1/daily-records` → [dailyPiece.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/dailyPiece.routes.ts)
- `/api/v1/products` → [product.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/product.routes.ts)
- `/api/v1/departments` → [department.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/department.routes.ts)
- `/api/v1/job-types` → [jobType.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/jobType.routes.ts)
- `/api/v1/settings` → [setting.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/setting.routes.ts)
- `/api/v1/materials` → [material.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/material.routes.ts)
- `/api/v1/sales-orders` → [salesOrder.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/salesOrder.routes.ts)
- `/api/v1/bom` → [bom.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/bom.routes.ts)

## 3. 认证与用户（/auth）

路由文件：[auth.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/auth.routes.ts)

- `POST /api/v1/auth/login`：登录（公开）
- `POST /api/v1/auth/logout`：登出（需 token）
- `GET /api/v1/auth/profile`：当前用户信息（需 token）
- `POST /api/v1/auth/change-password`：修改密码（需 token）
- `POST /api/v1/auth/init-admin`：初始化管理员（公开）
- 用户管理（需 token）
  - `GET /api/v1/auth/users`
  - `POST /api/v1/auth/users`
  - `PUT /api/v1/auth/users/:id`
  - `DELETE /api/v1/auth/users/:id`

## 4. 员工（/employees）

路由文件：[employee.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/employee.routes.ts)

该路由组全量鉴权：`router.use(authenticate)`（见 [employee.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/employee.routes.ts#L7-L9)）。

- `GET /api/v1/employees/next-code`
- `GET /api/v1/employees`
- `GET /api/v1/employees/:id`
- `POST /api/v1/employees`
- `PUT /api/v1/employees/:id`
- `DELETE /api/v1/employees/:id`

## 5. 工资（/salary）

路由文件：[salary.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/salary.routes.ts)

该路由组全量鉴权：`router.use(authenticate)`（见 [salary.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/salary.routes.ts#L7-L9)）。

- `POST /api/v1/salary/calculate/:period`：计算工资并创建工资单
- `GET /api/v1/salary/bills`：工资单列表
- `GET /api/v1/salary/bills/:id`：工资单详情
- `PUT /api/v1/salary/bills/:id/approve`：审核工资单

## 6. 产品与基础资料

### 6.1 产品（/products）

路由文件：[product.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/product.routes.ts)

- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `POST /api/v1/products`
- `PUT /api/v1/products/:id`
- `DELETE /api/v1/products/:id`

### 6.2 部门（/departments）

路由文件：[department.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/department.routes.ts)

- `GET /api/v1/departments`
- `GET /api/v1/departments/:id`
- `POST /api/v1/departments`
- `PUT /api/v1/departments/:id`
- `DELETE /api/v1/departments/:id`

### 6.3 工种（/job-types）

路由文件：[jobType.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/jobType.routes.ts)

- `GET /api/v1/job-types/next-code`
- `GET /api/v1/job-types`
- `GET /api/v1/job-types/:id`
- `POST /api/v1/job-types`
- `PUT /api/v1/job-types/:id`
- `DELETE /api/v1/job-types/:id`

## 7. 规格计件（/specs, /daily-records）

### 7.1 产品规格（/specs）

路由文件：[spec.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/spec.routes.ts)

- `POST /api/v1/specs`
- `GET /api/v1/specs`
- `GET /api/v1/specs/:id`
- `PUT /api/v1/specs/:id`
- `DELETE /api/v1/specs/:id`
- `POST /api/v1/specs/:id/recalculate`

### 7.2 每日计件记录（/daily-records）

路由文件：[dailyPiece.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/dailyPiece.routes.ts)

- `POST /api/v1/daily-records`
- `GET /api/v1/daily-records`
- `GET /api/v1/daily-records/:id`
- `PUT /api/v1/daily-records/:id`
- `DELETE /api/v1/daily-records/:id`
- `GET /api/v1/daily-records/summary/:employeeId/:period`

## 8. 进销存（/materials, /sales-orders, /bom）

### 8.1 物料（/materials）

路由文件：[material.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/material.routes.ts)

- `GET /api/v1/materials`
- `GET /api/v1/materials/:id`
- `POST /api/v1/materials`
- `PUT /api/v1/materials/:id`
- `DELETE /api/v1/materials/:id`

### 8.2 销售单（/sales-orders）

路由文件：[salesOrder.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/salesOrder.routes.ts)

- `GET /api/v1/sales-orders`
- `GET /api/v1/sales-orders/:id`
- `POST /api/v1/sales-orders`
- `PUT /api/v1/sales-orders/:id`
- `DELETE /api/v1/sales-orders/:id`
- `PATCH /api/v1/sales-orders/:id/status`
- `GET /api/v1/sales-orders/:id/material-requirements`

### 8.3 BOM（/bom）

路由文件：[bom.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/bom.routes.ts)

- `GET /api/v1/bom/product/:productId`
- `POST /api/v1/bom/product/:productId`（整体替换保存）
- `POST /api/v1/bom/product/:productId/item`（新增单项）
- `DELETE /api/v1/bom/:id`

## 9. 系统设置（/settings）

路由文件：[setting.routes.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/backend/src/routes/setting.routes.ts)

- `GET /api/v1/settings`
- `GET /api/v1/settings/:key`
- `PUT /api/v1/settings/:key`
- `POST /api/v1/settings/batch`

