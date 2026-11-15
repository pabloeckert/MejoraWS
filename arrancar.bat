@echo off
chcp 65001 >nul
title MejoraWS - WhatsApp Seguro
cd /d "%~dp0"
echo ===================================================
echo   MEJORA CONTINUA - MEJORAWS (WhatsApp Seguro)
echo ===================================================
echo Iniciando entorno en puerto 5176...
npm run dev
pause
