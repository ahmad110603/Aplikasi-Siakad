@echo off
title Upload SIAKAD ke GitHub
color 0A
echo ========================================================
echo   UPLOAD REPOSITORY SIAKAD KE GITHUB (ahmad110603)
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/3] Menyiapkan branch dan remote...
git branch -M main
git remote set-url origin https://github.com/ahmad110603/Aplikasi-Siakad.git

echo [2/3] Memastikan semua file ter-commit...
git add .
git commit -m "Initial commit" 2>nul

echo.
echo [3/3] Mengunggah file ke GitHub (git push -u origin main)...
echo.
echo CATATAN:
echo Jika muncul jendela Git Credential Manager atau Browser,
echo silakan klik 'Sign in with your browser' untuk login ke akun GitHub Anda.
echo.
git push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   ALHAMDULILLAH BERHASIL! 
    echo   Repository GitHub Anda sekarang sudah terisi penuh:
    echo   https://github.com/ahmad110603/Aplikasi-Siakad
    echo ========================================================
) else (
    echo ========================================================
    echo   Gagal mengunggah. Kemungkinan penyebab:
    echo   1. Perlu login di jendela browser yang muncul.
    echo   2. Atau memerlukan GitHub Personal Access Token (PAT).
    echo ========================================================
)
echo.
pause
