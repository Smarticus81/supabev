import { NextRequest } from 'next/server';

// Ultra-fast in-memory cart storage for voice operations
const cartStorage = new Map<string, any[]>();

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