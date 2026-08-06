@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo No se encontro Node.js instalado en este Windows.
    echo Instalalo desde https://nodejs.org y despues corre este .bat de nuevo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Primera vez: instalando dependencias, puede tardar unos minutos...
    call npm install
    if errorlevel 1 (
        echo.
        echo Fallo el npm install. Revisa el error de arriba.
        pause
        exit /b 1
    )
)

echo Iniciando MejoraContacto...
call npm run dev

echo.
echo Se cerro MejoraContacto.
pause
