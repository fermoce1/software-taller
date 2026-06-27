@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  SANMY TALLER — Icono en el escritorio
echo  =====================================
echo.
echo  Se creara el icono "Sanmy Taller" en su escritorio.
echo  Al hacer doble clic: inicia el servidor y abre el taller.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\crear-acceso-directo.ps1"

if errorlevel 1 (
    echo.
    echo  Error al crear el acceso directo.
    pause
    exit /b 1
)

echo.
echo  Listo. Busque en el escritorio: Sanmy Taller
echo.
pause
