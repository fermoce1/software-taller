@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  SANMY TALLER - Permitir acceso en la red del taller
echo  ==================================================
echo.
echo  Esto permite que celular u otro PC en la MISMA WiFi
echo  se conecten al puerto 3020 (perfiles Domain, Private y Public).
echo  NO abre Internet publico por si solo.
echo.
echo  Se necesitan permisos de Administrador.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"%~dp0instalador\permiso-red-local.ps1\"\" -Port 3020'"
echo.
echo  Si acepto el aviso de Windows, la regla quedo aplicada.
echo  Pruebe desde el celular: http://[IP-del-PC]:3020/abrir.html
echo.
pause

