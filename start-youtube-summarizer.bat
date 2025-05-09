@echo off
echo ===================================
echo  YouTube Video Summarizer Launcher
echo ===================================
echo.

:: Set working directory
cd /d %~dp0

:: Check if Node.js process is already running
tasklist /fi "imagename eq node.exe" | find "node.exe" > nul
if %errorlevel% equ 0 (
    echo Node.js process already running...
) else (
    echo Starting development server...
    start cmd /k "npm run dev"

    :: Wait for server to start
    echo Waiting for server to start...
    timeout /t 5 /nobreak > nul
)

:: Open browser
echo Opening browser...
start http://localhost:3000

echo.
echo Application launched! Please use it in your browser.
echo To stop the server, close the command prompt window.
echo.
