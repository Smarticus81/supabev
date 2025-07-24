import db from '../../../db/index';
import { orders, drinks } from '../../../db/schema';
import { desc, eq } from 'drizzle-orm';
import { simpleInventoryService } from '../../../lib/simple-inventory-service';

export async function GET() {
  try {
    // Get orders from Neon database with all new fields
    const allOrders = await db.select({
      id: orders.id,
      customer_id: orders.customer_id,
      staff_id: orders.staff_id,
      event_booking_id: orders.event_booking_id,
      order_number: orders.order_number,
      items: orders.items,
      subtotal: orders.subtotal,
      tax_amount: orders.tax_amount,
      total: orders.total,
      payment_method: orders.payment_method,
      payment_status: orders.payment_status,
      status: orders.status,
      table_number: orders.table_number,
      notes: orders.notes,
      discount_amount: orders.discount_amount,
      tip_amount: orders.tip_amount,
      created_at: orders.created_at,
      updated_at: orders.updated_at,
    }).from(orders).orderBy(desc(orders.created_at)).limit(50);

    // Format orders for display
    const formattedOrders = allOrders.map(order => {
      const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
      const formattedItems = items.map((item: any) => 
        `${item.name} x${item.quantity}`
      );

      // Use actual subtotal and tax from database, fallback to calculation if needed
      const total = (order.total || 0) / 100; // Convert from cents to dollars
      const subtotal = order.subtotal ? order.subtotal / 100 : total / 1.0825;
      const tax = order.tax_amount ? order.tax_amount / 100 : total - subtotal;
      const discount = order.discount_amount ? order.discount_amount / 100 : 0;
      const tip = order.tip_amount ? order.tip_amount / 100 : 0;

      return {
        id: order.order_number || `TXN-${order.id.toString().padStart(3, '0')}`,
        customerName: order.customer_id ? `Customer #${order.customer_id}` : 'Guest',
        items: formattedItems,
        total: total,
        tax: tax,
        subtotal: subtotal,
        discount: discount,
        tip: tip,
        paymentMethod: order.payment_method || 'Credit Card',
        paymentStatus: order.payment_status || 'completed',
        status: order.status,
        tableNumber: order.table_number,
        notes: order.notes,
        timestamp: new Date(order.created_at || '').toLocaleString(),
        server: order.staff_id ? `Staff #${order.staff_id}` : 'Bev AI',
        eventBookingId: order.event_booking_id,
        rawItems: items,
        created_at: order.created_at,
        updated_at: order.updated_at
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

    // Calculate totals
    let subtotal = 0;
    for (const item of orderData.items) {
      subtotal += (item.price || 0) * (item.quantity || 1);
    }
    
    const taxRate = 0.0825; // 8.25% tax rate
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    // Convert to cents for database
    const subtotalInCents = Math.round(subtotal * 100);
    const taxInCents = Math.round(taxAmount * 100);
    const totalInCents = Math.round(total * 100);

    // Create the order
    const [newOrder] = await db.insert(orders).values({
      items: JSON.stringify(orderData.items),
      subtotal: subtotalInCents,
      tax_amount: taxInCents,
      total: totalInCents,
      payment_method: orderData.payment_method || 'Credit Card',
      payment_status: 'completed',
      status: 'completed'
    }).returning();

    // Update inventory using simple inventory service
    try {
      console.log(`📦 Processing inventory updates for order ${newOrder.id}...`);
      
      // Map order items to the format expected by simpleInventoryService
      const inventoryItems = [];
      
      for (const item of orderData.items) {
        // Find the drink ID by name
        const [drink] = await db.select()
          .from(drinks)
          .where(eq(drinks.name, item.name))
          .limit(1);
          
        if (drink) {
          inventoryItems.push({
            drinkId: drink.id,
            quantity: item.quantity || 1,
            name: item.name
          });
        } else {
          console.warn(`⚠️  Drink not found: ${item.name}`);
        }
      }
      
      const inventoryResult = await simpleInventoryService.updateOrderInventory(
        newOrder.id,
        inventoryItems
      );
      
      if (inventoryResult.success) {
        console.log(`✅ Inventory updated successfully for ${inventoryResult.updates.length} items`);
      } else {
        console.error('❌ Inventory update failed:', inventoryResult.errors);
      }
    } catch (inventoryError) {
      console.error('❌ Inventory update failed:', inventoryError);
      // Log error but don't fail the order since it's already created
    }

    return new Response(JSON.stringify({ 
      success: true, 
      orderId: newOrder.id,
      message: 'Order completed successfully',
      total: total,
      tax: taxAmount,
      subtotal: subtotal
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Failed to process order:', error);
    return new Response(JSON.stringify({ error: 'Failed to process order', details: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}