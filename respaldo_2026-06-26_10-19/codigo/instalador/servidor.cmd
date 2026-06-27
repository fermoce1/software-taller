@echo off
chcp 65001 >nul
title Sanmy Taller — Servidor
cd /d "%~dp0.."

if exist "%~dp0..\runtime\node\node.exe" (
    set "PATH=%~dp0..\runtime\node;%PATH%"
)

echo.
echo  SANMY TALLER — Servidor (puerto 3020)
echo  =====================================
echo  No cierre esta ventana mientras use el taller.
echo.

if exist "%~dp0..\runtime\node\node.exe" (
    "%~dp0..\runtime\node\node.exe" server.js
) else (
    node server.js
)

echo.
pause
