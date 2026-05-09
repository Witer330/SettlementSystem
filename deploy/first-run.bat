@echo off
setlocal
cd /d "%~dp0backend"
set NODE_ENV=production

echo ========================================
echo   SettlementSystem 初始化
echo ========================================

echo [1/2] 生成 Prisma Client...
"%~dp0node\node.exe" node_modules\prisma\build\index.js generate
if %errorlevel% neq 0 (
    echo Prisma generate failed!
    pause
    exit /b 1
)

echo [2/2] 执行数据库迁移...
"%~dp0node\node.exe" node_modules\prisma\build\index.js migrate deploy
if %errorlevel% neq 0 (
    echo Database migration failed!
    pause
    exit /b 1
)

echo.
echo 初始化完成！请从系统托盘启动服务。
echo.
pause
