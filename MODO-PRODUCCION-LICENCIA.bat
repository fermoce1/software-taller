@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "%~dp0skip-licencia.local" del "%~dp0skip-licencia.local"
echo Licencia obligatoria de nuevo en esta PC.
echo Reinicie el servidor: CERRAR-SERVIDOR.bat y luego ABRIR-SISTEMA.bat
pause
