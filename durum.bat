@echo off
chcp 65001 >nul
setlocal
echo.
echo   NE CALISIYOR?
echo   ----------------------------------------------------

curl -s -o nul -m 5 http://127.0.0.1:8000/health/live
if %errorlevel%==0 (echo   [ACIK]  Motor    - http://localhost:8000/docs) else (echo   [KAPALI] Motor   - calismiyor)

curl -s -o nul -m 5 http://127.0.0.1:3000/
if %errorlevel%==0 (echo   [ACIK]  Arayuz   - http://localhost:3000) else (echo   [KAPALI] Arayuz  - calismiyor)

echo   ----------------------------------------------------
echo   Ikisi de ACIK ise platform tamamen calisiyor.
echo   Kapaliysa baslat.bat dosyasini calistir.
echo.
pause
