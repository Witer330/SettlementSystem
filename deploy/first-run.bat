@echo off
setlocal
cd /d "%~dp0backend"
set NODE_ENV=production

echo ========================================
echo   SettlementSystem Init
echo ========================================

echo [1/2] Generate Prisma Client...
"node" node_modules\prisma\build\index.js generate --schema=prisma\schema.prisma
if %errorlevel% neq 0 (
    echo Prisma generate FAILED! 1>&2
    exit /b 1
)

echo [2/2] Run database migrations...
"node" node_modules\prisma\build\index.js migrate deploy --schema=prisma\schema.prisma
if %errorlevel% neq 0 (
    echo Database migration FAILED! 1>&2
    exit /b 1
)

echo Init complete!
