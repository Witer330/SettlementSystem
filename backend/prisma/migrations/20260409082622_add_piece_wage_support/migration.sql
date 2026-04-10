-- CreateTable
CREATE TABLE "WorkLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryBillDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "productId" INTEGER,
    "processId" INTEGER,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryBillDetail_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SalaryBill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentId" INTEGER,
    "jobType" TEXT NOT NULL,
    "payType" TEXT NOT NULL DEFAULT 'hourly',
    "hourlyRate" REAL NOT NULL DEFAULT 0,
    "pieceRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("code", "createdAt", "departmentId", "hourlyRate", "id", "jobType", "name", "status", "updatedAt") SELECT "code", "createdAt", "departmentId", "hourlyRate", "id", "jobType", "name", "status", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");
CREATE TABLE "new_SalaryBill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "hourlyHours" REAL NOT NULL DEFAULT 0,
    "hourlyAmount" REAL NOT NULL DEFAULT 0,
    "pieceAmount" REAL NOT NULL DEFAULT 0,
    "pieceCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" INTEGER,
    "approvedAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryBill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SalaryBill" ("approvedAt", "approvedBy", "createdAt", "employeeId", "id", "period", "remark", "status", "totalAmount", "updatedAt") SELECT "approvedAt", "approvedBy", "createdAt", "employeeId", "id", "period", "remark", "status", "totalAmount", "updatedAt" FROM "SalaryBill";
DROP TABLE "SalaryBill";
ALTER TABLE "new_SalaryBill" RENAME TO "SalaryBill";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
