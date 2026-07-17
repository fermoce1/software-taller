@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "GEN=%~dp0..\..\restaurante-prototipo\generador-licencias.html"
if not exist "%GEN%" (
    echo No se encontro el generador universal en:
    echo   %GEN%
    echo.
    echo Instale o copie restaurante-prototipo junto a taller-prototipo.
    pause
    exit /b 1
)
start "" "%GEN%"
