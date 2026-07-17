@echo off
title Crear Acceso - Programa en VMware
cls

echo =============================================
echo  CREAR ACCESO DIRECTO A PROGRAMA EN VM
echo =============================================
echo.

:: === CONFIGURACION - CAMBIA ESTO ===
set RUTA_VMWARE=C:\Program Files (x86)\VMware\VMware Player
:: ====================================

echo Usando VMware de: %RUTA_VMWARE%
echo.
echo NOTA: Si la ruta es diferente, edita la linea 12 del .bat
echo.

:: Pedir datos
set /p VM_RUTA="Ruta del archivo .vmx (ej: D:\VMs\Windows10.vmx): "
if "%VM_RUTA%"=="" goto error

set /p PROG_RUTA="Ruta del programa dentro de la VM (ej: C:\SanmyTaller\Sanmy-Taller.exe): "
if "%PROG_RUTA%"=="" goto error

set /p VM_USUARIO="Usuario de la VM (dejar vacio si no): "
set /p VM_PASS="Clave de la VM (dejar vacio si no): "

set /p NOMBRE="Nombre del acceso (Enter = 'Sanmy Taller'): "
if "%NOMBRE%"=="" set NOMBRE=Sanmy Taller

:: Crear acceso directo
for /f "tokens=*" %%i in ('powershell -Command "[System.Environment]::GetFolderPath('Desktop')"') do set ESCRITORIO=%%i

if exist "%RUTA_VMWARE%\vmrun.exe" (
    echo [OK] vmrun.exe encontrado. Creando acceso con auto-apertura...
    if "%VM_USUARIO%"=="" (
        powershell -Command "$s = New-Object -ComObject WScript.Shell; $l = $s.CreateShortcut('%ESCRITORIO%\%NOMBRE%.lnk'); $l.TargetPath = '%RUTA_VMWARE%\vmrun.exe'; $l.Arguments = '-T ws runProgramInGuest """%VM_RUTA%""" -interactive -activeWindow """%PROG_RUTA%"""'; $l.WorkingDirectory = 'C:\'; $l.WindowStyle = 1; $l.Save()"
    ) else (
        powershell -Command "$s = New-Object -ComObject WScript.Shell; $l = $s.CreateShortcut('%ESCRITORIO%\%NOMBRE%.lnk'); $l.TargetPath = '%RUTA_VMWARE%\vmrun.exe'; $l.Arguments = '-T ws runProgramInGuest """%VM_RUTA%""" -interactive -activeWindow """%PROG_RUTA%""" -gu %VM_USUARIO% -gp %VM_PASS%'; $l.WorkingDirectory = 'C:\'; $l.WindowStyle = 1; $l.Save()"
    )
) else (
    echo [AVISO] vmrun.exe no encontrado. Creando acceso solo para abrir la VM...
    echo Luego dentro de la VM abre el programa manualmente.
    powershell -Command "$s = New-Object -ComObject WScript.Shell; $l = $s.CreateShortcut('%ESCRITORIO%\%NOMBRE%.lnk'); $l.TargetPath = '%RUTA_VMWARE%\vmplayer.exe'; $l.Arguments = '"%VM_RUTA%"'; $l.WorkingDirectory = 'C:\'; $l.WindowStyle = 1; $l.Save()"
)

echo.
echo =============================================
echo  LISTO! Acceso creado en el Escritorio
echo  "%ESCRITORIO%\%NOMBRE%.lnk"
echo =============================================
echo.
pause
goto fin

:error
echo No ingresaste todos los datos. Saliendo.
pause

:fin
