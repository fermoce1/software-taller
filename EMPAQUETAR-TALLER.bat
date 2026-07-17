@echo off
chcp 65001 >nul
cd /d "%~dp0instalador"

echo.
echo  EMPAQUETAR ZIP - Sanmy Taller (para clientes)
echo  =============================================
echo  No incluye generador de licencias ni herramientas de vendedor.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preparar-paquete-taller.ps1"
if errorlevel 1 (
    echo ERROR al preparar paquete.
    pause
    exit /b 1
)

set "ZIP=%~dp0dist\Sanmy-Taller.zip"
set "PKG=%~dp0dist\package"

if not exist "%~dp0dist" mkdir "%~dp0dist"
if exist "%ZIP%" del "%ZIP%"

powershell -NoProfile -Command "Compress-Archive -Path '%PKG%\*' -DestinationPath '%ZIP%' -Force"

echo.
echo  ZIP listo para entregar al taller:
echo  %ZIP%
echo.
echo  El cliente descomprime y ejecuta ABRIR-SISTEMA.bat
echo.
pause
