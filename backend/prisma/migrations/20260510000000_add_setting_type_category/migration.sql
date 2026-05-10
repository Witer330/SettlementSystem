-- AlterTable: Setting 表新增字段
ALTER TABLE "Setting" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'string';
ALTER TABLE "Setting" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "Setting" ADD COLUMN "defaultValue" TEXT;
ALTER TABLE "Setting" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Setting" ADD COLUMN "createdBy" INTEGER;
ALTER TABLE "Setting" ADD COLUMN "updatedBy" INTEGER;

-- CreateTable: SettingAuditLog（如果不存在）
CREATE TABLE IF NOT EXISTS "SettingAuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "settingKey" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "action" TEXT NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SettingAuditLog_settingKey_idx" ON "SettingAuditLog"("settingKey");
CREATE INDEX IF NOT EXISTS "SettingAuditLog_createdAt_idx" ON "SettingAuditLog"("createdAt");
