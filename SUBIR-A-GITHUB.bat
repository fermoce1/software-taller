@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Subir Sanmy Taller a GitHub
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\subir-github-taller.ps1"
