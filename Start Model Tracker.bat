@echo off
title Model Inventory ^& Risk Tracker
cd /d "%~dp0"

rem --- Find Node: use it from PATH if available, otherwise the portable copy ---
set "RUN=node"
where node >nul 2>nul
if errorlevel 1 (
  set "RUN="
  for /d %%D in ("%LOCALAPPDATA%\node-portable\node-v*-win-x64") do set "RUN=%%D\node.exe"
)

if "%RUN%"=="" (
  echo.
  echo Could not find Node.js. Please reinstall, or run "npm start" from a terminal.
  echo.
  pause
  exit /b 1
)

echo.
echo   Starting the Model Inventory ^& Risk Tracker...
echo   Your browser will open at http://localhost:3000
echo.
echo   Keep this window open while you use the tool. Close it to stop.
echo.

rem --- Open the browser a couple of seconds after the server starts ---
start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:3000"

"%RUN%" server.js

echo.
echo   The tool has stopped. You can close this window.
pause
