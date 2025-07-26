import db, { drinkCache, inventoryCache, getCachedData, setCachedData, clearCache } from '../db/index';
import { drinks, orders, customers, venues, eventBookings, inventory, transactions } from '../db/schema';
import { eq, like, desc, sql, and, gte, lte } from 'drizzle-orm';
import type { NewOrder, NewCustomer, NewEventBooking, NewTransaction } from '../db/schema';
import { inventoryService } from './inventory-service';
import { paymentService } from './payment-service';

// Cart state management (in-memory for voice sessions)
interface CartItem {
  drink_id: number;
  name: string;
  price: number;
  quantity: number;
}

const sessionCarts = new Map<string, CartItem[]>();

export class VoiceAgentService {
  private getSessionId(): string {
    // For now, use a default session. In production, you'd use actual session management
    return 'default_session';
  }

  public getCart(): CartItem[] {
    const sessionId = this.getSessionId();
    return sessionCarts.get(sessionId) || [];
  }

  private setCart(cart: CartItem[]): void {
    const sessionId = this.getSessionId();
    sessionCarts.set(sessionId, cart);
  }

  // 🍸 DRINK & CART MANAGEMENT
  async addDrinkToCart(drink_name: string, quantity: number = 1) {
    try {
      // Normalize drink name and search
      const normalizedName = drink_name.trim().toLowerCase();
      const cacheKey = `drink:${normalizedName}`;
      
      // Check cache first
      let foundDrink = getCachedData(cacheKey, drinkCache);
      
      if (!foundDrink) {
        // Search for drink (case-insensitive, partial match)
        const drink = await db.select()
          .from(drinks)
          .where(
            sql`LOWER(${drinks.name}) LIKE LOWER(${`%${normalizedName}%`}) AND is_active = true`
          )
          .limit(1);

        if (!drink.length) {
          return {
            success: false,
            message: `Drink "${drink_name}" not found. Please check the name and try again.`
          };
        }

        foundDrink = drink[0];
        // Cache the result
        setCachedData(cacheKey, foundDrink, drinkCache);
      }

      // Check inventory using inventory service
      const inventoryInfo = await inventoryService.getServingInfo(foundDrink.id);
      if (!inventoryInfo) {
        return {
          success: false,
          message: `Unable to get inventory information for ${foundDrink.name}.`
        };
      }

      if (inventoryInfo.currentInventory < quantity) {
        return {
          success: false,
          message: `Sorry, only ${inventoryInfo.currentInventory} units of ${foundDrink.name} available in stock.`
        };
      }

      // Add to cart
      const cart = this.getCart();
      const existingItem = cart.find(item => item.drink_id === foundDrink.id);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.push({
          drink_id: foundDrink.id,
          name: foundDrink.name,
          price: foundDrink.price,
          quantity
        });
      }

      this.setCart(cart);

      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        success: true,
        message: `Added ${quantity} ${foundDrink.name} to cart`,
        item: foundDrink.name,
        quantity,
        price: foundDrink.price / 100, // Convert cents to dollars
        cart_total: total / 100
      };
    } catch (error) {
      console.error('Error adding drink to cart:', error);
      return {
        success: false,
        message: 'Failed to add drink to cart'
      };
    }
  }

  async removeDrinkFromCart(drink_name: string, quantity: number = 1) {
    try {
      const cart = this.getCart();
      const itemIndex = cart.findIndex(item => 
        item.name.toLowerCase().includes(drink_name.toLowerCase())
      );

      if (itemIndex === -1) {
        return {
          success: false,
          message: `${drink_name} not found in cart`
        };
      }

      const item = cart[itemIndex];
      
      if (item.quantity <= quantity) {
        cart.splice(itemIndex, 1);
      } else {
        item.quantity -= quantity;
      }

      this.setCart(cart);

      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        success: true,
        message: `Removed ${quantity} ${item.name} from cart`,
        cart_total: total / 100
      };
    } catch (error) {
      console.error('Error removing drink from cart:', error);
      return {
        success: false,
        message: 'Failed to remove drink from cart'
      };
    }
  }

  async showCart() {
    try {
      const cart = this.getCart();
      
      if (cart.length === 0) {
        return {
          success: true,
          message: 'Cart is empty',
          items: [],
          total: 0
        };
      }

      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        success: true,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price / 100,
          subtotal: (item.price * item.quantity) / 100
        })),
        total: total / 100
      };
    } catch (error) {
      console.error('Error showing cart:', error);
      return {
        success: false,
        message: 'Failed to retrieve cart'
      };
    }
  }

  async clearCart() {
    try {
      this.setCart([]);
      return {
        success: true,
        message: 'Cart cleared'
      };
    } catch (error) {
      console.error('Error clearing cart:', error);
      return {
        success: false,
        message: 'Failed to clear cart'
      };
    }
  }

  async processOrder() {
    try {
      const cart = this.getCart();
      
      if (cart.length === 0) {
        return {
          success: false,
          message: 'Cart is empty'
        };
      }

      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.08; // Example 8% tax
      const total = subtotal + tax;
      
      // Create order with pending status initially
      const orderData: NewOrder = {
        items: cart.map(item => ({
          drink_id: item.drink_id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        subtotal,
        tax_amount: tax,
        total,
        status: 'processing',
        payment_status: 'pending'
      };

      const [newOrder] = await db.insert(orders).values(orderData).returning();

      // Process inventory deductions using simple, reliable inventory updates
      console.log(`📦 Processing inventory deductions for order ${newOrder.id}...`);
      
      const cartItems = cart.map(item => ({
        drinkId: item.drink_id,
        quantity: item.quantity,
        name: item.name
      }));

      const inventoryResult = await inventoryService.processOrderPours(
        newOrder.id,
        cartItems
      );

      if (!inventoryResult.success) {
        console.error('Error processing inventory deductions:', inventoryResult.errors || 'Unknown error');
        // Update order status to failed
        await db.update(orders)
          .set({ 
            status: 'cancelled',
            notes: `Inventory error: ${inventoryResult.errors ? inventoryResult.errors.join(', ') : 'Unknown error'}`
          })
          .where(eq(orders.id, newOrder.id));
        
        return {
          success: false,
          message: `Order failed: ${inventoryResult.errors ? inventoryResult.errors.join(', ') : 'Inventory update failed'}`
        };
      }

      console.log(`✅ Inventory updated successfully for ${cartItems.length} items`);

      // Process payment automatically (simplified approach for reliability)
      let paymentResult;
      let transactionId;
      
      try {
        console.log(`💳 Processing payment for order ${newOrder.id}...`);
        
        // Create transaction record directly for reliability
        const transactionData = {
          order_id: newOrder.id,
          transaction_type: 'sale',
          amount: total,
          payment_method: 'cash',
          payment_processor: 'voice_system',
          processor_transaction_id: `VOICE_${Date.now()}_${newOrder.id}`,
          status: 'completed',
          net_amount: total,
          processed_at: sql`NOW()`,
          created_at: sql`NOW()`
        };

        const [newTransaction] = await db.insert(transactions).values(transactionData).returning();
        transactionId = newTransaction.id;
        
        console.log(`✅ Transaction ${transactionId} created successfully`);
        paymentResult = { success: true, transactionId };
        
      } catch (error) {
        console.error('❌ Direct payment processing failed:', error);
        
        // Try the payment service as fallback
        try {
          paymentResult = await paymentService.autoProcessPayment(newOrder.id, 'cash');
          transactionId = paymentResult.transactionId;
        } catch (fallbackError) {
          console.error('❌ Fallback payment also failed:', fallbackError);
          
          // Update order status to failed
          await db.update(orders)
            .set({ 
              status: 'cancelled',
              payment_status: 'failed',
              notes: `Payment error: ${fallbackError instanceof Error ? fallbackError.message : 'Payment processing failed'}`
            })
            .where(eq(orders.id, newOrder.id));
          
          return {
            success: false,
            message: `Payment failed: ${fallbackError instanceof Error ? fallbackError.message : 'Payment processing failed'}`
          };
        }
      }
      
      if (!paymentResult.success) {
        console.error('Payment processing failed:', paymentResult.message);
        
        // Update order status to failed
        await db.update(orders)
          .set({ 
            status: 'cancelled',
            payment_status: 'failed',
            notes: `Payment error: ${paymentResult.message}`
          })
          .where(eq(orders.id, newOrder.id));
        
        return {
          success: false,
          message: `Payment failed: ${paymentResult.message}`
        };
      }

      // Update order to completed status
      await db.update(orders)
        .set({
          payment_status: 'completed',
          status: 'completed',
          payment_method: 'cash',
          updated_at: sql`NOW()`
        })
        .where(eq(orders.id, newOrder.id));

      console.log(`✅ Order ${newOrder.id} completed successfully`);

      // Clear cart
      this.setCart([]);

      return {
        success: true,
        message: `Order #${newOrder.id} processed successfully with payment of $${(total / 100).toFixed(2)}`,
        order_id: newOrder.id,
        transaction_id: transactionId,
        total: total / 100,
        items: cart.length,
        payment_method: 'cash'
      };
    } catch (error) {
      console.error('Error processing order:', error);
      return {
        success: false,
        message: 'Failed to process order'
      };
    }
  }

  // 🔍 SEARCH & INVENTORY  
  async searchDrinks(query: string) {
    try {
      const normalizedQuery = query.trim().toLowerCase();
      const cacheKey = `search:${normalizedQuery}`;
      
      // Check cache first
      let results = getCachedData(cacheKey, drinkCache);
      
      if (!results) {
        // Use consolidated inventory query to avoid duplicates
        results = await db.execute(
          sql`
            SELECT 
              MIN(id) as id,
              name,
              category,
              MIN(price) as price,
              SUM(inventory) as inventory,
              bool_and(is_active) as is_active
            FROM drinks
            WHERE (LOWER(name) LIKE LOWER(${`%${normalizedQuery}%`}) OR LOWER(category) LIKE LOWER(${`%${normalizedQuery}%`}))
            AND is_active = true
            GROUP BY name, category
            ORDER BY SUM(inventory) DESC
            LIMIT 10
          `
        );
        
        // Cache search results
        setCachedData(cacheKey, results, drinkCache);
      }

      return {
        success: true,
        drinks: results.rows.map((drink: any) => ({
          id: drink.id,
          name: drink.name,
          category: drink.category,
          price: drink.price / 100,
          inventory: drink.inventory,
          available: drink.inventory > 0
        }))
      };
    } catch (error) {
      console.error('Error searching drinks:', error);
      return {
        success: false,
        message: 'Failed to search drinks'
      };
    }
  }

  async getInventoryStatus(drink_name?: string) {
    try {
      if (drink_name) {
        // Find the drink first
        const [drink] = await db.select()
          .from(drinks)
          .where(sql`LOWER(${drinks.name}) LIKE LOWER(${`%${drink_name}%`})`)
          .limit(1);

        if (!drink) {
          return {
            success: false,
            message: `Drink "${drink_name}" not found`
          };
        }

        const inventoryInfo = await inventoryService.getRealTimeInventoryStatus(drink.id);
        if (!inventoryInfo.success || !inventoryInfo.drink) {
          return {
            success: false,
            message: `Unable to get inventory for ${drink_name}`
          };
        }

        return {
          success: true,
          drink: {
            id: inventoryInfo.drink.id,
            name: inventoryInfo.drink.name,
            category: inventoryInfo.drink.category,
            inventory: inventoryInfo.drink.inventory,
            servingSize: inventoryInfo.drink.servingSize,
            status: inventoryInfo.drink.inventory > 10 ? 'good' : 
                   inventoryInfo.drink.inventory > 0 ? 'low' : 'out_of_stock'
          }
        };
      }

      // Return all drinks with simple inventory information
      const allDrinks = await db.select().from(drinks).where(eq(drinks.is_active, true));
      const inventoryStatus = [];

      for (const drink of allDrinks) {
        inventoryStatus.push({
          id: drink.id,
          name: drink.name,
          category: drink.category,
          inventory: drink.inventory,
          status: drink.inventory > 10 ? 'good' : 
                 drink.inventory > 0 ? 'low' : 'out_of_stock'
        });
      }

      return {
        success: true,
        inventory: inventoryStatus
      };
    } catch (error) {
      console.error('Error getting inventory status:', error);
      return {
        success: false,
        message: 'Failed to get inventory status'
      };
    }
  }

  // 📊 ANALYTICS & REPORTING
  async getOrderAnalytics(date_range: string = 'today') {
    try {
      let dateFilter;
      const now = new Date();
      
      switch (date_range) {
        case 'today':
          dateFilter = gte(orders.created_at, new Date(now.getFullYear(), now.getMonth(), now.getDate()));
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = gte(orders.created_at, weekAgo);
          break;
        case 'month':
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          dateFilter = gte(orders.created_at, monthAgo);
          break;
        default:
          dateFilter = gte(orders.created_at, new Date(now.getFullYear(), now.getMonth(), now.getDate()));
      }

      const orderData = await db.select()
        .from(orders)
        .where(dateFilter);

      const totalRevenue = orderData.reduce((sum, order) => sum + order.total, 0);
      const avgOrderValue = orderData.length > 0 ? totalRevenue / orderData.length : 0;

      return {
        success: true,
        period: date_range,
        total_orders: orderData.length,
        total_revenue: totalRevenue / 100,
        average_order_value: avgOrderValue / 100,
        orders: orderData.map(order => ({
          id: order.id,
          total: order.total / 100,
          status: order.status,
          created_at: order.created_at
        }))
      };
    } catch (error) {
      console.error('Error getting order analytics:', error);
      return {
        success: false,
        message: 'Failed to get order analytics'
      };
    }
  }

  // 🎉 EVENT MANAGEMENT
  async listEventPackages() {
    try {
      // For now, return static packages since we removed the packages table
      const packages = [
        {
          id: 1,
          name: 'Bronze Package',
          description: 'Basic event package with standard bar service',
          price_per_person: 25.00,
          min_guests: 10,
          max_guests: 30,
          duration_hours: 3
        },
        {
          id: 2,
          name: 'Silver Package', 
          description: 'Enhanced package with premium drinks and appetizers',
          price_per_person: 45.00,
          min_guests: 15,
          max_guests: 50,
          duration_hours: 4
        },
        {
          id: 3,
          name: 'Gold Package',
          description: 'Premium package with top-shelf liquor and full catering',
          price_per_person: 75.00,
          min_guests: 20,
          max_guests: 80,
          duration_hours: 5
        },
        {
          id: 4,
          name: 'Platinum Package',
          description: 'Luxury package with exclusive venue access and personal bartender',
          price_per_person: 125.00,
          min_guests: 25,
          max_guests: 100,
          duration_hours: 6
        }
      ];

      return {
        success: true,
        packages
      };
    } catch (error) {
      console.error('Error listing event packages:', error);
      return {
        success: false,
        message: 'Failed to list event packages'
      };
    }
  }

  async bookEvent(packageName: string, guest_count: number, event_date: string, customer_name: string, customer_email?: string, customer_phone?: string) {
    try {
      // Split customer name
      const nameParts = customer_name.trim().split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ') || 'Guest';

      // Create or find customer
      let customer;
      if (customer_email) {
        const existingCustomer = await db.select()
          .from(customers)
          .where(eq(customers.email, customer_email))
          .limit(1);
        
        if (existingCustomer.length > 0) {
          customer = existingCustomer[0];
        }
      }

      if (!customer) {
        const customerData: NewCustomer = {
          first_name,
          last_name,
          email: customer_email,
          phone: customer_phone
        };

        const [newCustomer] = await db.insert(customers).values(customerData).returning();
        customer = newCustomer;
      }

      // Get default venue (you might want to make this selectable)
      const venue = await db.select()
        .from(venues)
        .limit(1);

      if (!venue.length) {
        return {
          success: false,
          message: 'No venues available for booking'
        };
      }

      // Create event booking
      const bookingData: NewEventBooking = {
        customer_id: customer.id,
        venue_id: venue[0].id,
        guest_count,
        event_date: event_date, // date string in YYYY-MM-DD format
        status: 'confirmed',
        notes: `Package: ${packageName}`
      };

      const [booking] = await db.insert(eventBookings).values(bookingData).returning();

      return {
        success: true,
        message: `Event booked successfully for ${customer_name}`,
        booking_id: booking.id,
        package: packageName,
        guest_count,
        event_date,
        venue: venue[0].name
      };
    } catch (error) {
      console.error('Error booking event:', error);
      return {
        success: false,
        message: 'Failed to book event'
      };
    }
  }
}

export const voiceAgentService = new VoiceAgentService();
