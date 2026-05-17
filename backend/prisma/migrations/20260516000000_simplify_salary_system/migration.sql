-- DropSpec-based tables (may or may not exist depending on deployment)
DROP TABLE IF EXISTS "SpecPrice";
DROP TABLE IF EXISTS "ProductSpec";
DROP TABLE IF EXISTS "SpecCoefficient";

-- Drop process-based tables
DROP TABLE IF EXISTS "ProcessRate";
DROP TABLE IF EXISTS "ProductProcess";
DROP TABLE IF EXISTS "ProductionRecord";
DROP TABLE IF EXISTS "Process";

-- Drop legacy unused table
DROP TABLE IF EXISTS "SalaryCalculation";

-- Add unitPrice column to Product
ALTER TABLE "Product" ADD COLUMN "unitPrice" REAL NOT NULL DEFAULT 0;

-- Remove pieceRate from Employee (SQLite requires table rebuild)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentId" INTEGER,
    "jobType" TEXT,
    "jobTypeId" INTEGER,
    "payType" TEXT NOT NULL DEFAULT 'hourly',
    "hourlyRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_jobTypeId_fkey" FOREIGN KEY ("jobTypeId") REFERENCES "JobType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Employee" ("id", "name", "code", "departmentId", "jobType", "jobTypeId", "payType", "hourlyRate", "status", "createdAt", "updatedAt")
  SELECT "id", "name", "code", "departmentId", "jobType", "jobTypeId", "payType", "hourlyRate", "status", "createdAt", "updatedAt" FROM "Employee";

DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");

-- Remove processId from SalaryBillDetail (SQLite requires table rebuild)
CREATE TABLE "new_SalaryBillDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "productId" INTEGER,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryBillDetail_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SalaryBill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_SalaryBillDetail" ("id", "billId", "type", "date", "productId", "quantity", "unitPrice", "amount", "remark", "createdAt")
  SELECT "id", "billId", "type", "date", "productId", "quantity", "unitPrice", "amount", "remark", "createdAt" FROM "SalaryBillDetail";

DROP TABLE "SalaryBillDetail";
ALTER TABLE "new_SalaryBillDetail" RENAME TO "SalaryBillDetail";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
