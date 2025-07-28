const WebSocket = require('ws');

// Create WebSocket server on port 8081
const wss = new WebSocket.Server({ port: 8081 });
const clients = new Set();

console.log('🔌 [PREMIUM-WS] WebSocket server starting on port 8081...');

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`🔌 [PREMIUM-WS] Client connected. Total clients: ${clients.size}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    payload: { 
      message: 'Connected to premium WebSocket real-time system', 
      status: 'premium',
      clientCount: clients.size
    },
    timestamp: Date.now()
  }));

  // Handle incoming messages from clients
  ws.on('message', (msg) => {
    try {
      const message = JSON.parse(msg);
      console.log('🔌 [PREMIUM-WS] Received message:', message);
      
      // Handle client-initiated actions
      if (message.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'pong',
          payload: { timestamp: Date.now() },
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('🔌 [PREMIUM-WS] Message parse error:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 [PREMIUM-WS] Client disconnected. Total clients: ${clients.size}`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('🔌 [PREMIUM-WS] WebSocket error:', error);
    clients.delete(ws);
  });
});

// Function to broadcast messages to all connected clients
function broadcast(type, data) {
  const message = JSON.stringify({
    type,
    payload: data,
    timestamp: Date.now(),
    id: Math.random().toString(36).substr(2, 9)
  });

  console.log(`🔌 [PREMIUM-WS] Broadcasting ${type} to ${clients.size} clients:`, data);

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    } else {
      // Remove stale connections
      clients.delete(ws);
    }
  }
}

// Start heartbeat
setInterval(() => {
  const heartbeat = {
    type: 'heartbeat',
    payload: { 
      timestamp: Date.now(), 
      clients: clients.size,
      status: 'premium'
    },
    timestamp: Date.now()
  };

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(heartbeat));
    } else {
      clients.delete(ws);
    }
  }
}, 30000); // 30 seconds

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('🔌 [PREMIUM-WS] Shutting down WebSocket server...');
  wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔌 [PREMIUM-WS] Shutting down WebSocket server...');
  wss.close();
  process.exit(0);
});

console.log('🔌 [PREMIUM-WS] Premium WebSocket server is running on port 8081');

// Export for use in other modules
module.exports = { broadcast, wss, clients }; 