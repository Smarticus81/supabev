const { getDb } = require('../../../lib/db');
const fs = require('fs');
import path from 'path';

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