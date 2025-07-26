import { eventManager } from '../realtime/route'

const MCP_SERVER_URL = 'http://localhost:7865'

async function callMCPServer(action, params = {}) {
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        ...params
      }),
      timeout: 5000
    })

    if (!response.ok) {
      throw new Error(`MCP Server error: ${response.status}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('MCP Server call failed:', error)
    throw error
  }
}

export async function GET() {
  try {
    const cartResult = await callMCPServer('cart_get')
    
    if (cartResult.success) {
      return Response.json({
        success: true,
        cart: cartResult.cart || { items: [], total: 0 },
        items: cartResult.cart?.items || []
      })
    } else {
      return Response.json({ 
        success: false, 
        error: cartResult.error || 'Failed to get cart',
        cart: { items: [], total: 0 },
        items: []
      })
    }
  } catch (error) {
    console.error('Error in voice-cart GET:', error)
    return Response.json({ 
      success: false, 
      error: 'Internal server error',
      cart: { items: [], total: 0 },
      items: []
    })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, item, itemId, quantity } = body
    
    let result
    
    switch (action) {
      case 'add':
        result = await callMCPServer('cart_add', {
          item_name: item.name,
          quantity: item.quantity || 1
        })
        
        // Broadcast cart update
        if (result.success) {
          const cartData = await callMCPServer('cart_get')
          eventManager.broadcast('cart_update', {
            items: cartData.cart?.items || [],
            total: cartData.cart?.total || 0
          })
        }
        break
        
      case 'remove':
        result = await callMCPServer('cart_remove', {
          item_id: itemId
        })
        
        // Broadcast cart update
        if (result.success) {
          const cartData = await callMCPServer('cart_get')
          eventManager.broadcast('cart_update', {
            items: cartData.cart?.items || [],
            total: cartData.cart?.total || 0
          })
        }
        break
        
      case 'update':
        result = await callMCPServer('cart_update_quantity', {
          item_id: itemId,
          quantity: quantity
        })
        
        // Broadcast cart update
        if (result.success) {
          const cartData = await callMCPServer('cart_get')
          eventManager.broadcast('cart_update', {
            items: cartData.cart?.items || [],
            total: cartData.cart?.total || 0
          })
        }
        break
        
      case 'clear':
        result = await callMCPServer('cart_clear')
        
        // Broadcast cart update
        if (result.success) {
          eventManager.broadcast('cart_update', {
            items: [],
            total: 0
          })
        }
        break
        
      case 'complete':
        result = await callMCPServer('process_order')
        
        // Broadcast order completion and cart clear
        if (result.success) {
          eventManager.broadcast('order_update', {
            type: 'order_completed',
            orderId: result.orderId
          })
          eventManager.broadcast('cart_update', {
            items: [],
            total: 0
          })
        }
        break
        
      default:
        return Response.json({ 
          success: false, 
          error: 'Invalid action' 
        })
    }
    
    return Response.json(result)
  } catch (error) {
    console.error('Error in voice-cart POST:', error)
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}

export async function DELETE() {
  try {
    const result = await callMCPServer('cart_clear')
    
    // Broadcast cart clear
    if (result.success) {
      eventManager.broadcast('cart_update', {
        items: [],
        total: 0
      })
    }
    
    return Response.json(result)
  } catch (error) {
    console.error('Error in voice-cart DELETE:', error)
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
} 