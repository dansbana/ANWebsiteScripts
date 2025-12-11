@echo off
echo Starting auto-minify watcher for LibraryScripts.js...
echo.
echo This will watch for changes and auto-minify on save.
echo Press Ctrl+C to stop.
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Dependencies not installed. Running setup...
    call setup-watcher.bat
    if %ERRORLEVEL% NEQ 0 (
        pause
        exit /b 1
    )
)

yarn watch
