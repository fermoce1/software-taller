@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
set "IDFILE=id_equipo.txt"

if /I "%~1"=="silent" goto :solo_archivo

echo ========================================
echo  SANMY TALLER - ID del equipo con PCID
echo ========================================
echo.

if exist "PCID.exe" (
    echo 1. Se abrira PCID.exe
    echo 2. Copie la linea bajo ---CODE---
    echo    Ejemplo: 1056-2473-FA85-79C8-465C-0410-6C8E-3733
    echo.
    start "" "PCID.exe"
    timeout /t 2 >nul
) else (
    echo Coloque PCID.exe en: %~dp0
    echo.
)

set "PCID_INPUT="
set /p "PCID_INPUT=Pegue el CODE de PCID aqui: "

if not defined PCID_INPUT (
    echo.
    echo No se ingreso el CODE.
    goto :fin
)

(
    echo Informacion PCID del Equipo:
    echo ---CODE---
    echo !PCID_INPUT!
) > "%IDFILE%"
goto :mostrar

:solo_archivo
if not exist "%IDFILE%" exit /b 1
goto :mostrar

:mostrar
echo.
echo ID guardado en: %IDFILE%
echo ----------------------------------------
type "%IDFILE%"
echo ----------------------------------------
echo.
echo Envie este CODE al administrador para obtener su licencia SANMY.
echo.

:fin
if /I not "%~1"=="silent" pause
endlocal
