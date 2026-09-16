@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==========================================================
echo   SEO Platformu - Yerel Baslatici
echo ==========================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [HATA] Python ortami kurulu degil ^(.venv klasoru yok^).
    echo        Once sunu calistir:
    echo.
    echo        python -m venv .venv
    echo        .venv\Scripts\python -m pip install -r requirements.txt
    echo        .venv\Scripts\python -m playwright install chromium
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [HATA] Node paketleri kurulu degil ^(node_modules klasoru yok^).
    echo        Once sunu calistir:  npm install
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [HATA] .env dosyasi yok. Ayarlar olmadan calismaz.
    echo        .env.example dosyasini kopyalayip .env olarak kaydet.
    echo.
    pause
    exit /b 1
)

if not exist "dev.db" (
    echo [1/3] Veritabani bulunamadi, kuruluyor...
    .venv\Scripts\python.exe scripts\init_db.py --sqlite
    echo.
)

echo [2/3] Motor baslatiliyor ^(arka plan - Python/FastAPI, port 8000^)...
start "SEO Motoru - port 8000" cmd /k ".venv\Scripts\python.exe -m uvicorn apps.api.main:app --reload --port 8000"

echo [3/3] Arayuz baslatiliyor ^(Next.js, port 3000^)...
start "SEO Arayuzu - port 3000" cmd /k "npm run dev"

echo.
echo Iki yeni pencere acildi. Kapatirsan platform durur.
echo Baslamalari 10-20 saniye surer, sonra tarayici acilacak.
echo.

timeout /t 18 /nobreak >nul
start "" "http://localhost:3000"

echo ==========================================================
echo   Arayuz  : http://localhost:3000
echo   Motor   : http://localhost:8000/docs
echo.
echo   Ikisi de aciliyorsa her sey calisiyor demektir.
echo   Giris sifresi .env dosyasinda INITIAL_ADMIN_PASSWORD satirinda.
echo ==========================================================
echo.
pause
