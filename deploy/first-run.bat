@echo off
setlocal
cd /d "%~dp0backend"
set NODE_ENV=production

echo ========================================
echo   SettlementSystem Init
echo ========================================

echo [1/2] Generate Prisma Client...
"%~dp0node\node.exe" node_modules\prisma\build\index.js generate --schema=prisma\schema.prisma
if %errorlevel% neq 0 (
    echo Prisma generate FAILED!
    pause
    exit /b 1
)

echo [2/2] Run database migrations...
"%~dp0node\node.exe" node_modules\prisma\build\index.js migrate deploy --schema=prisma\schema.prisma
if %errorlevel% neq 0 (
    echo Database migration FAILED!
    pause
    exit /b 1
)

echo.
echo Init complete!
echo.
pause
