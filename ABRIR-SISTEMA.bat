@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  SANMY TALLER MECANICO
echo  =====================
echo.

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

if not defined NODE_EXE (
    echo  Node.js no encontrado. Instale Node.js desde https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\express" (
    echo  Instalando dependencias...
    call npm install --no-fund --no-audit
    if errorlevel 1 (
        echo  Error al instalar dependencias.
        pause
        exit /b 1
    )
)

set "URL=http://localhost:3020/abrir.html"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\probar-servidor-taller.ps1" -Port 3020
if errorlevel 1 goto INICIAR_SERVIDOR

echo  Servidor activo en puerto 3020
goto ABRIR_NAVEGADOR

:INICIAR_SERVIDOR
echo  Reiniciando servidor (puerto 3020)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\liberar-puerto.ps1" -Port 3020
timeout /t 2 /nobreak >nul
echo  Iniciando servidor...
if exist "%~dp0skip-licencia.local" echo  Modo desarrollo: sin licencia en esta PC
start "Sanmy Taller Servidor" /MIN "%NODE_EXE%" server.js
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\esperar-servidor.ps1" -Port 3020 -TimeoutSec 45
if errorlevel 1 goto ERROR_SERVIDOR
goto ABRIR_NAVEGADOR

:ERROR_SERVIDOR
echo.
echo  ERROR: El servidor no arranco.
echo  Ejecute INICIAR-SERVIDOR.bat para ver el detalle.
pause
exit /b 1

:ABRIR_NAVEGADOR
echo  Abriendo Sanmy Taller...
if exist "%CHROME%" start "" "%CHROME%" "%URL%" & goto FIN_OK
if exist "%EDGE%" start "" "%EDGE%" "%URL%" & goto FIN_OK
start "" "%URL%"

:FIN_OK
echo.
echo  Listo: %URL%
echo  Detener servidor: CERRAR-SERVIDOR.bat
echo.
pause
