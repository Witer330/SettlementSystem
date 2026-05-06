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
- **Entry**: `index.ts` — Express app, mounts all routes under `/api/v1/`
- **Config**: `config/index.ts` — reads env vars from `backend/.env` (DATABASE_URL, JWT_SECRET, PORT)
- **Auth**: `middleware/auth.middleware.ts` — JWT validation + role-based access (`authenticate`, `requireRole`)
- **Controllers** handle request/response logic; **Routes** define endpoints and apply middleware
- **Database**: Prisma schema at `prisma/schema.prisma` (26 models), SQLite stored in `prisma/data/settlement.db`
- **Migrations**: 3 existing migrations in `prisma/migrations/`

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
