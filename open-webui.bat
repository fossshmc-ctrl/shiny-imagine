@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PORT=8787"
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=8787; try{$c=Get-Content -Raw -LiteralPath '%~dp0config.json'|ConvertFrom-Json; if($c.port){$p=[int]$c.port}}catch{}; Write-Output $p" 2^>nul`) do set "PORT=%%P"
start "" "http://127.0.0.1:%PORT%/"
