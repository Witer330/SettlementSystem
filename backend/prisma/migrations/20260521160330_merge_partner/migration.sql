/*
  Warnings:

  - You are about to drop the `Customer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Supplier` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `supplierId` on the `Payable` table. All the data in the column will be lost.
  - You are about to drop the column `supplierId` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `Receivable` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `SalesOrder` table. All the data in the column will be lost.
  - Added the required column `partnerId` to the `Payable` table without a default value. This is not possible if the table is not empty.
  - Added the required column `partnerId` to the `Receivable` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Customer_code_key";

-- DropIndex
DROP INDEX "Supplier_code_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Customer";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Supplier";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Partner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "isCustomer" BOOLEAN NOT NULL DEFAULT false,
    "isSupplier" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" INTEGER,
    "approvedAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payable_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payable" ("approvedAt", "approvedBy", "createdAt", "id", "orderNo", "remark", "status", "totalAmount", "updatedAt") SELECT "approvedAt", "approvedBy", "createdAt", "id", "orderNo", "remark", "status", "totalAmount", "updatedAt" FROM "Payable";
DROP TABLE "Payable";
ALTER TABLE "new_Payable" RENAME TO "Payable";
CREATE UNIQUE INDEX "Payable_orderNo_key" ON "Payable"("orderNo");
CREATE TABLE "new_PurchaseOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partnerId" INTEGER,
    "salesOrderId" INTEGER,
    "orderNo" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remark" TEXT,
    "reserveInventory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrder" ("createdAt", "id", "orderNo", "remark", "reserveInventory", "salesOrderId", "status", "totalAmount", "updatedAt") SELECT "createdAt", "id", "orderNo", "remark", "reserveInventory", "salesOrderId", "status", "totalAmount", "updatedAt" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE UNIQUE INDEX "PurchaseOrder_orderNo_key" ON "PurchaseOrder"("orderNo");
CREATE TABLE "new_Receivable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" INTEGER,
    "approvedAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Receivable_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Receivable" ("approvedAt", "approvedBy", "createdAt", "id", "orderNo", "remark", "status", "totalAmount", "updatedAt") SELECT "approvedAt", "approvedBy", "createdAt", "id", "orderNo", "remark", "status", "totalAmount", "updatedAt" FROM "Receivable";
DROP TABLE "Receivable";
ALTER TABLE "new_Receivable" RENAME TO "Receivable";
CREATE UNIQUE INDEX "Receivable_orderNo_key" ON "Receivable"("orderNo");
CREATE TABLE "new_SalesOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partnerId" INTEGER,
    "orderNo" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remark" TEXT,
    "reserveInventory" BOOLEAN NOT NULL DEFAULT true,
    "orderDate" DATETIME,
    "businessType" TEXT,
    "deliveryMethod" TEXT,
    "salesperson" TEXT,
    "deliveryPerson" TEXT,
    "returnDate" DATETIME,
    "paymentMethod" TEXT,
    "contactInfo" TEXT,
    "customerRemark" TEXT,
    "creator" TEXT,
    "wholeDiscount" REAL NOT NULL DEFAULT 100,
    "usePrepayment" BOOLEAN NOT NULL DEFAULT false,
    "shippingAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SalesOrder" ("businessType", "contactInfo", "createdAt", "creator", "customerRemark", "deliveryMethod", "deliveryPerson", "id", "orderDate", "orderNo", "paymentMethod", "remark", "reserveInventory", "returnDate", "salesperson", "shippingAddress", "status", "totalAmount", "updatedAt", "usePrepayment", "wholeDiscount") SELECT "businessType", "contactInfo", "createdAt", "creator", "customerRemark", "deliveryMethod", "deliveryPerson", "id", "orderDate", "orderNo", "paymentMethod", "remark", "reserveInventory", "returnDate", "salesperson", "shippingAddress", "status", "totalAmount", "updatedAt", "usePrepayment", "wholeDiscount" FROM "SalesOrder";
DROP TABLE "SalesOrder";
ALTER TABLE "new_SalesOrder" RENAME TO "SalesOrder";
CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "SalesOrder"("orderNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Partner_code_key" ON "Partner"("code");

-- CreateIndex
CREATE INDEX "Partner_isCustomer_idx" ON "Partner"("isCustomer");

-- CreateIndex
CREATE INDEX "Partner_isSupplier_idx" ON "Partner"("isSupplier");
