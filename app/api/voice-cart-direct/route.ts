import { NextRequest } from 'next/server';
import { invokeMcpToolDirect } from '../../../lib/mcp-direct';

// Import the enhanced event manager for real-time updates
let enhancedEventManager: any;
try {
  const { enhancedEventManager: eem } = require('../realtime/route');
  enhancedEventManager = eem;
} catch (error) {
  console.warn('Enhanced EventManager not available, real-time updates disabled');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, parameters } = body;
    const clientId = parameters?.clientId || 'default';

    console.log(`🚀 [DIRECT] Voice cart operation: ${tool} for client: ${clientId}`);

    // Use the direct MCP implementation for all operations
    const result = await invokeMcpToolDirect(tool, {
      ...parameters,
      clientId: clientId
    });

    // Broadcast real-time updates if available and result has cart data
    if (enhancedEventManager && 'cart' in result && Array.isArray(result.cart)) {
      const total = result.cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      enhancedEventManager.broadcast('cart_update', {
        items: result.cart,
        total: total,
        clientId: clientId
      });
      console.log(`📡 [BROADCAST] Cart update sent: ${result.cart.length} items, $${total.toFixed(2)}`);
    }

    return Response.json({
      success: !('error' in result),
      ...result,
      provider: 'mcp-direct'
    });

  } catch (error) {
    console.error('Error in voice cart direct API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
} 