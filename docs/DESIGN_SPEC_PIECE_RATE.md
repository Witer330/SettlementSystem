# 产品规格计件系统设计文档

## 业务场景
面向小型工贸型企业，一线员工加工同一产品但不同规格时，计件单价不同。
价格确定方式：**基础价格 + 浮动系数**

## 核心概念

### 1. 定价公式
```
最终单价 = 基础价格 × (1 + 尺寸系数 + 材质系数 + 工艺系数 + 复杂度系数)
```

### 2. 规格属性
- **尺寸规格**：直径、长度、宽度等
- **材质参数**：材料类型、厚度、硬度等
- **工艺要求**：精度等级、表面处理、特殊要求
- **复杂程度**：简单/中等/困难（定性描述）

### 3. 业务规则
- 同一规格对所有员工使用统一单价（不因员工而异）
- 员工生产记录按日汇总
- 支持系数配置灵活调整

---

## 数据库设计

### 1. ProductSpec（产品规格表）
```prisma
model ProductSpec {
  id        Int      @id @default(autoincrement())
  productId Int
  name      String   // 规格名称，如 "Φ100×20-A3"
  code      String   @unique // 规格编码

  // 规格参数（JSON格式存储）
  dimensions Json    // {"diameter": 100, "length": 20}
  material   Json    // {"type": "steel", "thickness": 2}
  craft      Json    // {"surface": "galvanized", "precision": "H7"}
  difficulty String   @default("medium") // easy/medium/hard

  // 定价相关
  basePrice Float    @default(0) // 基础价格

  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  product     Product         @relation(fields: [productId], references: [id])
  specPrice   SpecPrice?
  dailyRecords DailyPieceRecordItem[]
}
```

### 2. SpecCoefficient（规格系数配置表）
```prisma
model SpecCoefficient {
  id        Int      @id @default(autoincrement())
  type      String   // dimension/material/craft/difficulty
  code      String   // 系数代码，如 "diameter_gt_100"
  name      String   // 系数名称，如 "直径>100mm"
  value     Float    // 系数值，如 0.15
  priority  Int      @default(0) // 优先级

  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 3. SpecPrice（规格价目表）
```prisma
model SpecPrice {
  id          Int      @id @default(autoincrement())
  specId      Int      @unique
  unitPrice   Float    // 最终计算单价
  effectiveAt DateTime @default(now()) // 生效时间
  remark      String?

  createdAt   DateTime @default(now())

  spec ProductSpec @relation(fields: [specId], references: [id])
}
```

### 4. DailyPieceRecord（每日计件记录表）
```prisma
model DailyPieceRecord {
  id         Int      @id @default(autoincrement())
  employeeId Int
  date       DateTime // 日期
  totalAmount Float   @default(0) // 当日总金额
  remark     String?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  employee Employee                @relation(fields: [employeeId], references: [id])
  items    DailyPieceRecordItem[]
}

model DailyPieceRecordItem {
  id     Int      @id @default(autoincrement())
  recordId Int
  specId Int
  quantity Int     // 数量
  unitPrice Float  // 记录时的单价
  amount   Float   // 金额

  createdAt DateTime @default(now())

  record DailyPieceRecord @relation(fields: [recordId], references: [id])
  spec   ProductSpec       @relation(fields: [specId], references: [id])
}
```

---

## 系统功能模块

### 1. 规格管理模块
- **创建产品规格**：输入规格参数和基础价格
- **规格系数配置**：配置各类型系数规则
- **自动计算单价**：根据基础价格和系数自动计算最终单价
- **规格价目查看**：查看所有规格的最终单价

### 2. 计件记录模块
- **每日计件录入**：选择员工、日期，输入各规格生产数量
- **自动金额计算**：根据规格单价和生产数量自动计算金额
- **记录查看与修改**：查看历史记录，支持修正

### 3. 工资核算模块
- **按月汇总计算**：按结算周期汇总每日计件记录
- **生成工资单**：生成员工月度工资单
- **明细查看**：查看工资单的每日计件明细

---

## 实现步骤

### Phase 1: 数据库Schema更新
1. 添加 ProductSpec, SpecCoefficient, SpecPrice 模型
2. 添加 DailyPieceRecord, DailyPieceRecordItem 模型
3. 运行数据库迁移

### Phase 2: 后端API开发
1. 规格管理API（创建、规格、单价计算）
2. 系数配置API（CRUD）
3. 每日计件记录API（录入、查询、修改）
4. 更新工资计算逻辑（整合规格计件）

### Phase 3: 前端页面开发
1. 产品规格管理页面
2. 规格系数配置页面
3. 每日计件录入页面
4. 更新工资计算页面

---

## 系数配置示例

### 尺寸系数
| 代码 | 名称 | 系数值 | 说明 |
|------|------|--------|------|
| diameter_gt_150 | 直径>150mm | 0.20 | 大规格产品 |
| diameter_100_150 | 直径100-150mm | 0.10 | 中等规格 |
| diameter_lt_100 | 直径<100mm | 0.00 | 小规格（基准） |

### 材质系数
| 代码 | 名称 | 系数值 |
|------|------|--------|
| stainless | 不锈钢 | 0.15 |
| steel | 普通钢 | 0.00 |
| aluminum | 铝合金 | 0.08 |

### 工艺系数
| 代码 | 名称 | 系数值 |
|------|------|--------|
| galvanized | 镀锌处理 | 0.10 |
| polished | 抛光处理 | 0.15 |
| none | 无处理 | 0.00 |

### 复杂度系数
| 代码 | 名称 | 系数值 |
|------|------|--------|
| difficulty_hard | 困难 | 0.25 |
| difficulty_medium | 中等 | 0.10 |
| difficulty_easy | 简单 | 0.00 |

---

## 单价计算示例

假设基础价格 = 10元

**规格A**：直径100mm + 普通钢 + 镀锌 + 中等复杂度
```
最终单价 = 10 × (1 + 0.00 + 0.00 + 0.10 + 0.10) = 12元
```

**规格B**：直径180mm + 不锈钢 + 抛光 + 困难复杂度
```
最终单价 = 10 × (1 + 0.20 + 0.15 + 0.15 + 0.25) = 17.5元
```
