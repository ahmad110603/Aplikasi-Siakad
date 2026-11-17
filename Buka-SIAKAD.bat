@echo off
title SIAKAD & PPDB SMA Hidayatun Najah
echo ========================================================
echo   MENJALANKAN SIAKAD & PORTAL PPDB SMA HIDAYATUN NAJAH
echo ========================================================
echo.
cd /d "%~dp0"

:: Cek apakah server sudah berjalan
netstat -ano | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo [1/2] Menyalakan Server SIAKAD di latar belakang...
    start /min "SIAKAD-Server" node server.js
    timeout /t 2 /nobreak >nul
) else (
    echo [1/2] Server SIAKAD sudah aktif pada port 3000.
)

echo [2/2] Membuka antarmuka aplikasi...
:: Buka dalam mode aplikasi jendela desktop mandiri jika ada Edge / Chrome
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
) else (
    start http://localhost:3000
)

echo.
echo Aplikasi telah berhasil dibuka!
exit
