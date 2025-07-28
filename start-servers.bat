@echo off
echo ========================================
echo    BEVERAGE POS - SERVER STARTUP
echo ========================================
echo.

echo Starting WebSocket Server...
start "WebSocket Server" cmd /k "node scripts/premium-ws-server.js"

echo Waiting 2 seconds...
timeout /t 2 /nobreak > nul

echo Starting Next.js Development Server...
start "Next.js Dev Server" cmd /k "npm run dev"

echo.
echo ========================================
echo    ALL SERVERS STARTED!
echo ========================================
echo.
echo WebSocket Server: http://localhost:8081
echo Next.js App: http://localhost:3000
echo.
echo Press any key to close this window...
pause > nul 