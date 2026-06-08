@echo off
setlocal enabledelayedexpansion

:: =====================================================================
:: Windows Push Script for Market-Intelligence-AI
:: This script helps you safely commit and push your changes to GitHub.
:: =====================================================================

echo.
echo [1/7] Checking Git installation...
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not installed. Please install Git from https://git-scm.com/
    pause
    exit /b
)
echo [OK] Git is installed.

echo.
echo [2/7] Checking Git repository...
if not exist ".git" (
    echo [INFO] Git repository not found. Initializing...
    git init
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to initialize Git repository.
        pause
        exit /b
    )
    echo [OK] Git repository initialized.
) else (
    echo [OK] Git repository already exists.
)

echo.
echo [3/7] Updating .gitignore...
:: Define required ignore entries
set "IGNORE_FILE=.gitignore"
set "REQUIRED_IGNORES=node_modules dist build .next coverage .turbo .vercel *.log .env .env.local .env.*"

:: Create .gitignore if it doesn't exist
if not exist "%IGNORE_FILE%" (
    echo # Git Ignore File > "%IGNORE_FILE%"
)

:: Safely add missing entries
for %%i in (%REQUIRED_IGNORES%) do (
    findstr /x /c:"%%i" "%IGNORE_FILE%" >nul 2>nul
    if !ERRORLEVEL! neq 0 (
        echo Adding %%i to %IGNORE_FILE%
        echo %%i >> "%IGNORE_FILE%"
    )
)
echo [OK] .gitignore is up to date.

echo.
echo [4/7] Adding files...
:: We use 'git add .' which respects .gitignore
git add .
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to add files.
    pause
    exit /b
)
echo [OK] Files added safely (secrets and build files excluded by .gitignore).

echo.
echo [5/7] Committing changes...
:: Fix for date format (handles some Windows localization issues)
for /f "tokens=1-4 delims=/-, " %%a in ('date /t') do (
    set "y=%%a" & set "m=%%b" & set "d=%%c"
    if "%%d" neq "" (set "y=%%c" & set "m=%%a" & set "d=%%b")
)
set "mydate=%y%-%m%-%d%"
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (set mytime=%%a:%%b)
set "COMMIT_MSG=Update: %mydate% %mytime%"

git commit -m "%COMMIT_MSG%"
if %ERRORLEVEL% neq 0 (
    echo [INFO] No changes to commit or commit failed.
) else (
    echo [OK] Changes committed with message: "%COMMIT_MSG%"
)

echo.
echo [6/7] Checking for remote branch...
git remote -v | findstr "origin" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] No GitHub remote "origin" detected.
    echo To push your code, you need to link this to a GitHub repository:
    echo 1. Create a new repository on https://github.com/
    echo 2. Run the following command in this terminal:
    echo    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    echo 3. Then run this script again.
    echo.
) else (
    echo [OK] Remote "origin" detected.
    echo.
    echo [7/7] Pushing to GitHub...
    
    :: Get current branch name
    for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%i
    
    git push origin !BRANCH!
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to push to GitHub. 
        echo Check your internet connection and ensure you have permission to push.
    ) else (
        echo [SUCCESS] Your changes have been pushed to GitHub successfully!
    )
)

echo.
echo =====================================================================
echo Process finished.
echo =====================================================================
pause
