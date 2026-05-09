@echo off
setlocal
set PIDFILE=%~dp0server.pid
if not exist "%PIDFILE%" (
    echo No server PID file found.
    exit /b 0
)
set /p PID=<"%PIDFILE%"
if "%PID%"=="" (
    echo PID file is empty.
    del "%PIDFILE%" 2>nul
    exit /b 0
)
taskkill /F /PID %PID% 2>nul
if %errorlevel% equ 0 (
    echo Server stopped.
) else (
    echo Server process not found or already stopped.
)
del "%PIDFILE%" 2>nul
