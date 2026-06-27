@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  SANMY TALLER — Cerrar servidor
echo  ==============================
echo.

set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3020" ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo  Deteniendo proceso PID %%a ...
    taskkill /PID %%a /F >nul 2>&1
)

if "!FOUND!"=="0" (
    echo  No hay servidor activo en el puerto 3020.
) else (
    echo  Servidor Sanmy Taller detenido.
)

if exist "sanmy-taller-servidor.pid" del /f /q "sanmy-taller-servidor.pid" >nul 2>&1

echo.
pause
