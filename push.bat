@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo [1/5] Checking Environment...
echo ===================================================

where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not installed or not in PATH.
    pause
    exit /b
)

if not exist ".git" (
    echo [ERROR] This is not a Git repository.
    pause
    exit /b
)

:: Get current branch
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i
echo [OK] Current branch detected: %BRANCH%

echo.
echo ===================================================
echo [2/5] Staging Changes...
echo ===================================================
git add .
git status
echo.

echo ===================================================
echo [3/5] Commit Message...
echo ===================================================
set /p msg="Enter commit message (Press Enter for default: 'auto: update project'): "

if "%msg%"=="" (
    set msg=auto: update project
)

echo.
echo ===================================================
echo [4/5] Committing...
echo ===================================================
git commit -m "%msg%"
if %ERRORLEVEL% neq 0 (
    echo [INFO] Nothing to commit or commit failed.
) else (
    echo [OK] Committed: %msg%
)

echo.
echo ===================================================
echo [5/5] Pushing to GitHub...
echo ===================================================
echo Pushing to origin %BRANCH%...
git push origin %BRANCH%

if %ERRORLEVEL% eq 0 (
    echo.
    echo [SUCCESS] Push completed successfully to %BRANCH%!
) else (
    echo.
    echo [ERROR] Push failed. Please check your connection or remote settings.
)

echo.
echo ===================================================
pause
