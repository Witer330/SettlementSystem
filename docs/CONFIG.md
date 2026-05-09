# 配置管理规范

本文档定义 SettlementSystem 的配置分类、存储策略和新增配置的标准流程。

---

## 1. 配置分类

### A. 环境变量（.env 文件）

部署时确定、运行时不变的基础设施配置。**绝不存入数据库。**

| 变量 | 说明 | 默认值 |
|---|---|---|
| `DATABASE_URL` | 数据库连接路径 | `file:./data/settlement.db` |
| `JWT_SECRET` | JWT 签名密钥 | 必须在生产环境修改 |
| `JWT_EXPIRES_IN` | Token 过期时间 | `7d` |
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `development` |

### B. 数据库配置（Setting 表）

运行时可通过管理界面修改的业务配置。由 `ConfigService` 统一管理。

| Key | 类型 | 分类 | 默认值 | 说明 |
|---|---|---|---|---|
| `ui.theme` | string | ui | `stripe` | UI 主题标识 |
| `system.name` | string | system | `结算系统` | 系统名称 |
| `system.companyName` | string | system | `''` | 公司名称 |
| `system.backupInterval` | number | system | `7` | 数据备份间隔（天） |
| `workflow.guide` | json | workflow | `[]` | 首页流程引导配置 |
| `dashboard.quickActions` | json | dashboard | `[]` | 首页快速操作入口 |
| `system.endpointRegistry` | json | system | `[]` | 页面接口别名注册表 |

### C. 硬编码常量

不需要运行时修改的固定值，保持代码内常量。

- 侧边栏宽度（64px / 240px）
- 分页默认值（10 / 20）
- 编码前缀（EMP / JT / SO）
- bcrypt 轮数（10）
- 最小密码长度（6）

---

## 2. 新增数据库配置流程

### 步骤 1: 定义配置 Key

遵循 `{domain}.{name}` 命名规范：
- `ui.*` — UI/外观相关
- `system.*` — 系统参数
- `workflow.*` — 工作流配置
- `dashboard.*` — 仪表盘配置

### 步骤 2: 在种子数据中注册

编辑 `backend/scripts/seed.ts`，在 `defaultSettings` 数组中添加：

```typescript
{ key: 'domain.name', value: '默认值', type: 'string|number|boolean|json', category: '分类', remark: '说明' }
```

### 步骤 3: 后端使用 ConfigService

```typescript
import { configService } from '../services/config.service'

// 读取
const value = configService.get<string>('domain.name')
const valueOrDefault = configService.getOrDefault('domain.name', 'fallback')

// 写入（自动记录审计日志）
await configService.set('domain.name', 'newValue', {
  type: 'string',
  category: 'system',
  remark: '说明',
  userId: req.userId,
  userName: '操作人'
})
```

### 步骤 4: 前端使用 settingApi

```typescript
import { settingApi } from '@/api/setting'

// 获取解析后的值
const theme = await settingApi.getTyped<string>('ui.theme')
const interval = await settingApi.getTyped<number>('system.backupInterval')

// 更新
await settingApi.updateSetting('system.name', '新名称', '备注')

// 批量更新
await settingApi.batchUpdate([
  { key: 'system.name', value: '名称' },
  { key: 'system.companyName', value: '公司' }
])
```

---

## 3. ConfigService API

### 读取

| 方法 | 说明 |
|---|---|
| `configService.get<T>(key)` | 按 type 自动解析，不存在返回 undefined |
| `configService.getOrDefault<T>(key, default)` | 不存在时返回默认值 |
| `configService.getAll(category?)` | 获取所有配置，可按分类过滤 |

### 写入

| 方法 | 说明 |
|---|---|
| `configService.set(key, value, options?)` | Upsert + 更新缓存 + 写审计日志 |
| `configService.batchSet(settings, options?)` | 事务批量更新 |
| `configService.remove(key, options?)` | 删除配置 + 写审计日志 |

### 缓存

| 方法 | 说明 |
|---|---|
| `configService.init()` | 启动时从 DB 加载全部配置到内存缓存 |
| `configService.invalidateCache(key?)` | 清除指定 key 或全部缓存 |

---

## 4. 审计日志

所有通过 ConfigService 的写入操作自动记录到 `SettingAuditLog` 表：

| 字段 | 说明 |
|---|---|
| `settingKey` | 配置 Key |
| `oldValue` | 变更前的值 |
| `newValue` | 变更后的值 |
| `action` | `create` / `update` / `delete` |
| `userId` | 操作人 ID |
| `userName` | 操作人姓名（冗余存储，防级联删除） |
| `createdAt` | 变更时间 |

查询审计日志：
```typescript
const logs = await configService.getAuditLogs({
  settingKey: 'system.name',
  page: 1,
  pageSize: 20
})
```

---

## 5. API 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/settings` | 已登录 | 获取所有设置（支持 `?category=` 过滤） |
| GET | `/api/v1/settings/:key` | 已登录 | 获取单个设置值 |
| PUT | `/api/v1/settings/:key` | admin | 更新设置 |
| POST | `/api/v1/settings/batch` | admin | 批量更新（事务性） |
| GET | `/api/v1/settings/system-info` | 已登录 | 获取系统信息 |
| GET | `/api/v1/settings/audit-logs` | admin | 获取审计日志 |

---

## 6. 存储类型说明

| type 值 | DB 存储 | ConfigService.get() 返回 |
|---|---|---|
| `string` | 原始字符串 | string |
| `number` | 数字字符串 | number |
| `boolean` | `'true'` / `'false'` | boolean |
| `json` | JSON 字符串 | 解析后的对象/数组 |
