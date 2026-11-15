@echo off
chcp 65001 >nul
title MejoraWS - WhatsApp Seguro y Plataforma Conversacional
cd /d "%~dp0"

:MENU
cls
echo ====================================================================
echo          MEJORA CONTINUA - MEJORAWS (WhatsApp Seguro 2026)
echo ====================================================================
echo.
echo   Selecciona el modo de inicio deseado:
echo.
echo   [1] Iniciar MejoraWS Desktop (Electron + Vite - WhatsApp Seguro)
echo   [2] Iniciar Plataforma Web PRD v1.0 (Fastify API + React Dashboard)
echo   [3] Ejecutar Diagnostico de Salud y Conectividad (Mejora Doctor)
echo   [4] Ejecutar Suite de Pruebas de Calidad (Vitest)
echo   [5] Salir
echo.
echo ====================================================================
choice /c 12345 /n /t 10 /d 1 /m "Elige una opcion (por defecto 1 en 10s): "
set OP=%ERRORLEVEL%

if "%OP%"=="1" goto OP_DESKTOP
if "%OP%"=="2" goto OP_PRD
if "%OP%"=="3" goto OP_DOCTOR
if "%OP%"=="4" goto OP_TESTS
if "%OP%"=="5" goto SALIR

:OP_DESKTOP
echo.
echo Iniciando MejoraWS Desktop (Puerto 5176)...
npm run dev
goto FIN

:OP_PRD
echo.
echo Iniciando Plataforma Web PRD v1.0 (API Fastify :3000 + Dashboard :5173)...
npm run dev:prd
goto FIN

:OP_DOCTOR
echo.
echo Ejecutando Mejora Doctor...
npm run doctor
echo.
pause
goto MENU

:OP_TESTS
echo.
echo Ejecutando Suite de Pruebas Vitest...
npm test
echo.
pause
goto MENU

:FIN
echo.
echo Proceso finalizado.
pause

:SALIR
exit
