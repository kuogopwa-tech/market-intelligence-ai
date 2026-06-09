@echo off
setlocal enabledelayedexpansion

:: Ensure we are in the project root
cd /d "%~dp0"

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

:: Verify GitHub remote exists
git remote get-url origin >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] GitHub remote 'origin' is missing.
    echo Please add it using: git remote add origin ^<url^>
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

:: Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2% %datetime:~8,2%:%datetime:~10,2%:%datetime:~12,2%

set msg=auto: update %TIMESTAMP%

echo.
echo ===================================================
echo [4/5] Committing...
echo ===================================================
git commit -m "%msg%" || echo [INFO] Nothing to commit or commit failed.

echo.
echo ===================================================
echo [5/5] Pushing to GitHub...
echo ===================================================
echo Pushing to origin main...
git push origin main

if %ERRORLEVEL% eq 0 (
    echo.
    echo [SUCCESS] Push completed successfully to main!
    for /f "tokens=*" %%h in ('git rev-parse HEAD') do set COMMIT_HASH=%%h
    echo Current commit: %COMMIT_HASH%
) else (
    echo.
    echo [ERROR] Push failed. Please check your connection or remote settings.
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
