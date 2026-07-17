@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" "http://localhost:3020/activar-licencia.html"
