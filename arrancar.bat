@echo off
chcp 65001 >nul
title MejoraContacto - App de Escritorio Local (100% Offline Web-Free)
cd /d "%~dp0"

:MENU
cls
echo ====================================================================
echo       MEJORA CONTINUA - MEJORACONTACTO (App de Escritorio Local)
echo ====================================================================
echo.
echo   Selecciona el modo de inicio deseado:
echo.
echo   [1] Iniciar MejoraContacto Desktop (App de Escritorio 100%% Local)
echo   [2] Iniciar MejoraContacto Desktop en Modo Desarrollo (Live Reload)
echo   [3] Ejecutar Diagnostico Local (Mejora Doctor)
echo   [4] Ejecutar Suite de Pruebas (Vitest)
echo   [5] Salir
echo.
echo ====================================================================
choice /c 12345 /n /t 3 /d 1 /m "Elige una opcion (por defecto 1 en 3s): "
set OP=%ERRORLEVEL%

if "%OP%"=="1" goto OP_DESKTOP
if "%OP%"=="2" goto OP_DEV
if "%OP%"=="3" goto OP_DOCTOR
if "%OP%"=="4" goto OP_TESTS
if "%OP%"=="5" goto SALIR

:OP_DESKTOP
echo.
echo Iniciando MejoraContacto Desktop (100%% Local)...
if not exist "dist\index.html" (
    echo Compilando interfaz local por primera vez...
    call npm run build
)
set ELECTRON_SERVE_DIST=1
call npm start
goto FIN

:OP_DEV
echo.
echo Iniciando MejoraContacto Desktop en Modo Desarrollo (Puerto 5176)...
call npm run dev
goto FIN

:OP_DOCTOR
echo.
echo Ejecutando Mejora Doctor...
call npm run doctor
echo.
pause
goto MENU

:OP_TESTS
echo.
echo Ejecutando Suite de Pruebas Vitest...
call npm test
echo.
pause
goto MENU

:FIN
echo.
echo Aplicacion cerrada.
pause

:SALIR
exit
