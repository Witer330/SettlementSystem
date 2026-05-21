# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SettlementSystem is a small industrial/trade enterprise settlement management system (小型工贸企业结算系统). It combines payroll/wage accounting (工资核算) with inventory management (进销存) for small factories with 10-100 employees. All UI text, commit messages, and documentation are in Simplified Chinese.

## Tech Stack

- **Frontend**: Vue 3 + Vite 8 + Element Plus + Pinia + Vue Router + Axios
- **Backend**: Node.js + Express 5 + Prisma ORM + SQLite
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod (available but not yet used in controllers)
- **Language**: TypeScript throughout

## Context Gathering Strategy

We use **GitNexus** as a structural map. Choose the context tool wisely based on the task scope to balance precision, token usage, and latency:

### WHEN TO USE STANDARD TOOLS (Skip GitNexus):
1. **Local Fixes & Implementation Details**: If the task is inside a known file (e.g., bug fixing, writing local unit tests, modifying a function body). Just use standard `view_file` or `grep`.
2. **Text-Exact Search**: If you are looking for a specific string literal, log message, or unique variable name in the workspace.

### WHEN TO USE GITNEXUS (Mandatory):
1. **Architectural / High-Level Queries**: When asked "How does the auth flow work?" or "Explain the data pipeline structure."
2. **Impact / Blast Radius Analysis**: BEFORE changing a core shared utility, database schema, or exported interface. You MUST call `gitnexus_get_callers` or `gitnexus_get_dependencies` to ensure you don't break other modules.
3. **Cross-Module Tracing**: When tracing how a request flows from the router down to the database layers across multiple files.
4. **Vague / Semantic Code Search**: When searching for concepts rather than exact text (e.g., "where do we handle token expiration?"), use `gitnexus_search`.


## Development Commands

### Backend (`backend/`)
```bash
npm install              # Install dependencies
npm run dev              # Start dev server (port 3000, uses nodemon + ts-node)
npm run build            # Compile TypeScript (tsc -> dist/)
npm start                # Run production build
npm run seed             # Seed database (admin/admin123 + sample data)
npm run demo             # Generate demo data
npm run prisma:generate  # Regenerate Prisma Client after schema changes
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio (port 5555)
```

### Frontend (`frontend/`)
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (port 5173, proxies /api to localhost:3000)
npm run build            # Type check + Vite build (vue-tsc --noEmit && vite build)
npm run preview          # Preview production build
```

### Full Build
```powershell
./reload.ps1             # Builds both backend and frontend
```

## Architecture

### Backend (`backend/src/`)
- **Entry**: `index.ts` — Express app, mounts all routes under `/api/v1/`, initializes ConfigService at startup
- **Config**: `config/index.ts` — reads env vars from `backend/.env` (DATABASE_URL, JWT_SECRET, PORT)
- **ConfigService**: `services/config.service.ts` — singleton with in-memory cache, CRUD, audit logging, type-aware parsing
- **Prisma Singleton**: `lib/prisma.ts` — shared PrismaClient instance (all controllers import from here)
- **Auth**: `middleware/auth.middleware.ts` — JWT validation + role-based access (`authenticate`, `requireRole`)
- **Controllers** handle request/response logic; **Routes** define endpoints and apply middleware
- **Database**: Prisma schema at `prisma/schema.prisma` (28 models), SQLite stored in `prisma/data/settlement.db`
- **Configuration Management**: See `docs/CONFIG.md` for config categories, storage strategy, and new-config workflow

### Frontend (`frontend/src/`)
- **Entry**: `main.ts` — bootstraps Vue + Pinia + Element Plus + Router
- **Layout**: `views/Dashboard.vue` — sidebar + header + nested `<router-view>`
- **API layer**: `api/request.ts` is the primary Axios instance (base URL `/api/v1`, auto-attaches JWT). API modules (`api/*.ts`) import from this. Note: `api/index.ts` is a secondary Axios instance using `VITE_API_BASE` — ignore it.
- **State**: `stores/user.ts` — Pinia store for auth token and user info (persisted in localStorage)
- **Routing**: `router/index.ts` — nested routes under `/dashboard/*`, auth guard redirects unauthenticated users to `/login`
- **Design system**: `styles/design-system.css` + `styles/element-plus-theme.ts` — black-and-white theme with pill-shaped buttons (50px border-radius), negative letter-spacing typography. `styles/page-common.css` provides shared page layout styles.

### API Response Format
All endpoints return:
```json
{ "code": 0, "message": "success", "data": <payload> }
```
Non-zero `code` indicates an error. HTTP status codes used for auth (401, 403, 404, 500).

### Auth & Roles
- JWT in `Authorization: Bearer <token>` header
- Roles: `admin`, `operator` (defined in User model)
- Some routes (`/specs`, `/daily-records`, `/products`, `/departments`, `/job-types`) currently lack auth middleware

## Database Schema Sections

| Domain | Key Models |
|---|---|
| System | User, Department, JobType |
| Payroll | Employee, Product, BillOfMaterial, Process, ProductProcess, ProcessRate, ProductionRecord, WorkLog, SalaryBill, SalaryBillDetail, SalaryCalculation |
| Inventory | Supplier, Customer, Material, PurchaseOrder, PurchaseItem, SalesOrder, SalesItem, Inventory, InventoryLog |
| Spec Piece Rate | ProductSpec, SpecCoefficient, SpecPrice, DailyPieceRecord, DailyPieceRecordItem |
| Settings | Setting |

## Key Conventions

- **Package manager**: npm (no pnpm/yarn)
- **Path alias**: `@/*` maps to `frontend/src/*`
- **Commit messages**: Conventional Commits format in Chinese (e.g., `feat(员工管理): description`)
- **No test framework** — there are no tests currently
- **Lock files** are gitignored — do not commit `package-lock.json`

### File Size Constraints

Strict line limits enforced to keep code maintainable and agent-friendly:

| File Type | Max Lines | Rationale |
|-----------|-----------|-----------|
| `.vue` (SFC) | **500** | Template + script + style combined |
| `.ts` (TypeScript) | **400** | Single responsibility module |
| `.rs` (Rust) | **400** | Single responsibility module |

**When a file exceeds the limit:**
1. Extract reusable composables (`frontend/src/composables/`) — dialogs, form logic, status helpers
2. Extract sub-components (`frontend/src/components/`) — complex table sections, dialog forms
3. For Rust, split into separate modules under `src-tauri/src/`
4. For backend controllers, extract shared helpers to `backend/src/services/`


**Refactoring checklist:**
- [ ] Can the `<script>` logic be extracted to a composable?
- [ ] Can any `<el-dialog>` be extracted to its own component?
- [ ] Can repeated table columns/mappings be centralized?
- [ ] Are there `statusLabel`/`statusType` helpers duplicated across files?

Use the `/simplify` skill to auto-review and refactor oversized files.

## 中文本地化规则

本项目面向中国大陆用户，所有面向用户的文本必须使用简体中文。生成代码时必须遵守：

1. **Vue 模板**：所有 UI 文本（按钮、标签、表头、placeholder、空状态提示、确认弹窗标题和内容）必须为中文
2. **状态标签**：状态枚举值（如 `pending`/`confirmed`/`completed`/`active`）在展示时必须映射为中文（如"待确认"/"已确认"/"已完成"/"启用"），不能直接显示英文
3. **Element Plus 分页**：已配置 `zh-cn` 语言包，分页文本自动中文，无需额外处理
4. **后端响应消息**：`message` 字段使用中文（如"操作成功"、"获取成功"、"创建成功"），不要用 `"success"`
5. **错误提示**：`ElMessage` / `ElMessageBox` 的文本均为中文
6. **注释和变量名**：代码注释用中文，变量名/函数名保持英文（TypeScript 规范）
7. **新增页面/组件**：从创建之初就使用中文，不要先写英文再翻译

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **SettlementSystem** (3494 symbols, 4831 relationships, 49 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/SettlementSystem/context` | Codebase overview, check index freshness |
| `gitnexus://repo/SettlementSystem/clusters` | All functional areas |
| `gitnexus://repo/SettlementSystem/processes` | All execution flows |
| `gitnexus://repo/SettlementSystem/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
