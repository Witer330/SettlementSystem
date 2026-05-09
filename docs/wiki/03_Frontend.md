# 03. 前端（frontend）结构与关键逻辑

## 1. 技术栈与依赖

- Vue 3 + TypeScript（Vite 构建）
- UI：Element Plus（中文 locale：zh-cn）
- 路由：vue-router
- 状态：Pinia
- HTTP：axios

依赖清单见 [frontend/package.json](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/package.json)。

## 2. 入口装配

入口文件：[frontend/src/main.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/main.ts)

- 创建 `createApp(App)`、注册 Pinia 与 Router
- 引入 Element Plus 并设置中文 locale
- 初始化主题：`setupElementPlusTheme()` + `themeStore.init()`

根组件：[App.vue](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/App.vue)

- 仅包含 `router-view`，页面内容由路由驱动

## 3. 路由结构（页面信息架构）

路由定义：[frontend/src/router/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/router/index.ts)

- 公开页面：`/login`
- 受保护页面：`/dashboard/*`（除 `/login` 外默认需要 token）
- 主要模块：
  - 工资：`/dashboard/salary/*`（工资计算、每日计件记录）
  - 基础资料：`/dashboard/basic-info/*`（产品、规格）
  - 进销存：`/dashboard/inventory/*`（供应商、客户、物料、采购、销售、库存、BOM、物料需求）
  - 系统：`/dashboard/system/*`（用户、工种、员工、部门、系统设置）

### 3.1 登录态导航守卫

文件：[router/index.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/router/index.ts#L148-L162)

- 判断 token：`tokenManager.getToken()`
- 未登录访问非 `/login` → 重定向 `/login`
- 已登录访问 `/login` → 重定向 `/dashboard`

## 4. API 层（axios 封装与资源 API）

### 4.1 axios 实例与统一拦截器

文件：[frontend/src/api/request.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/api/request.ts)

- baseURL：
  - 若 `VITE_API_BASE` 非空：`${VITE_API_BASE}/api/v1`
  - 否则：`/api/v1`（依赖 Vite 代理或同源后端静态托管）
- 请求拦截：从 `localStorage` 读取 token，写入 `Authorization: Bearer ...`
- 响应拦截：
  - 按 `{code,message,data}` 解包
  - `code !== 0` 抛异常（由页面层捕获并提示）
  - HTTP 401：清理 token/user 并跳转 `/login`

### 4.2 认证 API 与 tokenManager

文件：[frontend/src/api/auth.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/api/auth.ts)

- `authApi.login/logout/getProfile/changePassword/initAdmin`
- 用户管理：`getUsers/createUser/updateUser/deleteUser`
- `tokenManager`：对 `localStorage` 的 token/user 进行封装

### 4.3 资源 API 文件分布

`frontend/src/api/*.ts` 以“后端资源”为粒度拆分，对应后端 `routes/controllers`：

- 认证：auth.ts
- 工资：salary.ts
- 员工：employee.ts
- 规格/计件：spec.ts、dailyPiece.ts
- 进销存：material.ts、salesOrder.ts、bom.ts 等

## 5. 状态管理（Pinia）

### 5.1 用户状态（useUserStore）

文件：[stores/user.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/stores/user.ts)

- `token`：初始化从 `localStorage.getItem('token')` 读取
- `setToken/clearToken`：写入/清理 localStorage
- `userInfo`：当前实现仅驻留内存（未自动持久化）

## 6. 样式与主题

入口引入：

- [design-system.css](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/styles/design-system.css)
- [page-common.css](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/styles/page-common.css)
- Element Plus 主题适配：[element-plus-theme.ts](file:///c:/Users/witer/Documents/pro/SettlementSystem/frontend/src/styles/element-plus-theme.ts)

