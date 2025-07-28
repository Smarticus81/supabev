Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    BEVERAGE POS - SERVER STARTUP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting WebSocket Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node scripts/premium-ws-server.js" -WindowStyle Normal

Write-Host "Waiting 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Starting Next.js Development Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    ALL SERVERS STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "WebSocket Server: http://localhost:8081" -ForegroundColor Blue
Write-Host "Next.js App: http://localhost:3000" -ForegroundColor Blue
Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 