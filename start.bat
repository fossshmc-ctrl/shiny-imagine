@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

set "EXPECTED_VERSION=V29.1"
set "EXPECTED_BUILD=v29.1-wireframe-vercel-preview-fix-20260815"
set "AI_TOOL_PACKAGE_ROOT=%~dp0"
set "PORT=8787"
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=8787; try{$c=Get-Content -Raw -LiteralPath '%~dp0config.json'|ConvertFrom-Json; if($c.port){$p=[int]$c.port}}catch{}; Write-Output $p" 2^>nul`) do set "PORT=%%P"
set "URL=http://127.0.0.1:%PORT%/"
set "OPEN_URL=%URL%?v=29.1.0^&launch=%RANDOM%%RANDOM%"
set "LOG=%~dp0launch.log"

>"%LOG%" echo [%date% %time%] Launch %EXPECTED_VERSION% / %EXPECTED_BUILD%
>>"%LOG%" echo Folder=%CD%
>>"%LOG%" echo URL=%URL%

echo ===============================================
echo AI Tool Web UI %EXPECTED_VERSION% Core Launcher
echo ===============================================
echo Folder: %CD%
echo URL: %URL%
echo.

call :check_health
if /I "!HEALTH_VERSION!"=="%EXPECTED_VERSION%" if /I "!HEALTH_BUILD!"=="%EXPECTED_BUILD%" if /I "!HEALTH_ASSETS!"=="True" if /I "!HEALTH_ROOT_MATCH!"=="True" goto open_existing

if defined HEALTH_VERSION (
  echo Detected a stale or different AI Tool server on port %PORT%.
  echo Existing: !HEALTH_VERSION! / !HEALTH_BUILD! / assets=!HEALTH_ASSETS! / same-folder=!HEALTH_ROOT_MATCH!
  echo Closing it so this package uses its own HTML, JS, CSS and wireframe assets...
  >>"%LOG%" echo Existing server: version=!HEALTH_VERSION!, build=!HEALTH_BUILD!, assets=!HEALTH_ASSETS!, rootMatch=!HEALTH_ROOT_MATCH!
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ids=Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue|Select-Object -ExpandProperty OwningProcess -Unique; $ids|ForEach-Object{Write-Output $_}" 2^>nul`) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try{Stop-Process -Id %%I -Force -ErrorAction Stop}catch{}" >nul 2>nul
  )
  timeout /t 2 /nobreak >nul
)

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo ERROR: Port %PORT% is occupied by another program.
  echo Close that program, or change "port" in config.json and run again.
  >>"%LOG%" echo ERROR: port occupied by non-matching service
  pause
  exit /b 1
)

set "SERVER_KIND="
where node >nul 2>nul
if not errorlevel 1 (
  set "SERVER_KIND=Node.js"
  echo Node.js detected. Starting server.js...
  start "AI Tool V29.1 Core Server - Node" cmd /k "cd /d ""%~dp0"" && node server.js"
  goto wait_server
)

where python >nul 2>nul
if not errorlevel 1 (
  set "SERVER_KIND=Python"
  echo Python detected. Starting server.py...
  start "AI Tool V29.1 Core Server - Python" cmd /k "cd /d ""%~dp0"" && python server.py"
  goto wait_server
)

where py >nul 2>nul
if not errorlevel 1 (
  set "SERVER_KIND=Python launcher"
  echo Python launcher detected. Starting server.py...
  start "AI Tool V29.1 Core Server - Python" cmd /k "cd /d ""%~dp0"" && py server.py"
  goto wait_server
)

echo ERROR: Node.js or Python was not found.
echo Install Node.js LTS or Python, then run start.bat again.
>>"%LOG%" echo ERROR: no Node.js/Python found
pause
exit /b 1

:wait_server
echo Waiting for the V29.1 local server and 18 built-in wireframe assets...
for /l %%I in (1,1,35) do (
  call :check_health
  if /I "!HEALTH_VERSION!"=="%EXPECTED_VERSION%" if /I "!HEALTH_BUILD!"=="%EXPECTED_BUILD%" if /I "!HEALTH_ASSETS!"=="True" if /I "!HEALTH_ROOT_MATCH!"=="True" goto server_ready
  timeout /t 1 /nobreak >nul
)

echo ERROR: V29.1 did not become ready within 35 seconds.
echo Health: version=!HEALTH_VERSION!, build=!HEALTH_BUILD!, assets=!HEALTH_ASSETS!, same-folder=!HEALTH_ROOT_MATCH!
echo Check the second black window for detailed errors.
>>"%LOG%" echo ERROR: startup timeout, version=!HEALTH_VERSION!, build=!HEALTH_BUILD!, assets=!HEALTH_ASSETS!, rootMatch=!HEALTH_ROOT_MATCH!
pause
exit /b 1

:server_ready
echo Local server is ready (%SERVER_KIND%).
echo All 18 built-in wireframe images are readable.
echo Opening a cache-busted V29.1 page...
start "" "%OPEN_URL%"
>>"%LOG%" echo Server ready; browser opened; assets ready
exit /b 0

:open_existing
echo This exact V29.1 package is already running and all wireframe assets are ready.
echo Opening the page...
start "" "%OPEN_URL%"
>>"%LOG%" echo Reused exact matching V29.1 server
exit /b 0

:check_health
set "HEALTH_VERSION="
set "HEALTH_BUILD="
set "HEALTH_ASSETS="
set "HEALTH_ROOT_MATCH="
for /f "usebackq tokens=1-4 delims=|" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$h=Invoke-RestMethod -UseBasicParsing -Uri '%URL%api/health' -TimeoutSec 2; $expected=[IO.Path]::GetFullPath($env:AI_TOOL_PACKAGE_ROOT).TrimEnd([char]92); $actual=[IO.Path]::GetFullPath([string]$h.rootPath).TrimEnd([char]92); $same=[string]::Equals($expected,$actual,[StringComparison]::OrdinalIgnoreCase); Write-Output ('{0}|{1}|{2}|{3}' -f [string]$h.version,[string]$h.buildId,[bool]$h.assetsReady,$same)}catch{}" 2^>nul`) do (
  set "HEALTH_VERSION=%%A"
  set "HEALTH_BUILD=%%B"
  set "HEALTH_ASSETS=%%C"
  set "HEALTH_ROOT_MATCH=%%D"
)
exit /b 0
