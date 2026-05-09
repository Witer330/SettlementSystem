@echo off
setlocal
cd /d "%~dp0backend"
set NODE_ENV=production
set PORT=4000
"%~dp0node\node.exe" dist\index.js
