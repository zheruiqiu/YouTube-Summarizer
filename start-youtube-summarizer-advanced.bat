@echo off
setlocal enabledelayedexpansion
title YouTube Video Summarizer Launcher

:: Copyright (c) 2025 Zherui Qiu
:: This file is part of YouTube AI Summarizer.
:: YouTube AI Summarizer is free software: you can redistribute it and/or modify
:: it under the terms of the MIT License.

echo ===================================
echo  YouTube Video Summarizer Launcher
echo ===================================
echo.

:: Set working directory
cd /d %~dp0

:: Check if .env file exists
if not exist .env (
    echo Warning: .env file not found. Creating a basic .env file.
    echo # You only need to add the API keys for the models you want to use > .env
    echo # At least one API key is required >> .env
    echo DEEPSEEK_API_KEY="your-deepseek-api-key" >> .env
    echo # GEMINI_API_KEY="your-gemini-api-key" >> .env
    echo # GROQ_API_KEY="your-groq-api-key" >> .env
    echo # OPENAI_API_KEY="your-openai-api-key" >> .env
    echo.
    echo Created .env file. Please edit this file and add your API keys.
    echo.
)

:: Check if Node.js process is already running
tasklist /fi "imagename eq node.exe" | find "node.exe" > nul
if %errorlevel% equ 0 (
    echo Node.js process already running...
) else (
    :: Check if dependencies need to be installed
    if not exist node_modules (
        echo First run, installing dependencies...
        call npm install
        if %errorlevel% neq 0 (
            echo Failed to install dependencies. Please check your network connection or run 'npm install' manually.
            pause
            exit /b 1
        )
    )

    :: Check if database is initialized
    if not exist prisma\dev.db (
        echo Initializing database...
        call npx prisma generate
        call npx prisma db push
    )

    echo Starting development server...
    start cmd /k "npm run dev"

    :: Wait for server to start
    echo Waiting for server to start...
    timeout /t 8 /nobreak > nul
)

:: Open browser
echo Opening browser...
start http://localhost:3000

echo.
echo Application launched! Please use it in your browser.
echo To stop the server, close the command prompt window.
echo.

:: Provide options
:menu
echo Options:
echo [1] Restart server
echo [2] Edit .env file to configure API keys
echo [3] Reopen browser
echo [4] Exit
echo.

set /p choice="Please select an option (1-4): "

if "%choice%"=="1" (
    taskkill /f /im node.exe > nul 2>&1
    echo Restarting server...
    start cmd /k "npm run dev"
    timeout /t 5 /nobreak > nul
    goto menu
) else if "%choice%"=="2" (
    start notepad .env
    goto menu
) else if "%choice%"=="3" (
    start http://localhost:3000
    goto menu
) else if "%choice%"=="4" (
    echo Exiting...
    exit /b 0
) else (
    echo Invalid choice, please try again.
    goto menu
)

endlocal
