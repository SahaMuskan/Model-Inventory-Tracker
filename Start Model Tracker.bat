@echo off
title Model Inventory ^& Risk Tracker
cd /d "%~dp0"

rem --- 1) Make sure Node.js is available (downloads a portable copy on first run) ---
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\install-node.ps1"
if errorlevel 1 (
  echo.
  echo   Could not set up Node.js automatically.
  echo   Please install Node.js LTS from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

rem --- 2) Decide which Node/npm to use: the PATH one, else the portable copy ---
set "NODEEXE="
set "NPMCMD="
where node >nul 2>nul
if %errorlevel%==0 (
  set "NODEEXE=node"
  set "NPMCMD=npm"
) else (
  for /d %%D in ("%LOCALAPPDATA%\node-portable\node-v*-win-*") do (
    set "NODEEXE=%%D\node.exe"
    set "NPMCMD=%%D\npm.cmd"
  )
)
if "%NODEEXE%"=="" (
  echo   Could not locate Node.js after setup. Please install it from https://nodejs.org
  pause
  exit /b 1
)

rem --- 3) Install the app's components on first run ---
if not exist "node_modules\express" (
  echo.
  echo   Installing components ^(first run only^)...
  call "%NPMCMD%" install --no-audit --no-fund
  if errorlevel 1 (
    echo   Component install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

rem --- 4) Launch the server and open the browser ---
echo.
echo   Starting the Model Inventory ^& Risk Tracker...
echo   Your browser will open at http://localhost:3000
echo.
echo   Keep this window open while you use the tool. Close it to stop.
echo.
start "" cmd /c "timeout /t 3 >nul & start "" http://localhost:3000"
"%NODEEXE%" server.js

echo.
echo   The tool has stopped. You can close this window.
pause
