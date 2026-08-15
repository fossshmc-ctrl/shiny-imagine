@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
echo ===============================================
echo AI Tool Web UI V29 Core - Debug Start
echo ===============================================
echo This window shows full server and asset request logs.
echo Press Ctrl+C to stop the server.
echo.
where node >nul 2>nul
if not errorlevel 1 (
  node server.js
  goto end
)
where python >nul 2>nul
if not errorlevel 1 (
  python server.py
  goto end
)
where py >nul 2>nul
if not errorlevel 1 (
  py server.py
  goto end
)
echo ERROR: Node.js or Python was not found.
:end
pause
