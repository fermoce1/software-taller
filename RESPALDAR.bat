@echo off
chcp 65001 >nul
title RESPALDO - SANMY TALLER
cls
echo.
echo  ========================================
echo    CREANDO RESPALDO - SANMY TALLER
echo  ========================================
echo.

:: Fecha y hora
set YEAR=%DATE:~10,4%
set MONTH=%DATE:~4,2%
set DAY=%DATE:~7,2%
set HOUR=%TIME:~0,2%
set MIN=%TIME:~3,2%
set SEC=%TIME:~6,2%
if "%HOUR:~0,1%"==" " set HOUR=0%HOUR:~1,1%
set FECHA=%YEAR%-%MONTH%-%DAY%_%HOUR%-%MIN%-%SEC%

set ORIGEN=C:\Users\tecnosur\taller-prototipo
set DESTINO=C:\Users\tecnosur\respaldo-taller-%FECHA%

echo  Origen:  %ORIGEN%
echo  Destino: %DESTINO%
echo.

:: Crear carpeta destino
mkdir "%DESTINO%" 2>nul

:: Copiar todo excepto node_modules
echo  Copiando archivos...
xcopy "%ORIGEN%\*.html" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.js" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.sql" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.bat" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.ps1" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.json" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.css" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.png" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.jpg" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.ico" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.txt" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.wav" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.mp4" "%DESTINO%\" /Y /Q >nul
xcopy "%ORIGEN%\*.gif" "%DESTINO%\" /Y /Q >nul

:: Carpetas
echo  Copiando api...
xcopy "%ORIGEN%\api\*.*" "%DESTINO%\api\" /Y /Q /S >nul
echo  Copiando db...
xcopy "%ORIGEN%\db\*.*" "%DESTINO%\db\" /Y /Q /S >nul
echo  Copiando data...
xcopy "%ORIGEN%\data\*.*" "%DESTINO%\data\" /Y /Q /S >nul
echo  Copiando lib...
xcopy "%ORIGEN%\lib\*.*" "%DESTINO%\lib\" /Y /Q /S >nul
echo  Copiando img...
xcopy "%ORIGEN%\img\*.*" "%DESTINO%\img\" /Y /Q /S >nul
echo  Copiando assets...
xcopy "%ORIGEN%\assets\*.*" "%DESTINO%\assets\" /Y /Q /S >nul
echo  Copiando scripts...
xcopy "%ORIGEN%\scripts\*.*" "%DESTINO%\scripts\" /Y /Q /S >nul
echo  Copiando instalador...
xcopy "%ORIGEN%\instalador\*.*" "%DESTINO%\instalador\" /Y /Q /S >nul
echo  Copiando videos...
xcopy "%ORIGEN%\videos\*.*" "%DESTINO%\videos\" /Y /Q /S >nul
echo  Copiando herramientas-vendedor...
xcopy "%ORIGEN%\herramientas-vendedor\*.*" "%DESTINO%\herramientas-vendedor\" /Y /Q /S >nul

:: Base de datos
echo  Respaldando base de datos...
if exist "%ORIGEN%\data\*.db" (
    xcopy "%ORIGEN%\data\*.db" "%DESTINO%\data\" /Y /Q >nul
    xcopy "%ORIGEN%\data\*.db-wal" "%DESTINO%\data\" /Y /Q >nul
    xcopy "%ORIGEN%\data\*.db-shm" "%DESTINO%\data\" /Y /Q >nul
)

echo.
echo  ========================================
echo    RESPALDO CREADO EXITOSAMENTE
echo  ========================================
echo.
echo  Carpeta: respaldo-taller-%FECHA%
echo  Ubicacion: %DESTINO%
echo.
pause
