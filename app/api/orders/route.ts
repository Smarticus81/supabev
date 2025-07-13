const { getDb } = require('../../../lib/db');
const fs = require('fs');
import path from 'path';
const Database = require('better-sqlite3');
const path = require('path');

export async function GET() {
  let db;
  try {
    // Use the same database as MCP server
    const dbPath = path.join(process.cwd(), 'data', 'bar.db');
    db = new Database(dbPath, { readonly: true });
    
    // Get orders with items from MCP database
    const orders = db.prepare(`
      SELECT 
        id,
        customer_name,
        total_amount,
        status,
        created_at
      FROM orders 
      ORDER BY created_at DESC
      LIMIT 50
    `).all();

    // Get order items for each order
    const ordersWithItems = orders.map(order => {
      const items = db.prepare(`
        SELECT 
          drink_name,
          quantity,
          price,
          serving_name
        FROM order_items 
        WHERE order_id = ?
      `).all(order.id);

      // Format items for display
      const formattedItems = items.map(item => 
        `${item.drink_name} x${item.quantity}`
      );

      // Calculate subtotal and tax
      const subtotal = parseFloat(order.total_amount) / 1.08; // Remove 8% tax
      const tax = parseFloat(order.total_amount) - subtotal;

      return {
        id: `TXN-${order.id.toString().padStart(3, '0')}`,
        customerName: order.customer_name || 'Guest',
        items: formattedItems,
        total: parseFloat(order.total_amount),
        tax: tax,
        subtotal: subtotal,
        paymentMethod: 'Credit Card', // Default since we don't store this yet
        status: order.status || 'completed',
        timestamp: new Date(order.created_at).toLocaleString(),
        server: 'Bev AI', // Default server name
        rawItems: items // Include raw items for detailed view
      };
    });

    return new Response(JSON.stringify(ordersWithItems), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch orders' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (db) {
      db.close();
    }
  }
}

export async function POST(request: Request) {
  let db;
  try {
    db = await getDb();
    const order = await request.json();

    db.exec("BEGIN TRANSACTION;");

    const orderStmt = db.prepare("INSERT INTO orders (customer_name, total) VALUES (?, ?)");
    orderStmt.run(order.customerName || 'Guest', order.total);
    const orderId = db.exec("SELECT last_insert_rowid();")[0].values[0][0];
    orderStmt.free();

    const updateStmt = db.prepare("UPDATE drinks SET inventory_oz = inventory_oz - ?, sales_servings = sales_servings + ? WHERE id = ?");
    const insertStmt = db.prepare("INSERT INTO order_items (order_id, serving_option_id, quantity, price) VALUES (?, ?, ?, ?)");
    const servingStmt = db.prepare("SELECT drink_id, volume_oz FROM serving_options WHERE id = ?");

    for (const item of order.items) {
      insertStmt.run(orderId, item.serving_option_id, item.quantity, item.price);
      
      const servingInfo = servingStmt.get([item.serving_option_id]);
      if (servingInfo) {
        const [drinkId, volumeToDeduct] = servingInfo;
        const totalVolumeDeducted = volumeToDeduct * item.quantity;
        updateStmt.run(totalVolumeDeducted, item.quantity, drinkId);
      }
    }

    servingStmt.free();
    updateStmt.free();
    insertStmt.free();
    
    db.exec("COMMIT;");
    
    const data = db.export();
    const dbPath = path.join(process.cwd(), 'db', 'beverage-pos.sqlite');
    fs.writeFileSync(dbPath, Buffer.from(data));

    return new Response(JSON.stringify({ success: true, orderId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to process order:', error);
    if(db) db.exec("ROLLBACK;");
    return new Response(JSON.stringify({ error: 'Failed to process order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 