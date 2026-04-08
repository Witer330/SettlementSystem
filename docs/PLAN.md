# 小型工贸企业结算系统 - 开发规划

> **文档版本**：v1.0
> **创建日期**：2026-04-08
> **部署方式**：本地单机 + 安装包部署

---

## 一、项目概述

### 1.1 项目定位

- **目标用户**：小型工贸企业（10-100人规模）
- **部署方式**：本地单机服务器，预留局域网访问能力
- **核心价值**：工资核算 + 进销存一体化管理，降低管理成本

### 1.2 核心功能

- **工资核算模块**：计件工资管理、生产报工、工资计算与报表
- **进销存模块**：采购管理、销售管理、库存管理

---

## 二、技术栈

### 2.1 技术选型

| 层次 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | Vue 3 + TypeScript + Element Plus | 轻量级企业UI，组件丰富 |
| 后端 | Node.js 18+ + Express/Fastify | 与前端技术栈统一，开发效率高 |
| ORM | Prisma | SQLite/MySQL 无缝切换 |
| 认证 | jsonwebtoken + bcryptjs | JWT 认证 |
| 数据验证 | Zod | TypeScript Schema 验证 |
| 打包 | pkg + NSIS/Inno Setup | 后端打包为exe，前端为安装包 |

### 2.2 数据库方案

- **开发/单机部署**：SQLite（文件数据库，无需安装）
- **未来扩展**：MySQL（通过 Prisma 切换数据源）
- **迁移策略**：Prisma Migrate 自动处理

### 2.3 Prisma 配置示例

```prisma
// schema.prisma
datasource db {
  provider = "sqlite"  // 切换 MySQL：改为 "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// .env
# SQLite
DATABASE_URL="file:./data/settlement.db"

# MySQL（预留）
# DATABASE_URL="mysql://user:password@localhost:3306/settlement"
```

---

## 三、系统架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      客户端（浏览器）                      │
│                   Vue 3 + Element Plus                    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST API
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      后端服务                             │
│                   Node.js + Express                       │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐   │
│  │   认证中间件  │  │  业务服务层  │  │  数据访问层    │   │
│  └─────────────┘  └─────────────┘  └───────┬───────┘   │
└────────────────────────────────────────────────┼────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────┐
│                      数据层                               │
│                      SQLite                              │
│              （未来可切换至 MySQL）                        │
└─────────────────────────────────────────────────────────┘
```

### 3.2 模块划分

```
SettlementSystem/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── controllers/        # 控制器层
│   │   │   ├── auth.controller.ts
│   │   │   ├── salary.controller.ts
│   │   │   ├── inventory.controller.ts
│   │   │   └── system.controller.ts
│   │   ├── services/           # 业务服务层
│   │   │   ├── salary.service.ts
│   │   │   ├── inventory.service.ts
│   │   │   └── calculation.service.ts
│   │   ├── middleware/         # 中间件
│   │   │   ├── auth.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── models/             # 数据模型（Prisma Schema）
│   │   │   └── schema.prisma
│   │   ├── utils/              # 工具函数
│   │   │   ├── backup.ts
│   │   │   ├── migrate.ts
│   │   │   └── validator.ts
│   │   ├── routes/             # 路由定义
│   │   ├── config/             # 配置文件
│   │   │   └── index.ts
│   │   └── index.ts            # 入口文件
│   ├── prisma/                 # Prisma 配置
│   │   ├── schema.prisma
│   │   └── migrations/          # 数据库迁移
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── views/              # 页面组件
│   │   │   ├── Login.vue
│   │   │   ├── Dashboard.vue
│   │   │   ├── salary/         # 工资核算模块
│   │   │   │   ├── EmployeeList.vue
│   │   │   │   ├── ProductList.vue
│   │   │   │   ├── ProcessList.vue
│   │   │   │   ├── ProductionRecord.vue
│   │   │   │   ├── SalaryCalculation.vue
│   │   │   │   └── SalaryReport.vue
│   │   │   ├── inventory/      # 进销存模块
│   │   │   │   ├── SupplierList.vue
│   │   │   │   ├── CustomerList.vue
│   │   │   │   ├── MaterialList.vue
│   │   │   │   ├── PurchaseOrder.vue
│   │   │   │   ├── SalesOrder.vue
│   │   │   │   ├── InventoryQuery.vue
│   │   │   │   └── InventoryLog.vue
│   │   │   └── system/         # 系统设置
│   │   │       ├── UserManagement.vue
│   │   │       ├── DepartmentList.vue
│   │   │       └── SystemSettings.vue
│   │   ├── components/         # 公共组件
│   │   │   ├── Table.vue
│   │   │   ├── Form.vue
│   │   │   └── Modal.vue
│   │   ├── api/                # API 调用
│   │   │   ├── index.ts
│   │   │   ├── salary.ts
│   │   │   └── inventory.ts
│   │   ├── stores/             # 状态管理（Pinia）
│   │   │   ├── user.ts
│   │   │   └── app.ts
│   │   ├── router/             # 路由配置
│   │   │   └── index.ts
│   │   ├── utils/              # 工具函数
│   │   ├── types/              # TypeScript 类型定义
│   │   ├── App.vue
│   │   └── main.ts
│   ├── package.json
│   └── vite.config.ts
│
├── installer/                  # 安装包配置
│   ├── script.nsi              # NSIS 安装脚本
│   └── patch.nsi              # 补丁包脚本
│
├── data/                       # 数据目录（运行时创建）
│   ├── settlement.db           # SQLite 数据库
│   ├── backup/                 # 数据备份
│   └── logs/                   # 日志文件
│
└── docs/                       # 文档
    ├── PLAN.md                 # 本规划文档
    ├── API.md                  # API 文档
    └── DATABASE.md             # 数据库设计
```

---

## 四、核心功能模块

### 4.1 工资核算模块

#### 4.1.1 功能清单

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 员工管理 | 员工档案、工种、所属部门 | P0 |
| 产品管理 | 产品信息、BOM 配置 | P0 |
| 工序管理 | 工序定义、计价规则 | P0 |
| 生产报工 |.扫码/手动录入报工记录 | P0 |
| 工资计算 | 按工序/产品自动计算工资 | P0 |
| 工资审核 | 工资单审核与确认流程 | P1 |
| 工资报表 | 月度/个人/工序统计报表 | P1 |

#### 4.1.2 业务流程

```
生产报工 → 工资计算 → 审核 → 确认 → 生成工资单
    ↓
库存变动（扣减原材料）
```

#### 4.1.3 关键字段

**员工表 (employees)**
- id, name, code, department_id, job_type, hourly_rate, status

**产品表 (products)**
- id, name, code, category, specification, unit, status

**BOM 表 (bill_of_materials)**
- id, product_id, material_id, quantity

**工序表 (processes)**
- id, name, code, default_price, unit

**产品工序关联 (product_processes)**
- id, product_id, process_id, sequence

**工序计价表 (process_pricing)**
- id, employee_id, product_id, process_id, price

**生产报工记录 (production_records)**
- id, employee_id, product_id, process_id, quantity, date, status

**工资计算结果 (salary_calculations)**
- id, employee_id, period, amount, details

**工资单 (salary_bills)**
- id, employee_id, period, total_amount, status, approved_by, approved_at

---

### 4.2 进销存模块

#### 4.2.1 功能清单

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 供应商管理 | 供应商档案、联系方式 | P0 |
| 客户管理 | 客户档案、联系方式 | P0 |
| 物料管理 | 物料档案、条码、规格 | P0 |
| 采购管理 | 采购单、入库单、应付账款 | P0 |
| 销售管理 | 销售单、出库单、应收账款 | P0 |
| 库存查询 | 实时库存、库存流水 | P0 |
| 库存预警 | 低库存提醒、安全库存设置 | P1 |

#### 4.2.2 业务流程

```
采购流程：采购单 → 收货入库 → 库存增加 → 生成应付账款
销售流程：销售单 → 发货出库 → 库存减少 → 生成应收账款
```

#### 4.2.3 关键字段

**供应商表 (suppliers)**
- id, name, code, contact, phone, address, status

**客户表 (customers)**
- id, name, code, contact, phone, address, credit_limit, status

**物料表 (materials)**
- id, name, code, category, specification, unit, barcode, safe_stock, status

**采购单 (purchase_orders)**
- id, supplier_id, order_no, total_amount, status, created_at

**采购明细 (purchase_items)**
- id, order_id, material_id, quantity, price, received_quantity

**销售单 (sales_orders)**
- id, customer_id, order_no, total_amount, status, created_at

**销售明细 (sales_items)**
- id, order_id, material_id, quantity, price, shipped_quantity

**库存汇总 (inventory)**
- id, material_id, quantity, last_updated

**库存流水 (inventory_logs)**
- id, material_id, type, quantity, reference_type, reference_id, remark, created_at

---

### 4.3 系统设置模块

| 功能 | 说明 |
|------|------|
| 用户管理 | 系统用户、角色、权限 |
| 部门管理 | 部门/车间组织架构 |
| 系统参数 | 基础配置、备份策略 |

---

## 五、数据库设计

### 5.1 Prisma Schema 框架

```prisma
// prisma/schema.prisma

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ============ 系统基础 ============

model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String
  name      String
  role      String   // admin, manager, operator
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Department {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  code      String   @unique
  parentId  Int?
  status    String   @default("active")
  createdAt DateTime @default(now())
}

// ============ 工资核算 ============

model Employee {
  id           Int      @id @default(autoincrement())
  name         String
  code         String   @unique
  departmentId Int?
  jobType      String
  hourlyRate   Float    @default(0)
  status       String   @default("active")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  department   Department?   @relation(fields: [departmentId], references: [id])
  processRates ProcessRate[]
  productionRecords ProductionRecord[]
  salaryBills SalaryBill[]
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  code        String   @unique
  category    String
  specification String?
  unit        String
  status      String   @default("active")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  bomItems     BillOfMaterial[]
  productProcesses ProductProcess[]
  productionRecords ProductionRecord[]
}

model BillOfMaterial {
  id         Int      @id @default(autoincrement())
  productId  Int
  materialId Int
  quantity   Float
  createdAt  DateTime @default(now())

  product   Product @relation(fields: [productId], references: [id])
}

model Process {
  id           Int      @id @default(autoincrement())
  name         String
  code         String   @unique
  defaultPrice Float
  unit         String   @default("piece")
  status       String   @default("active")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  productProcesses ProductProcess[]
  processRates ProcessRate[]
  productionRecords ProductionRecord[]
}

model ProductProcess {
  id         Int      @id @default(autoincrement())
  productId  Int
  processId  Int
  sequence   Int
  createdAt  DateTime @default(now())

  product   Product @relation(fields: [productId], references: [id])
  process   Process @relation(fields: [processId], references: [id])
}

model ProcessRate {
  id         Int      @id @default(autoincrement())
  employeeId Int
  productId  Int?
  processId  Int
  price      Float
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  employee   Employee @relation(fields: [employeeId], references: [id])
  process    Process  @relation(fields: [processId], references: [id])
}

model ProductionRecord {
  id         Int      @id @default(autoincrement())
  employeeId Int
  productId  Int
  processId  Int
  quantity   Float
  date       DateTime
  status     String   @default("pending")
  remark     String?
  createdAt  DateTime @default(now())

  employee   Employee @relation(fields: [employeeId], references: [id])
  product    Product  @relation(fields: [productId], references: [id])
  process    Process  @relation(fields: [processId], references: [id])
}

model SalaryCalculation {
  id         Int      @id @default(autoincrement())
  employeeId Int
  period     String   // YYYY-MM
  amount     Float
  details    String?  // JSON
  createdAt  DateTime @default(now())
}

model SalaryBill {
  id          Int      @id @default(autoincrement())
  employeeId  Int
  period      String   // YYYY-MM
  totalAmount Float
    status     String   @default("pending")
  approvedBy  Int?
  approvedAt  DateTime?
  remark      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  employee    Employee @relation(fields: [employeeId], references: [id])
}

// ============ 进销存 ============

model Supplier {
  id        Int      @id @default(autoincrement())
  name      String
  code      String   @unique
  contact   String?
  phone     String?
  address   String?
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  purchaseOrders PurchaseOrder[]
}

model Customer {
  id           Int      @id @default(autoincrement())
  name         String
  code         String   @unique
  contact      String?
  phone        String?
  address      String?
  creditLimit  Float    @default(0)
  status       String   @default("active")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  salesOrders SalesOrder[]
}

model Material {
  id             Int      @id @default(autoincrement())
  name           String
  code           String   @unique
  category       String
  specification  String?
  unit           String
  barcode        String?
  safeStock      Float    @default(0)
  status         String   @default("active")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  bomItems        BillOfMaterial[]
  inventory       Inventory?
  inventoryLogs   InventoryLog[]
  purchaseItems   PurchaseItem[]
  salesItems      SalesItem[]
}

model PurchaseOrder {
  id         Int      @id @default(autoincrement())
  supplierId Int
  orderNo    String   @unique
  totalAmount Float
  status     String   @default("pending")
  remark     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  supplier   Supplier  @relation(fields: [supplierId], references: [id])
  items      PurchaseItem[]
}

model PurchaseItem {
  id               Int      @id @default(autoincrement())
  orderId          Int
  materialId       Int
  quantity         Float
  price            Float
  receivedQuantity Float    @default(0)
  createdAt        DateTime @default(now())

  order            PurchaseOrder @relation(fields: [orderId], references: [id])
  material         Material      @relation(fields: [materialId], references: [id])
}

model SalesOrder {
  id         Int      @id @default(autoincrement())
  customerId Int
  orderNo    String   @unique
  totalAmount Float
  status     String   @default("pending")
  remark     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  customer   Customer     @relation(fields: [customerId], references: [id])
  items      SalesItem[]
}

model SalesItem {
  id            Int      @id @default(autoincrement())
  orderId       Int
  materialId    Int
  quantity      Float
  price         Float
  shippedQuantity Float    @default(0)
  createdAt     DateTime @default(now())

  order         SalesOrder @relation(fields: [orderId], references: [id])
  material      Material   @relation(fields: [materialId], references: [id])
}

model Inventory {
  id           Int      @id @default(autoincrement())
  materialId   Int      @unique
  quantity     Float    @default(0)
  lastUpdated  DateTime @default(now())

  material     Material  @relation(fields: [materialId], references: [id])
}

model InventoryLog {
  id           Int      @id @default(autoincrement())
  materialId   Int
  type         String   // in, out, adjust
  quantity     Float
  referenceType String?
  referenceId  Int?
  remark       String?
  createdAt    DateTime @default(now())

  material     Material  @relation(fields: [materialId], references: [id])
}

// ============ 系统设置 ============

model Setting {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  value     String
  remark    String?
  updatedAt DateTime @updatedAt
}
```

---

## 六、开发阶段规划

### 6.1 阶段划分

| 阶段 | 内容 | 预计周期 |
|------|------|---------|
| Phase 1 | 基础架构搭建 | 1-2周 |
| Phase 2 | 工资核算模块 | 3-4周 |
| Phase 3 | 进销存模块 | 4-5周 |
| Phase 4 | 优化与测试 | 2周 |

### 6.2 Phase 1：基础架构搭建

#### 任务清单
- [ ] 前后端项目初始化
- [ ] Prisma + SQLite 数据库配置
- [ ] 数据库迁移脚本编写
- [ ] 用户认证中间件（JWT）
- [ ] 基础 UI 框架搭建（Vue + Element Plus）
- [ ] 前后端类型共享配置
- [ ] 开发环境热更新配置

#### 验收标准
- 可正常启动前后端服务
- 用户登录功能正常
- 数据库连接正常
- API 接口可正常调用

### 6.3 Phase 2：工资核算模块

#### 任务清单
- [ ] 员员档案管理（CRUD）
- [ ] 部门管理
- [ ] 产品管理
- [ ] 物料管理
- [ ] BOM 配置
- [ ] 工序定义
- [ ] 工序计价配置
- [ ] 产品工序关联
- [ ] 生产报工录入
- [ ] 生产报工批量导入
- [ ] 工资计算引擎
- [ ] 工资单生成
- [ ] 工资审核流程
- [ ] 工资报表（月度/个人）
- [ ] 报表导出（Excel/PDF）

#### 验收标准
- 可完整走通报工→计算→审核流程
- 工资计算结果准确
- 报表数据正确

### 6.4 Phase 3：进销存模块

#### 任务清单
- [ ] 供应商管理（CRUD）
- [ ] 客户管理（CRUD）
- [ ] 物料档案管理
- [ ] 采购单管理
- [ ] 采购入库
- [ ] 销售单管理
- [ ] 销售出库
- [ ] 库存实时查询
- [ ] 库存流水明细
- [ ] 库存预警配置
- [ ] 低库存提醒

#### 验收标准
- 采购流程完整（订单→入库→库存增加）
- 销售流程完整（订单→出库→库存减少）
- 库存数据准确

### 6.5 Phase 4：优化与测试

#### 任务清单
- [ ] 数据备份功能实现
- [ ] 数据恢复功能
- [ ] MySQL 迁移脚本准备
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 单元测试
- [ ] 集成测试
- [ ] 用户验收测试
- [ ] 安装包制作
- [ ] 使用文档编写

#### 验收标准
- 通过所有测试
- 安装包可正常安装运行
- 文档完整

---

## 七、部署方案

### 7.1 部署架构

```
┌────────────────────────────────────────┐
│         安装包 (SettlementSystem.exe)  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  前端资源 (dist/)               │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  后端服务 (node 嵌入)           │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  数据目录 (data/)               │  │
│  │    ├── settlement.db            │  │
│  │    ├── backup/                  │  │
│  │    └── logs/                    │  │
│  └──────────────────────────────────┘  │
│                                        │
│  启动：自动启动后端服务 → 打开浏览器  │
└────────────────────────────────────────┘
```

### 7.2 安装包制作

#### 使用工具
- **NSIS**：Windows 安装包制作
- **pkg**：Node.js 打包为可执行文件
- **Vite**：前端打包

#### 安装流程
1. 选择安装目录（默认：`C:\Program Files\SettlementSystem`）
2. 解压应用程序文件
3. 创建数据目录
4. 创建桌面快捷方式
5. 可选：注册 Windows 服务（开机自启）
6. 可选：添加到系统托盘

#### NSIS 脚本示例

```nsis
; installer/script.nsi

!define APPNAME "SettlementSystem"
!define VERSION "1.0.0"
!define PUBLISHER "Your Company"

Name "${APPNAME}"
OutFile "SettlementSystem-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES\${APPNAME}"
InstallDirRegKey HKLM "Software\${APPNAME}" "InstallLocation"

RequestExecutionLevel admin

Page directory
Page instfiles

Section "Main Section" SEC01
  SetOutPath $INSTDIR

  ; 复制后端服务
  File /r "backend\dist\*"

  ; 复制前端资源
  File /r "frontend\dist\*"

  ; 创建数据目录
  CreateDirectory "$INSTDIR\data"
  CreateDirectory "$INSTDIR\data\backup"
  CreateDirectory "$INSTDIR\data\logs"

  ; 创建快捷方式
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\SettlementServer.exe"

  ; 写入注册表
  WriteRegStr HKLM "Software\${APPNAME}" "InstallLocation" $INSTDIR

SectionEnd
```

### 7.3 补丁包方案

#### 补丁包结构
```
Patch-v1.0.1.exe
├── app/                    # 更新的文件
│   ├── backend/
│   └── frontend/
├── migrate/                # 数据库迁移脚本
│   ├── 004_add_field.sql
│   └── 005_update_data.sql
└── version.json            # 版本信息
```

#### 更新流程
1. 检测查当前版本
2. 备份数据库文件
3. 停止后端服务
4. 复制更新文件
5. 执行数据库迁移
6. 启动后端服务
7. 验证更新成功
8. 清理临时文件

#### 补丁脚本示例

```nsis
; installer/patch.nsi

!define APPNAME "SettlementSystem"
!define OLD_VERSION "1.0.0"
!define NEW_VERSION "1.0.1"

Name "${APPNAME} Patch ${NEW_VERSION}"
OutFile "Patch-v${NEW_VERSION}.exe"

; 检测旧版本是否已安装
Function .onInit
  ReadRegStr $0 HKLM "Software\${APPNAME}" "InstallLocation"
  ${If} $0 == ""
    MessageBox MB_OK "未检测到 ${APPNAME}，请先安装完整版本"
    Abort
  ${EndIf}
FunctionEnd

Section "Update"
  ; 备份数据库
  CopyFiles "$0\data\settlement.db" "$0\data\backup\before_patch_${NEW_VERSION}.db"

  ; 停止服务
  ExecWait 'taskkill /F /IM SettlementServer.exe'

  ; 复制更新文件
  CopyFiles "app\backend\*" "$0\backend\"
  CopyFiles "app\frontend\*" "$0\frontend\"

  ; 执行迁移（通过后端API）
  ExecWait '"$0\backend\SettlementServer.exe" --migrate'

  ; 启动服务
  Exec '"$0\backend\SettlementServer.exe"'

SectionEnd
```

---

## 八、版本管理

### 8.1 版本信息存储

```json
// data/version.json
{
  "appVersion": "1.0.0",
  "dbVersion": "1",
  "lastUpdated": "2026-04-08",
  "migrations": [
    "001_init_schema.prisma",
    "002_add_salary_field.prisma"
  ]
}
```

### 8.2 版本号规则

- **主版本号**：重大功能变更（如数据库结构大幅调整）
- **次版本号**：新功能添加
- **修订号**：Bug 修复

示例：
- `1.0.0` → `1.0.1`：修复工资计算 Bug
- `1.0.1` → `1.1.0`：新增库存预警功能
- `1.1.0` → `2.0.0`：数据库结构重构

### 8.3 数据库迁移

```typescript
// backend/migrations/migrate.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const migrations = [
  { version: 1, name: '001_init_schema' },
  { version: 2, name: '002_add_salary_field' },
  { version: 3, name: '003_add_inventory_alert' },
];

async function getCurrentDbVersion(): Promise<number> {
  const setting = await prisma.setting.findUnique({
    where: { key: 'db_version' }
  });
  return setting ? parseInt(setting.value) : 0;
}

async function runMigrations() {
  const currentVersion = await getCurrentDbVersion();
  console.log(`Current DB version: ${currentVersion}`);

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration: ${migration.name}`);
      
      // 执行迁移 SQL
      const sqlPath = path.join(__dirname, `${migration.name}.sql`);
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      await prisma.$executeRawUnsafe(sql);

      // 更新版本号
      await prisma.setting.upsert({
        where: { key: 'db_version' },
        update: { value: migration.version.toString() },
        create: { key: 'db_version', value: migration.version.toString() }
      });

      console.log(`Migration ${migration.name} completed`);
    }
  }
}

runMigrations()
  .then(() => {
    console.log('All migrations completed');
    prisma.$disconnect();
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
```

---

## 九、数据备份策略

### 9.1 自动备份

```typescript
// backend/services/backup.ts
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = 'data/backup';
const DB_PATH = 'data/settlement.db';
const MAX_BACKUP_DAYS = 30;

async function createBackup() {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = path.join(BACKUP_DIR, `settlement_${timestamp}.db`);

  // 确保备份目录存在
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 复制数据库文件
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`Backup created: ${backupPath}`);

  // 清理旧备份
  await cleanOldBackups();
}

async function cleanOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR);
  const backups = files
    .filter(f => f.startsWith('settlement_') && f.endsWith('.db'))
    .sort()
    .reverse(); // 最新的在前

  // 保留最近的 MAX_BACKUP_DAYS 个备份
  const toDelete = backups.slice(MAX_BACKUP_DAYS);
  toDelete.forEach(file => {
    fs.unlinkSync(path.join(BACKUP_DIR, file));
  });
}

// 定时备份（每天凌晨2点）
import cron from 'node-cron';
cron.schedule('0 2 * * *', createBackup);
```

### 9.2 手动备份

应用内提供功能：
- **立即备份**：生成带时间戳的备份文件
- **恢复备份**：选择历史备份文件恢复
- **导出数据**：导出为 JSON
- **导入数据**：从 JSON 导入

---

## 十、API 接口规范

### 10.1 RESTful API 设计

```
基础路径：/api/v1

认证：Bearer Token (JWT)

通用响应格式：
{
  "code": 0,           // 0 成功，非0 失败
  "message": "success",
  "data": {}
}
```

### 10.2 核心接口示例

#### 认证相关
```
POST   /api/v1/auth/login      # 用户登录
POST   /api/v1/auth/logout     # 用户登出
GET    /api/v1/auth/profile    # 获取当前用户信息
```

#### 员工管理
```
GET    /api/v1/employees           # 获取员工列表
POST   /api/v1/employees           # 创建员工
GET    /api/v1/employees/:id       # 获取员工详情
PUT    /api/v1/employees/:id       # 更新员工
DELETE /api/v1/employees/:id       # 删除员工
```

#### 生产报工
```
GET    /api/v1/production-records              # 获取报工记录
POST   /api/v1/production-records              # 创建报工记录
POST   /api/v1/production-records/batch        # 批量导入
PUT    /api/v1/production-records/:id/approve  # 审核报工
```

#### 工资计算
```
POST   /api/v1/salary/calculate           # 计算工资
GET    /api/v1/salary/bills               # 获取工资单列表
GET    /api/v1/salary/bills/:id           # 获取工资单详情
PUT    /api/v1/salary/bills/:id/approve   # 审核工资单
GET    /api/v1/salary/reports             # 获取工资报表
```

#### 进销存
```
GET    /api/v1/suppliers          # 获取供应商列表
POST   /api/v1/suppliers          # 创建供应商
GET    /api/v1/customers           # 获取客户列表
POST   /api/v1/customers           # 创建客户
GET    /api/v1/materials           # 获取物料列表
POST   /api/v1/materials           # 创建物料
GET    /api/v1/purchase-orders     # 获取采购单
POST   /api/v1/purchase-orders     # 创建采购单
POST   /api/v1/purchase-orders/:id/receive  # 采购入库
GET    /api/v1/sales-orders        # 获取销售单
POST   /api/v1/sales-orders        # 创建销售单
POST   /api/v1/sales-orders/:id/ship       # 销售出库
GET    /api/v1/inventory           # 获取库存
GET    /api/v1/inventory/logs      # 获取库存流水
```

---

## 十一、后续扩展预留

### 11.1 功能扩展

| 功能 | 规划优先级 | 说明 |
|------|-----------|------|
| 局域网多客户端 | P2 | 预留 CORS、WebSocket 支持 |
| MySQL 迁移 | P2 | 数据量增长后升级 |
| 扫码枪支持 | P2 | 预留条码字段、扫码录入 |
| 打印功能 | P3 | 工资单/单据打印模板 |
| 移动端 | P3 | 响应式设计或单独 App |
| 数据导入导出 | P2 | Excel 批量导入导出 |

### 11.2 技术扩展

- **缓存**：Redis（未来分布式部署）
- **消息队列**：RabbitMQ（异步任务处理）
- **监控**：日志收集、性能监控
- **自动化测试**：E2E 测试

---

## 十二、开发注意事项

### 12.1 前端开发

1. 使用 TypeScript 严格模式
2. 组件采用 Composition API
3. 使用 Pinia 进行状态管理
4. API 调用统一封装，处理错误和 Loading
5. 表单验证使用 Zod 或 Element Plus 内置验证

### 12.2 后端开发

1. 使用 TypeScript 严格模式
2. API 统一响应格式
3. 错误处理统一 middleware
4. 敏感操作记录审计日志
5. 数据库操作使用 Prisma 事务
6. 禁止直接返回数据库实体，使用 DTO

### 12.3 数据库开发

1. 所有表必须有 created_at 和 updated_at
2. 软删除优先于物理删除（添加 status 字段）
3. 使用 Prisma Migrate 管理数据库变更
4. 迁移脚本必须可回滚

### 12.4 安全性

1. 密码使用 bcrypt 加密存储
2. JWT Token 设置合理过期时间
3. API 接口进行权限验证
4. SQL 注入防护（Prisma 天然支持）
5. XSS 防护（前端 Vue 天然支持）

---

## 十三、项目启动检查清单

### 开发环境启动
- [ ] 安装 Node.js 18+
- [ ] 安装 pnpm/npm
- [ ] 克隆项目代码
- [ ] 安装后端依赖：`cd backend && pnpm install`
- [ ] 安装前端依赖：`cd frontend && pnpm install`
- [ ] 初始化数据库：`cd backend && npx prisma migrate dev`
- [ ] 启动后端：`cd backend && pnpm run dev`
- [ ] 启动前端：`cd frontend && pnpm run dev`
- [ ] 访问：http://localhost:5173

### 生产环境部署
- [ ] 后端打包：`cd backend && pnpm run build`
- [ ] 前端打包：`cd frontend && pnpm run build`
- [ ] 制作安装包：`pnpm run make-installer`
- [ ] 在目标机器运行安装包
- [ ] 启动应用程序

---

## 附录

### A. 环境变量示例

```bash
# backend/.env
DATABASE_URL="file:./data/settlement.db"
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="production"
```

### B. 常用命令

```bash
# 后端
cd backend
pnpm install              # 安装依赖
npx prisma generate       # 生成 Prisma Client
npx prisma migrate dev    # 开发环境迁移
npx prisma migrate prod  # 生产环境迁移
pnpm run dev              # 开发模式
pnpm run build            # 构建
pnpm start                # 启动

# 前端
cd frontend
pnpm install              # 安装依赖
pnpm run dev              # 开发模式
pnpm run build            # 构建
pnpm run preview          # 预览构建结果
```

### C. 推荐开发工具

- **IDE**：VSCode + Vue Language Features
- **API 测试**：Postman / Apifox
- **数据库查看**：DB Browser for SQLite
- **版本控制**：Git

---

**文档结束**
