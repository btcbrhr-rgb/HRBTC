@echo off
chcp 65001 >nul
echo ============================================================
echo   HRBTC Setup - Build .exe
echo ============================================================

set PYINSTALLER=%LOCALAPPDATA%\Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\local-packages\Python312\Scripts\pyinstaller.exe

echo [1] ตรวจสอบ PyInstaller...
if exist "%PYINSTALLER%" (
    echo     พบ PyInstaller ที่ %PYINSTALLER%
) else (
    echo     ลอง path ทั่วไป...
    set PYINSTALLER=pyinstaller
)

echo [2] Build HRBTC_Setup.exe ...
"%PYINSTALLER%" ^
    --onefile ^
    --windowed ^
    --name HRBTC_Setup ^
    --icon NONE ^
    --clean ^
    setup_wizard.py

echo.
if exist "dist\HRBTC_Setup.exe" (
    echo ============================================================
    echo   BUILD สำเร็จ!
    echo   ไฟล์: dist\HRBTC_Setup.exe
    echo ============================================================
    explorer dist
) else (
    echo BUILD ไม่สำเร็จ — ดู error ด้านบน
)
pause
