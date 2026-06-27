@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  SANMY TALLER — Iniciar servidor (ventana visible)
echo  ================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3020/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { Write-Host '  AVISO: Ya hay un servidor en el puerto 3020.'; exit 2 } exit 1 } catch { exit 1 }"
if errorlevel 2 (
    echo.
    start "" "http://localhost:3020/abrir.html"
    echo  Navegador abierto. Para detener: CERRAR-SERVIDOR.bat
    echo.
    pause
    exit /b 0
)

start "Sanmy Taller Servidor" cmd /k call "%~dp0instalador\servidor.cmd"

echo  Ventana del servidor abierta.
echo  URL: http://localhost:3020/abrir.html
echo.
pause
