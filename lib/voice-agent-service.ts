import db from '../db/index';
import { drinks, orders, customers, venues, eventBookings, inventory, transactions } from '../db/schema';
import { eq, like, desc, sql, and, gte, lte } from 'drizzle-orm';
import type { NewOrder, NewCustomer, NewEventBooking, NewTransaction } from '../db/schema';

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
      const normalizedName = drink_name.trim();
      
      // Search for drink (case-insensitive, partial match)
      const drink = await db.select()
        .from(drinks)
        .where(
          sql`LOWER(${drinks.name}) LIKE LOWER(${`%${normalizedName}%`})`
        )
        .limit(1);

      if (!drink.length) {
        return {
          success: false,
          message: `Drink "${drink_name}" not found. Please check the name and try again.`
        };
      }

      const foundDrink = drink[0];

      // Check inventory
      if (foundDrink.inventory < quantity) {
        return {
          success: false,
          message: `Sorry, only ${foundDrink.inventory} ${foundDrink.name} available in stock.`
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

      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create order with proper schema
      const subtotal = Math.floor(total * 0.926); // Approximate subtotal before tax
      const tax_amount = total - subtotal;
      
      const orderData: NewOrder = {
        items: cart.map(item => ({
          drink_id: item.drink_id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        subtotal,
        tax_amount,
        total,
        status: 'completed',
        payment_status: 'completed'
      };

      const [newOrder] = await db.insert(orders).values(orderData).returning();

      // Update inventory
      for (const item of cart) {
        await db.update(drinks)
          .set({ inventory: sql`${drinks.inventory} - ${item.quantity}` })
          .where(eq(drinks.id, item.drink_id));
      }

      // Clear cart
      this.setCart([]);

      return {
        success: true,
        message: `Order #${newOrder.id} processed successfully`,
        order_id: newOrder.id,
        total: total / 100,
        items: cart.length
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
      // Use consolidated inventory query to avoid duplicates
      const results = await db.execute(
        sql`
          SELECT 
            MIN(id) as id,
            name,
            category,
            MIN(price) as price,
            SUM(inventory) as inventory,
            bool_and(is_active) as is_active
          FROM drinks
          WHERE (LOWER(name) LIKE LOWER(${`%${query}%`}) OR LOWER(category) LIKE LOWER(${`%${query}%`}))
          AND is_active = true
          GROUP BY name, category
          ORDER BY SUM(inventory) DESC
          LIMIT 10
        `
      );

      return {
        success: true,
        drinks: results.rows.map(drink => ({
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
        // Use the new database function for consolidated inventory
        const result = await db.execute(
          sql`SELECT * FROM get_drink_inventory(${drink_name})`
        );

        if (!result.rows.length) {
          return {
            success: false,
            message: `Drink "${drink_name}" not found`
          };
        }

        const drink = result.rows[0];
        return {
          success: true,
          drink: drink.name,
          inventory: drink.total_inventory,
          status: drink.status
        };
      }

      // Return all inventory
      const allDrinks = await db.select().from(drinks);
      
      return {
        success: true,
        inventory: allDrinks.map(drink => ({
          name: drink.name,
          category: drink.category,
          count: drink.inventory,
          status: drink.inventory > 5 ? 'good' : drink.inventory > 0 ? 'low' : 'out_of_stock'
        }))
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
        event_date: new Date(event_date),
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
