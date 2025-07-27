import { NextRequest } from 'next/server';

// Import the enhanced event manager for real-time updates
let enhancedEventManager: any;
try {
  const { enhancedEventManager: eem } = require('../realtime/route');
  enhancedEventManager = eem;
} catch (error) {
  console.warn('Enhanced EventManager not available, real-time updates disabled');
}

// Ultra-fast in-memory cart storage for voice operations
const cartStorage = new Map<string, any[]>();

// MCP Server URL for synchronization
const MCP_SERVER_URL = 'http://localhost:7865';

async function syncWithMCPServer(clientId: string, cart: any[]) {
  try {
    // Sync the cart state with MCP server to keep both systems aligned
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'cart_sync',
        clientId: clientId,
        cart: cart
      }),
      timeout: 1000 // Quick timeout to not block voice responses
    });
    
    if (response.ok) {
      console.log('🔄 [SYNC] Cart synchronized with MCP server');
    }
  } catch (error) {
    console.warn('⚠️ [SYNC] MCP server sync failed (non-blocking):', error.message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, parameters } = body;
    const clientId = parameters?.clientId || 'default';

    console.log(`🚀 [DIRECT] Voice cart operation: ${tool} for client: ${clientId}`);

    switch (tool) {
      case 'cart_add':
        return handleCartAdd(clientId, parameters);
      
      case 'cart_view':
        return handleCartView(clientId);
      
      case 'cart_clear':
        return handleCartClear(clientId);
      
      case 'cart_remove':
        return handleCartRemove(clientId, parameters);
      
      case 'cart_create_order':
        return handleCreateOrder(clientId, parameters);
      
      default:
        return Response.json({ error: 'Unknown tool' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in voice cart direct API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function broadcastCartUpdate(clientId: string, cart: any[]) {
  if (enhancedEventManager) {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    enhancedEventManager.broadcast('cart_update', {
      items: cart,
      total: total,
      clientId: clientId
    });
    console.log(`📡 [BROADCAST] Cart update sent: ${cart.length} items, $${total.toFixed(2)}`);
  }
  
  // Also sync with MCP server in the background (non-blocking)
  syncWithMCPServer(clientId, cart).catch(() => {
    // Silent fail - direct API should work even if MCP is down
  });
}

function handleCartAdd(clientId: string, params: any) {
  const { drink_name, quantity = 1 } = params;
  
  if (!drink_name) {
    return Response.json({ error: 'drink_name is required' }, { status: 400 });
  }

  const cart = cartStorage.get(clientId) || [];
  
  // Check if drink already exists in cart
  const existingIndex = cart.findIndex(item => item.name === drink_name);
  
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += quantity;
  } else {
    // Add new item with estimated price (real price would come from database)
    cart.push({
      name: drink_name,
      quantity: quantity,
      price: estimatePrice(drink_name), // Quick price estimation
      category: 'Beverage'
    });
  }

  cartStorage.set(clientId, cart);
  
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  console.log(`🛒 [DIRECT] Added ${quantity}x ${drink_name} to cart (${cart.length} items, $${total.toFixed(2)})`);

  // Broadcast real-time update
  broadcastCartUpdate(clientId, cart);

  return Response.json({
    success: true,
    message: `Added ${quantity}x ${drink_name} to cart`,
    cart: cart,
    total: total,
    item_count: cart.length
  });
}

function handleCartView(clientId: string) {
  const cart = cartStorage.get(clientId) || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  let cartText = '';
  if (cart.length === 0) {
    cartText = 'Your cart is empty.';
  } else {
    cartText = 'Current Cart:\n';
    cart.forEach(item => {
      const subtotal = item.price * item.quantity;
      cartText += `${item.quantity}x ${item.name} - $${subtotal.toFixed(2)}\n`;
    });
    cartText += `\nTotal: $${total.toFixed(2)}`;
  }

  return Response.json({
    success: true,
    content: [{ text: cartText }],
    cart: cart,
    total: total
  });
}

function handleCartClear(clientId: string) {
  cartStorage.set(clientId, []);
  
  // Broadcast real-time update
  broadcastCartUpdate(clientId, []);
  
  return Response.json({
    success: true,
    message: 'Cart cleared',
    cart: []
  });
}

function handleCartRemove(clientId: string, params: any) {
  const { drink_name, quantity = 1 } = params;
  const cart = cartStorage.get(clientId) || [];
  
  const existingIndex = cart.findIndex(item => item.name === drink_name);
  
  if (existingIndex >= 0) {
    cart[existingIndex].quantity -= quantity;
    if (cart[existingIndex].quantity <= 0) {
      cart.splice(existingIndex, 1);
    }
  }

  cartStorage.set(clientId, cart);
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Broadcast real-time update
  broadcastCartUpdate(clientId, cart);

  return Response.json({
    success: true,
    message: `Removed ${quantity}x ${drink_name} from cart`,
    cart: cart,
    total: total
  });
}

async function handleCreateOrder(clientId: string, params: any) {
  const cart = cartStorage.get(clientId) || [];
  
  if (cart.length === 0) {
    return Response.json({ error: 'Cart is empty' }, { status: 400 });
  }

  // Simulate order creation (in production, save to database)
  const orderId = Date.now();
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Clear cart after order
  cartStorage.set(clientId, []);
  
  console.log(`📦 [DIRECT] Order ${orderId} created with ${cart.length} items ($${total.toFixed(2)})`);

  // Broadcast order completion and cart clear
  if (enhancedEventManager) {
    enhancedEventManager.broadcast('order_update', {
      type: 'order_completed',
      orderId: orderId,
      total: total,
      items: cart
    });
    // Also broadcast cart clear
    broadcastCartUpdate(clientId, []);
  }

  return Response.json({
    success: true,
    message: `Order #${orderId} created successfully`,
    order_id: orderId,
    total: total,
    items: cart
  });
}

// Quick price estimation for ultra-fast response
function estimatePrice(drinkName: string): number {
  const name = drinkName.toLowerCase();
  
  // Basic price estimation based on drink type
  if (name.includes('beer') || name.includes('bud') || name.includes('miller') || name.includes('coors')) {
    return 5.50;
  }
  if (name.includes('wine') || name.includes('chardonnay') || name.includes('pinot')) {
    return 12.00;
  }
  if (name.includes('vodka') || name.includes('gin') || name.includes('rum') || name.includes('whiskey')) {
    return 8.50;
  }
  if (name.includes('cocktail') || name.includes('martini') || name.includes('margarita')) {
    return 14.00;
  }
  
  // Default price
  return 7.00;
} 