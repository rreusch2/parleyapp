@echo off
REM Quick Start Script for Player Headshot Ingestion (Windows)

echo ==================================
echo Player Headshot Ingestion
echo ==================================
echo.

REM Check if .env file exists
if not exist ".env" (
    echo WARNING: No .env file found!
    echo.
    echo Please create a .env file with your Supabase credentials:
    echo   1. Create a file named .env in this directory
    echo   2. Add these lines:
    echo      SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
    echo      SUPABASE_SERVICE_KEY=your_service_key_here
    echo.
    echo Get your service key from:
    echo https://supabase.com/dashboard/project/iriaegoipkjtktitpary/settings/api
    echo.
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if dependencies are installed
python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements_headshots.txt
)

REM Run test first
echo Running connection test...
echo.
python test_headshot_ingestion.py

if errorlevel 1 (
    echo.
    echo ERROR: Test failed. Please check your .env configuration.
    pause
    exit /b 1
)

echo.
echo ==================================
echo Test passed! Ready to proceed.
echo ==================================
echo.

set /p ANSWER="Start full headshot ingestion? (y/n): "
if /i "%ANSWER%"=="y" goto :run_ingestion
if /i "%ANSWER%"=="yes" goto :run_ingestion
goto :end

:run_ingestion
echo.
echo Starting headshot ingestion...
echo This may take 30-60 minutes depending on your connection.
echo.

python ingest_player_headshots.py

if errorlevel 1 (
    echo.
    echo ERROR: Ingestion failed
    pause
    exit /b 1
)

echo.
echo ==================================
echo Phase 1 Complete!
echo ==================================
echo.

set /p ANSWER2="Run Phase 2 (ESPN API fallback)? (y/n): "
if /i "%ANSWER2%"=="y" goto :run_phase2
if /i "%ANSWER2%"=="yes" goto :run_phase2
goto :end

:run_phase2
python ingest_headshots_espn_api.py

echo.
echo ==================================
echo All Phases Complete!
echo ==================================
echo.
pause
exit /b 0

:end
echo.
echo Cancelled. You can run manually with:
echo   python ingest_player_headshots.py
echo.
pause

