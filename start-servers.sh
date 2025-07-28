#!/bin/bash

echo "========================================"
echo "    BEVERAGE POS - SERVER STARTUP"
echo "========================================"
echo ""

echo "Starting WebSocket Server..."
gnome-terminal -- bash -c "node scripts/premium-ws-server.js; exec bash" 2>/dev/null || \
xterm -e "node scripts/premium-ws-server.js; exec bash" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd $(pwd) && node scripts/premium-ws-server.js"' 2>/dev/null || \
echo "Please start WebSocket server manually: node scripts/premium-ws-server.js"

echo "Waiting 3 seconds..."
sleep 3

echo "Starting Next.js Development Server..."
gnome-terminal -- bash -c "npm run dev; exec bash" 2>/dev/null || \
xterm -e "npm run dev; exec bash" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd $(pwd) && npm run dev"' 2>/dev/null || \
echo "Please start Next.js server manually: npm run dev"

echo ""
echo "========================================"
echo "    ALL SERVERS STARTED!"
echo "========================================"
echo ""
echo "WebSocket Server: http://localhost:8081"
echo "Next.js App: http://localhost:3000"
echo ""
echo "Press Enter to close this window..."
read 