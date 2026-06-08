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
echo [3/7] Updating .gitignore and untracking secrets...
:: Define required ignore entries
set "IGNORE_FILE=.gitignore"
set "REQUIRED_IGNORES=node_modules dist build .next coverage .turbo .vercel *.log .env .env.local .env.* artifacts/api-server/.env"

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

:: Untrack .env files if they were previously committed
git rm --cached artifacts/api-server/.env 2>nul
git rm --cached .env 2>nul
git rm --cached .env.local 2>nul
git rm --cached .env.development 2>nul
git rm --cached .env.production 2>nul

echo [OK] .gitignore is up to date and secrets are untracked.

echo.
echo [4/7] Adding and validating files...
:: We use 'git add .' which respects .gitignore
git add .
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to add files.
    pause
    exit /b
)

:: Protection check BEFORE commit
echo Checking for staged secrets...
set "STAGED_SECRETS="
for /f "tokens=*" %%i in ('git diff --cached --name-only') do (
    set "file=%%i"
    if "!file:~-4!"==".env" set "STAGED_SECRETS=1"
    if "!file!"==".env.local" set "STAGED_SECRETS=1"
    if "!file:~-4!"==".key" set "STAGED_SECRETS=1"
    if "!file:~-4!"==".pem" set "STAGED_SECRETS=1"
    
    :: Special check for the specific artifact env
    if "!file!"=="artifacts/api-server/.env" set "STAGED_SECRETS=1"
)

if "!STAGED_SECRETS!"=="1" (
    echo.
    echo **************************************************
    echo [CRITICAL ERROR] Secrets detected in staged files. 
    echo Push blocked to prevent security leak.
    echo Detected files:
    git diff --cached --name-only | findstr /i ".env .key .pem"
    echo **************************************************
    echo.
    echo Please remove these files from Git tracking and try again.
    pause
    exit /b
)

echo [OK] Files added safely (no secrets detected in staged files).

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
    echo [7/7] Pushing to GitHub (All Branches and Tags)...
    
    git push origin --all
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Pushing branches failed.
    )
    
    git push origin --tags
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Pushing tags failed.
    )

    if !ERRORLEVEL! neq 0 (
        echo.
        echo [ERROR] Push process had issues.
        echo Check your internet connection, remote configuration, and ensure you have permission to push.
        pause
        exit /b
    ) else (
        echo.
        echo [SUCCESS] Your changes have been pushed to GitHub successfully!
    )
)

echo.
echo =====================================================================
echo Process finished.
echo =====================================================================
pause
