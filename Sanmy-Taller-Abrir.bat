@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "URL=http://localhost:3020/abrir.html"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

set "NODE_EXE="
if exist "%~dp0runtime\node\node.exe" (
    set "NODE_EXE=%~dp0runtime\node\node.exe"
    set "PATH=%~dp0runtime\node;%PATH%"
) else if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    set "PATH=C:\Program Files\nodejs;%PATH%"
)

if not defined NODE_EXE (
    where node >nul 2>&1
    if not errorlevel 1 for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"
)

if not defined NODE_EXE goto ABRIR_SOLO_HTML

if not exist "node_modules\express" (
    call npm install --no-fund --no-audit
    if errorlevel 1 goto ABRIR_SOLO_HTML
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\liberar-puerto.ps1" -Port 3020
timeout /t 1 /nobreak >nul

start "Sanmy Taller Servidor" /MIN "%NODE_EXE%" server.js
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\esperar-servidor.ps1" -Port 3020 -TimeoutSec 30
if errorlevel 1 goto ABRIR_SOLO_HTML

if exist "%CHROME%" start "" "%CHROME%" "%URL%" & exit /b 0
if exist "%EDGE%" start "" "%EDGE%" "%URL%" & exit /b 0
start "" "%URL%"
exit /b 0

:ABRIR_SOLO_HTML
if exist "%CHROME%" start "" "%CHROME%" "%URL%"
if exist "%EDGE%" start "" "%EDGE%" "%URL%"
start "" "%URL%"
exit /b 1
