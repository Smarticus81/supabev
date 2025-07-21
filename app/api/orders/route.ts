import db from '../../../db/index';
import { orders, drinks } from '../../../db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  try {
    // Get orders from Neon database
    const allOrders = await db.select().from(orders).orderBy(desc(orders.created_at)).limit(50);

    // Format orders for display
    const formattedOrders = allOrders.map(order => {
      const items = JSON.parse(order.items);
      const formattedItems = items.map((item: any) => 
        `${item.name} x${item.quantity}`
      );

      // Calculate subtotal and tax (assuming 8.25% tax rate)
      const total = order.total / 100; // Convert from cents to dollars
      const subtotal = total / 1.0825; // Remove 8.25% tax
      const tax = total - subtotal;

      return {
        id: `TXN-${order.id.toString().padStart(3, '0')}`,
        customerName: 'Guest', // Default since we don't store customer name in orders yet
        items: formattedItems,
        total: total,
        tax: tax,
        subtotal: subtotal,
        paymentMethod: 'Credit Card', // Default
        status: order.status,
        timestamp: new Date(order.created_at || '').toLocaleString(),
        server: 'Bev AI', // Default server name
        rawItems: items // Include raw items for detailed view
      };
    });

    return new Response(JSON.stringify(formattedOrders), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch orders' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const orderData = await request.json();
    console.log('Received order data:', orderData);

    // Validate the order data
    if (!orderData.items || orderData.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Order must contain items' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate total in cents
    const totalInCents = Math.round(orderData.total * 100);

    // Create the order
    const [newOrder] = await db.insert(orders).values({
      items: JSON.stringify(orderData.items),
      total: totalInCents,
      status: 'completed'
    }).returning();

    // Update inventory for each item
    for (const item of orderData.items) {
      // Find the drink by name (since UI sends drink names)
      const [drink] = await db.select().from(drinks).where(eq(drinks.name, item.name)).limit(1);
      
      if (drink) {
        // Decrease inventory
        await db.update(drinks)
          .set({ inventory: Math.max(0, drink.inventory - item.quantity) })
          .where(eq(drinks.id, drink.id));
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      orderId: newOrder.id,
      message: 'Order completed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to process order:', error);
    return new Response(JSON.stringify({ error: 'Failed to process order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}