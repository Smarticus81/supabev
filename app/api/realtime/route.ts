import { NextRequest } from 'next/server';

// Enhanced real-time event manager with WebSocket support
class EnhancedRealTimeManager {
  private static instance: EnhancedRealTimeManager;
  private clients: Set<Response> = new Set();
  private wsClients: Set<any> = new Set();
  private messageQueue: any[] = [];
  private maxQueueSize = 100;

  static getInstance(): EnhancedRealTimeManager {
    if (!EnhancedRealTimeManager.instance) {
      EnhancedRealTimeManager.instance = new EnhancedRealTimeManager();
    }
    return EnhancedRealTimeManager.instance;
  }

  // Add SSE client
  addClient(response: Response) {
    this.clients.add(response);
    console.log(`📡 [SSE] Client connected. Total clients: ${this.clients.size}`);
    
    // Send recent messages to new client
    this.messageQueue.slice(-5).forEach(message => {
      this.sendToClient(response, message);
    });
  }

  // Remove SSE client
  removeClient(response: Response) {
    this.clients.delete(response);
    console.log(`📡 [SSE] Client disconnected. Total clients: ${this.clients.size}`);
  }

  // Add WebSocket client
  addWSClient(ws: any) {
    this.wsClients.add(ws);
    console.log(`🔌 [WS] WebSocket client connected. Total WS clients: ${this.wsClients.size}`);
    
    // Send recent messages to new WebSocket client
    this.messageQueue.slice(-5).forEach(message => {
      this.sendToWSClient(ws, message);
    });
  }

  // Remove WebSocket client
  removeWSClient(ws: any) {
    this.wsClients.delete(ws);
    console.log(`🔌 [WS] WebSocket client disconnected. Total WS clients: ${this.wsClients.size}`);
  }

  // Broadcast to all clients (SSE + WebSocket)
  broadcast(type: string, data: any) {
    const message = {
      type,
      payload: data,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };

    // Add to message queue
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue.shift();
    }

    console.log(`📡 [BROADCAST] ${type} to ${this.clients.size} SSE + ${this.wsClients.size} WS clients:`, data);

    // Send to SSE clients
    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });

    // Send to WebSocket clients
    this.wsClients.forEach(ws => {
      this.sendToWSClient(ws, message);
    });

    // Also trigger custom events on window for immediate local updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`realtime-${type}`, { detail: data }));
    }
  }

  private sendToClient(response: Response, message: any) {
    try {
      const writer = response.body?.getWriter();
      if (writer) {
        const data = `data: ${JSON.stringify(message)}\n\n`;
        writer.write(new TextEncoder().encode(data));
      }
    } catch (error) {
      console.error('📡 [SSE] Error sending to client:', error);
      this.clients.delete(response);
    }
  }

  private sendToWSClient(ws: any, message: any) {
    try {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(message));
      } else {
        this.wsClients.delete(ws);
      }
    } catch (error) {
      console.error('🔌 [WS] Error sending to WebSocket client:', error);
      this.wsClients.delete(ws);
    }
  }

  // Get current state for new connections
  getCurrentState() {
    return {
      messageQueue: this.messageQueue.slice(-10),
      clientCount: this.clients.size + this.wsClients.size,
      timestamp: Date.now()
    };
  }
}

// Export singleton instance
export const enhancedEventManager = EnhancedRealTimeManager.getInstance();

// SSE endpoint
export async function GET(request: NextRequest) {
  console.log('📡 [SSE] New SSE connection requested');

  const stream = new ReadableStream({
    start(controller) {
      console.log('📡 [SSE] Stream started');
      
      // Create mock response for compatibility
      const mockResponse = {
        body: {
          getWriter: () => ({
            write: (chunk: Uint8Array) => {
              controller.enqueue(chunk);
            }
          })
        }
      } as Response;

      // Add client to manager
      enhancedEventManager.addClient(mockResponse);

      // Send initial connection message
      const welcomeData = `data: ${JSON.stringify({
        type: 'connection',
        payload: { message: 'Connected to enhanced real-time updates', ...enhancedEventManager.getCurrentState() },
        timestamp: Date.now()
      })}\n\n`;
      
      controller.enqueue(new TextEncoder().encode(welcomeData));

      // Send periodic heartbeat
      const heartbeat = setInterval(() => {
        try {
          const heartbeatData = `data: ${JSON.stringify({
            type: 'heartbeat',
            payload: { timestamp: Date.now(), clients: enhancedEventManager.getCurrentState().clientCount },
            timestamp: Date.now()
          })}\n\n`;
          
          controller.enqueue(new TextEncoder().encode(heartbeatData));
        } catch (error) {
          console.error('📡 [SSE] Heartbeat error:', error);
          clearInterval(heartbeat);
          enhancedEventManager.removeClient(mockResponse);
        }
      }, 30000); // 30 seconds

      // Handle connection close
      request.signal.addEventListener('abort', () => {
        console.log('📡 [SSE] Connection aborted');
        clearInterval(heartbeat);
        enhancedEventManager.removeClient(mockResponse);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

// POST endpoint for manual broadcasting (for testing)
export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();
    
    console.log(`📡 [API] Manual broadcast requested: ${type}`);
    enhancedEventManager.broadcast(type, data);
    
    return Response.json({ 
      success: true, 
      message: `Broadcasted ${type} to ${enhancedEventManager.getCurrentState().clientCount} clients`,
      clientCount: enhancedEventManager.getCurrentState().clientCount
    });
  } catch (error) {
    console.error('📡 [API] Broadcast error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
} 