@echo off
REM Setup environment variables for enhanced betting agent
REM Run this before running the props agent

echo ========================================
echo Setting up Betting Agent Environment
echo ========================================

REM Google Search API
set GOOGLE_SEARCH_API_KEY=AIzaSyBjrKXEOS_JiF7MtNPkliCTRWaYvRlDBbc
set GOOGLE_SEARCH_ENGINE_ID=a6a9783103e2c46de

echo [✓] Google Search API configured
echo.

REM Verify Playwright installation
echo Checking Playwright installation...
python -c "import playwright; print('[✓] Playwright installed')" 2>nul
if errorlevel 1 (
    echo [!] Playwright not found. Installing...
    pip install playwright
    playwright install chromium
    echo [✓] Playwright installed
)

echo.
echo ========================================
echo Environment Setup Complete!
echo ========================================
echo.
echo You can now run:
echo   python run_props_agent.py --sport NHL --picks 30
echo   python run_props_agent.py --sport CFB --picks 30
echo   python run_props_agent.py --sport MLB --picks 25
echo.
echo Press any key to continue...
pause >nul

