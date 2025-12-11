@echo off
echo Setting up auto-minify watcher...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Yarn is installed
where yarn >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Yarn is not installed!
    echo Please install Yarn from https://yarnpkg.com/
    echo Or run: npm install -g yarn
    pause
    exit /b 1
)

echo Installing dependencies with Yarn...
call yarn install

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Setup complete! Starting watcher...
    echo.
    call yarn watch
) else (
    echo.
    echo ERROR: Failed to install dependencies
    pause
)

