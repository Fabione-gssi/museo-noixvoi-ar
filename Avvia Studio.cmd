@echo off
rem Avvia lo Studio: installa cio' che manca, avvia il server locale e apre il browser.
chcp 65001 >nul
cd /d "%~dp0"
title Studio - Quadri che prendono vita
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non e' installato. Lo installo ora...
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  echo.
  echo Installazione finita: chiudi questa finestra e fai di nuovo doppio clic su "Avvia Studio".
  pause
  exit /b 1
)
node studio\setup.mjs
node studio\server.mjs --open
pause
