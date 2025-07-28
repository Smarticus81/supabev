// Direct MCP functionality for Vercel deployment
// This replaces the separate MCP server process with direct database operations

import postgres from 'postgres';
import { eq, like, desc, sql, and, gte, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { drinks, orders } from '../db/schema';

// Ultra-fast in-memory cart storage for voice operations
const cartStorage = new Map<string, any[]>();

class MCPDirect {
  private db: any;
  private client: any;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Initialize database connection
    this.client = postgres(process.env.DATABASE_URL, {
      prepare: false,
      ssl: 'require',
    });
    this.db = drizzle(this.client);
  }

  async invokeTool(toolName: string, params: any = {}) {
    console.log(`🔧 [MCP-DIRECT] Invoking tool: ${toolName} with params:`, params);

    try {
      switch (toolName) {
        case 'add_drink_to_cart':
        case 'cart_add':
          return await this.cartAdd({
            clientId: params.clientId || 'default',
            drink_name: params.drink_name,
            serving_name: params.serving_name || 'bottle',
            quantity: params.quantity || 1
          });

        case 'cart_view':
          return this.cartView({
            clientId: params.clientId || 'default'
          });

        case 'clear_cart':
        case 'cart_clear':
          return this.cartClear({
            clientId: params.clientId || 'default'
          });

        case 'remove_drink_from_cart':
        case 'cart_remove':
          return this.cartRemove({
            clientId: params.clientId || 'default',
            drink_name: params.drink_name,
            quantity: params.quantity
          });

        case 'process_order':
        case 'cart_create_order':
          return await this.cartCreateOrder({
            clientId: params.clientId || 'default',
            customer_name: params.customer_name
          });

        case 'search_drinks':
          return await this.searchDrinks(params);

        case 'list_drinks':
          return await this.viewMenu(params);

        case 'check_inventory':
        case 'get_inventory_status':
          return await this.checkInventory(params);

        case 'health_check':
          return this.healthCheck();

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`❌ [MCP-DIRECT] Error in tool ${toolName}:`, error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async cartAdd(params: any) {
    const { clientId, drink_name, quantity = 1, serving_name = 'bottle' } = params;

    console.log('🛒 [MCP-DIRECT] cartAdd called with:', {
      clientId,
      drink_name,
      quantity,
      serving_name
    });

    if (!clientId || !drink_name) {
      return { error: 'clientId and drink_name are required' };
    }

    try {
      // Verify drink exists and get price
      const drinkResult = await this.db.select({
        name: drinks.name,
        price: drinks.price
      }).from(drinks).where(
        eq(sql`LOWER(${drinks.name})`, drink_name.toLowerCase())
      ).limit(1);

      if (drinkResult.length === 0) {
        return { error: `Drink "${drink_name}" not found` };
      }

      const drink = drinkResult[0];
      const priceInDollars = drink.price / 100; // Convert cents to dollars

      // Get or create cart for client
      if (!cartStorage.has(clientId)) {
        console.log('🆕 Creating new cart for clientId:', clientId);
        cartStorage.set(clientId, []);
      }

      const cart = cartStorage.get(clientId) || [];
      console.log('🛒 Current cart before adding:', cart);

      // Check if item already in cart
      const existingItem = cart.find(item =>
        item.drink_name.toLowerCase() === drink.name.toLowerCase() &&
        item.serving_name === serving_name
      );

      if (existingItem) {
        existingItem.quantity += quantity;
        console.log('📈 Updated existing item quantity:', existingItem);
      } else {
        const newItem = {
          drink_name: drink.name,
          quantity,
          price: priceInDollars,
          serving_name
        };
        cart.push(newItem);
        console.log('➕ Added new item to cart:', newItem);
      }

      console.log('🛒 Cart after adding:', cart);

      return {
        success: true,
        message: `Added ${quantity} ${drink.name} to cart`,
        cart: [...cart],
        clientId: clientId
      };
    } catch (error) {
      console.error('❌ Error in cartAdd:', error);
      return { error: 'Failed to add item to cart' };
    }
  }

  cartView(params: any) {
    const { clientId } = params;

    if (!clientId) {
      return { error: 'clientId is required' };
    }

    try {
      const cart = cartStorage.get(clientId) || [];

      if (cart.length === 0) {
        return {
          success: true,
          cart: [],
          content: [{ text: 'Your cart is empty.' }]
        };
      }

      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      // Format cart text for voice response
      let cartText = 'Current Cart:\n';
      cart.forEach(item => {
        const subtotal = item.price * item.quantity;
        cartText += `${item.quantity}x ${item.drink_name} - $${subtotal.toFixed(2)}\n`;
      });
      cartText += `\nTotal: $${totalPrice.toFixed(2)}`;

      return {
        success: true,
        cart: [...cart],
        totalItems,
        totalPrice: totalPrice.toFixed(2),
        content: [{ text: cartText }]
      };
    } catch (error) {
      console.error('❌ Error in cartView:', error);
      return { error: 'Failed to view cart' };
    }
  }

  cartClear(params: any) {
    const { clientId } = params;

    if (!clientId) {
      return { error: 'clientId is required' };
    }

    try {
      cartStorage.set(clientId, []);
      return {
        success: true,
        message: 'Cart cleared',
        cart: []
      };
    } catch (error) {
      console.error('❌ Error in cartClear:', error);
      return { error: 'Failed to clear cart' };
    }
  }

  cartRemove(params: any) {
    const { clientId, drink_name, quantity } = params;

    if (!clientId || !drink_name) {
      return { error: 'clientId and drink_name are required' };
    }

    try {
      const cart = cartStorage.get(clientId) || [];
      const itemIndex = cart.findIndex(item =>
        item.drink_name.toLowerCase() === drink_name.toLowerCase()
      );

      if (itemIndex === -1) {
        return { error: `${drink_name} not found in cart` };
      }

      if (quantity && quantity > 0) {
        // Remove specific quantity
        cart[itemIndex].quantity -= quantity;
        if (cart[itemIndex].quantity <= 0) {
          cart.splice(itemIndex, 1);
        }
      } else {
        // Remove entire item
        cart.splice(itemIndex, 1);
      }

      return {
        success: true,
        message: `Removed ${drink_name} from cart`,
        cart: [...cart]
      };
    } catch (error) {
      console.error('❌ Error in cartRemove:', error);
      return { error: 'Failed to remove item from cart' };
    }
  }

  async cartCreateOrder(params: any) {
    const { clientId, customer_name } = params;

    if (!clientId) {
      return { error: 'clientId is required' };
    }

    try {
      const cart = cartStorage.get(clientId) || [];

      if (cart.length === 0) {
        return { error: 'Cart is empty' };
      }

      // Create order from cart
      const result = await this.createOrder({
        items: cart,
        customer_name,
        payment_method: 'cash'
      });

      if (result.success) {
        // Clear cart after successful order
        cartStorage.set(clientId, []);
      }

      return result;
    } catch (error) {
      console.error('❌ Error in cartCreateOrder:', error);
      return { error: 'Failed to create order from cart' };
    }
  }

  async createOrder(params: any) {
    const { items, customer_name, payment_method = 'cash' } = params;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { error: 'items array is required and cannot be empty' };
    }

    try {
      // Calculate totals
      let subtotal = 0;
      for (const item of items) {
        const drinkResult = await this.db.select({
          price: drinks.price
        }).from(drinks).where(
          eq(sql`LOWER(${drinks.name})`, item.drink_name.toLowerCase())
        ).limit(1);
        
        const priceInCents = drinkResult[0].price;
        subtotal += item.quantity * priceInCents;
      }

      const tax = Math.round(subtotal * 0.08); // 8% tax
      const total = subtotal + tax;

      // Prepare items for JSON storage
      const orderItems = [];
      for (const item of items) {
        const drinkResult = await this.db.select({
          price: drinks.price
        }).from(drinks).where(
          eq(sql`LOWER(${drinks.name})`, item.drink_name.toLowerCase())
        ).limit(1);
        
        const priceInCents = drinkResult[0].price;

        orderItems.push({
          name: item.drink_name,
          quantity: item.quantity,
          price: priceInCents,
          total: priceInCents * item.quantity
        });
      }

      // Create order in database
      const orderResult = await this.db.insert(orders).values({
        customer_id: null,
        subtotal: subtotal,
        tax_amount: tax,
        total: total,
        payment_method: payment_method,
        payment_status: 'completed',
        status: 'completed',
        order_number: `ORD-${Date.now()}`,
        items: orderItems,
        created_at: new Date()
      }).returning({
        id: orders.id,
        order_number: orders.order_number
      });

      const orderId = orderResult[0].id;
      const orderNumber = orderResult[0].order_number;

      return {
        success: true,
        order_id: orderId,
        order_number: orderNumber,
        subtotal: (subtotal / 100).toFixed(2),
        tax: (tax / 100).toFixed(2),
        total: (total / 100).toFixed(2),
        payment_method: payment_method,
        message: `Order ${orderNumber} created successfully`
      };

    } catch (error) {
      console.error(`❌ Transaction error in createOrder:`, error);
      return {
        success: false,
        error: `Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async searchDrinks(params: any) {
    const { query, category, max_results = 10 } = params;

    try {
      let dbQuery;

      if (query && category) {
        dbQuery = this.db.select().from(drinks).where(
          and(
            eq(drinks.is_active, true),
            eq(sql`LOWER(${drinks.category})`, category.toLowerCase()),
            sql`(LOWER(${drinks.name}) LIKE ${'%' + query.toLowerCase() + '%'} OR LOWER(${drinks.subcategory}) LIKE ${'%' + query.toLowerCase() + '%'})`
          )
        ).orderBy(drinks.category, drinks.name).limit(max_results);
      } else if (query) {
        dbQuery = this.db.select().from(drinks).where(
          and(
            eq(drinks.is_active, true),
            sql`(LOWER(${drinks.name}) LIKE ${'%' + query.toLowerCase() + '%'} OR LOWER(${drinks.category}) LIKE ${'%' + query.toLowerCase() + '%'} OR LOWER(${drinks.subcategory}) LIKE ${'%' + query.toLowerCase() + '%'})`
          )
        ).orderBy(drinks.category, drinks.name).limit(max_results);
      } else if (category) {
        dbQuery = this.db.select().from(drinks).where(
          and(
            eq(drinks.is_active, true),
            eq(sql`LOWER(${drinks.category})`, category.toLowerCase())
          )
        ).orderBy(drinks.name).limit(max_results);
      } else {
        dbQuery = this.db.select().from(drinks).where(
          eq(drinks.is_active, true)
        ).orderBy(drinks.category, drinks.name).limit(max_results);
      }

      const result = await dbQuery;
      const formattedDrinks = result.map((drink: any) => ({
        name: drink.name,
        category: drink.category,
        subcategory: drink.subcategory,
        price: drink.price / 100, // Convert cents to dollars
        inventory: drink.inventory
      }));

      return {
        success: true,
        drinks: formattedDrinks,
        total_found: formattedDrinks.length,
        search_query: query,
        category_filter: category
      };
    } catch (error) {
      console.error('❌ Error in searchDrinks:', error);
      return {
        success: false,
        error: `Failed to search drinks: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async viewMenu(params: any = {}) {
    try {
      const result = await this.db.select().from(drinks).where(
        eq(drinks.is_active, true)
      ).orderBy(drinks.category, drinks.name);

      const formattedDrinks = result.map((drink: any) => ({
        name: drink.name,
        category: drink.category,
        subcategory: drink.subcategory,
        price: drink.price / 100, // Convert cents to dollars
        inventory: drink.inventory
      }));

      return {
        success: true,
        drinks: formattedDrinks,
        message: `Menu contains ${formattedDrinks.length} drinks`
      };
    } catch (error) {
      console.error('❌ Error in viewMenu:', error);
      return { error: 'Failed to view menu' };
    }
  }

  async checkInventory(params: any) {
    const { drink_name } = params;

    if (!drink_name) {
      return { error: 'drink_name is required' };
    }

    try {
      const result = await this.db.select().from(drinks).where(
        and(
          eq(sql`LOWER(${drinks.name})`, drink_name.toLowerCase()),
          eq(drinks.is_active, true)
        )
      ).limit(1);

      if (result.length === 0) {
        return {
          success: false,
          error: `Drink "${drink_name}" not found in inventory`
        };
      }

      const drink = result[0];
      return {
        success: true,
        id: drink.id,
        name: drink.name,
        inventory: drink.inventory || 0,
        category: drink.category,
        subcategory: drink.subcategory,
        price: drink.price / 100,
        message: `Current inventory for ${drink.name}: ${drink.inventory} units`
      };
    } catch (error) {
      console.error('❌ Database error in checkInventory:', error);
      return {
        success: false,
        error: `Database error while checking inventory: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  healthCheck() {
    try {
      return {
        success: true,
        status: 'healthy',
        database: 'connected',
        carts: cartStorage.size,
        timestamp: new Date().toISOString(),
        provider: 'mcp-direct'
      };
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Singleton instance
let mcpDirectInstance: MCPDirect | null = null;

export function getMCPDirect(): MCPDirect {
  if (!mcpDirectInstance) {
    mcpDirectInstance = new MCPDirect();
  }
  return mcpDirectInstance;
}

export async function invokeMcpToolDirect(toolName: string, params: any = {}) {
  const mcpDirect = getMCPDirect();
  return await mcpDirect.invokeTool(toolName, params);
}
