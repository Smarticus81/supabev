const WebSocket = require('ws');

class CartBroadcasterService {
  constructor() {
    this.clients = new Set();
  }

  addClient(ws) {
    this.clients.add(ws);
    console.log('Added WebSocket client to broadcaster, total clients:', this.clients.size);
  }

  removeClient(ws) {
    this.clients.delete(ws);
    console.log('Removed WebSocket client from broadcaster, total clients:', this.clients.size);
  }

  broadcastCartUpdate(cart) {
    console.log('Broadcasting cart update to', this.clients.size, 'clients');
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          // UI clients expect 'items' format
          if (client.isUIClient) {
            client.send(JSON.stringify({
              type: 'cart_update',
              items: cart
            }));
          } else {
            // Voice clients expect 'data.cart' format
            client.send(JSON.stringify({
              type: 'cart_update',
              data: {
                cart: cart,
                timestamp: Date.now()
              }
            }));
          }
        } catch (error) {
          console.error('Error sending cart update to client:', error);
        }
      } else {
        // Clean up disconnected clients
        this.clients.delete(client);
      }
    });
  }
}

// Export singleton instance
const cartBroadcaster = new CartBroadcasterService();
module.exports = { cartBroadcaster }; 