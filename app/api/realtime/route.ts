import { NextRequest } from 'next/server';

// Enhanced Event Manager for real-time broadcasting
class EnhancedEventManager {
  private premiumWsModule: any = null;

  constructor() {
    // Try to load the WebSocket server module
    try {
      this.premiumWsModule = require('../../../scripts/premium-ws-server');
      console.log('📡 [ENHANCED-EM] Connected to WebSocket server module');
    } catch (error) {
      console.warn('📡 [ENHANCED-EM] Could not connect to WebSocket server module:', error);
    }
  }

  async broadcast(type: string, data: any) {
    try {
      console.log(`📡 [ENHANCED-EM] Broadcasting ${type}:`, data);
      
      // Try to broadcast via the WebSocket server
      if (this.premiumWsModule && this.premiumWsModule.broadcast) {
        this.premiumWsModule.broadcast(type, data);
        console.log(`📡 [ENHANCED-EM] Successfully broadcast ${type} via WebSocket`);
      } else {
        console.warn('📡 [ENHANCED-EM] WebSocket broadcast not available, using fallback');
        
        // Fallback: store for pickup by main page
        if (typeof global !== 'undefined') {
          (global as any).pendingCartUpdate = {
            type: type,
            payload: data,
            timestamp: Date.now()
          };
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('📡 [ENHANCED-EM] Broadcast error:', error);
      return { success: false, error };
    }
  }
}

// Create singleton instance
export const enhancedEventManager = new EnhancedEventManager();

// Simple API endpoint for WebSocket communication
export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();
    
    console.log(`🔌 [PREMIUM-WS] API update requested: ${type}`);
    
    // This endpoint can be used to send messages to the WebSocket server
    // The actual WebSocket server runs separately on port 8081
    
    return Response.json({ 
      success: true, 
      message: `Premium update requested: ${type}`,
      note: 'WebSocket server runs on port 8081'
    });
  } catch (error) {
    console.error('🔌 [PREMIUM-WS] API error:', error);
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// GET endpoint for health check
export async function GET(request: NextRequest) {
  return Response.json({ 
    status: 'premium-websocket-api',
    message: 'WebSocket server runs separately on port 8081',
    timestamp: Date.now()
  });
}