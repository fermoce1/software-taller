@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Modo desarrollo — esta PC no pedira licencia.
echo.> "%~dp0skip-licencia.local"
echo Creado: skip-licencia.local
echo.
echo Reinicie el servidor: CERRAR-SERVIDOR.bat y luego ABRIR-SISTEMA.bat
pause
