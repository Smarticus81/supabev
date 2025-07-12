const { getDb, saveDb } = require('./db');

// Get available drinks from database
function getAvailableDrinks() {
  try {
    const db = getDb();
    const drinks = db.prepare('SELECT name FROM drinks').all();
    return drinks.map(d => d.name);
  } catch (error) {
    console.error('Error getting drinks from database:', error);
    return [];
  }
}

// Describe available tools
const tools = [
  {
    name: 'list_drinks',
    description: 'Return all drinks with nested serving options',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_drink',
    description: 'Return a single drink (and its serving options) by id or name',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'drink.id' },
        name: { type: 'string', description: 'drink.name' }
      },
    },
  },
  {
    name: 'create_order',
    description: 'Create a new order with a list of drinks and quantities',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              drink_name: { type: 'string', description: 'Name of the drink' },
              serving_name: { type: 'string', description: 'Name of the serving size (e.g., "shot", "glass")' },
              quantity: { type: 'integer' }
            },
            required: ['drink_name', 'serving_name', 'quantity']
          }
        },
        customer_name: { type: 'string' }
      },
      required: ['items']
    }
  },
  {
    name: 'get_order',
    description: 'Retrieves the full details of a specific order, including all items.',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'integer', description: 'The ID of the order to retrieve.' }
      },
      required: ['order_id']
    }
  },
  {
    name: 'cancel_order',
    description: 'Cancels an entire order, deleting it and restoring inventory.',
    parameters: {
        type: 'object',
        properties: {
            order_id: { type: 'integer', description: 'The ID of the order to cancel.' }
        },
        required: ['order_id']
    }
  },
  {
      name: 'check_inventory',
      description: 'Gets the current inventory level for a specific drink.',
      parameters: {
          type: 'object',
          properties: {
              drink_name: { type: 'string', description: 'The name of the drink to check.' }
          },
          required: ['drink_name']
      }
  },
  {
      name: 'update_inventory',
      description: 'Sets the inventory for a drink to a specific amount in ounces.',
      parameters: {
          type: 'object',
          properties: {
              drink_name: { type: 'string', description: 'The name of the drink to update.' },
              inventory_oz: { type: 'number', description: 'The new inventory amount in fluid ounces.' }
          },
          required: ['drink_name', 'inventory_oz']
      }
  },
  {
      name: 'greeting',
      description: 'Returns a greeting string',
      parameters: { type: 'object', properties: {} }
   },
   {
      name: 'order_drink',
      description: 'Alias for create_order with a single item',
      parameters: {
        type: 'object',
        properties: {
          drink_name: { type: 'string' },
          serving_name: { type: 'string' },
          quantity: { type: 'integer' },
          customer_name: { type: 'string' }
        },
        required: ['drink_name','serving_name','quantity']
      }
   },
   {
      name: 'multi_drink_order',
      description: 'Alias for create_order with many items',
      parameters: {
        type: 'object',
        properties: {
          items:{ type:'array', items:{type:'object'}},
          customer_name:{type:'string'}
        },
        required:['items']
      }
   },
   {
      name: 'complete_order',
      description: 'Gets details of an order by id',
      parameters: {
        type:'object', properties:{ order_id:{type:'integer'}}, required:['order_id']
      }
   },
   {
       name: 'view_menu',
       description: 'Lists all available drinks, same as list_drinks',
       parameters: { type: 'object', properties: {} }
   },
   {
       name: 'stop_listening',
       description: 'A non-op tool to stop the assistant from listening',
       parameters: { type: 'object', properties: {} }
   },
   {
       name: 'repeat_last',
       description: 'A non-op tool to repeat the last response',
       parameters: { type: 'object', properties: {} }
   }
];

/** Helper to query drink with nested serving options */
async function fetchDrink(db, { id, name }) {
  let drinkRes;
  if (id) {
    const drinkStmt = db.prepare(`SELECT * FROM drinks WHERE id = ?`);
    drinkRes = drinkStmt.get([id]);
  } else if (name) {
    const drinkStmt = db.prepare(`SELECT * FROM drinks WHERE name = ?`);
    drinkRes = drinkStmt.get([name]);
  } else {
    return null;
  }

  if (!drinkRes) return null;

  const servingStmt = db.prepare(`SELECT name, volume_oz, price FROM serving_options WHERE drink_id = ?`);
  const servingRows = servingStmt.all([drinkRes.id]);
  drinkRes.serving_options = servingRows;
  return drinkRes;
}

/** Recalculates and updates an order's subtotal, tax, and total based on its items */
function recalculateOrderTotals(db, orderId) {
    const items = db.exec(`SELECT quantity, price FROM order_items WHERE order_id = ${orderId}`)[0].values;
    const subtotal = items.reduce((acc, [quantity, price]) => acc + (quantity * price), 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    db.run('UPDATE orders SET subtotal = ?, tax = ?, total = ? WHERE id = ?', [subtotal, tax, total, orderId]);
    return { subtotal, tax, total };
}

let lastResponse = "I don't have anything to repeat yet.";

async function invoke(name, params) {
  const db = await getDb();
  let result;
  switch (name) {
    case 'list_drinks': {
      // Flatten drinks
      const rows = db.exec(`SELECT * FROM drinks`)[0];
      if (!rows) return [];
      const cols = rows.columns;
      const drinks = rows.values.map(v => {
        const drink = {};
        cols.forEach((c, i) => {
          drink[c] = v[i];
        });
        return drink;
      });
      // attach serving options for each drink
      const servingStmt = db.prepare(`SELECT drink_id, name, volume_oz, price FROM serving_options`);
      const allServing = [];
      while (servingStmt.step()) {
        allServing.push(servingStmt.get());
      }
      servingStmt.free();
      const byDrink = {};
      allServing.forEach(r => {
        const sid = r[0];
        if (!byDrink[sid]) byDrink[sid] = [];
        byDrink[sid].push({ name: r[1], volume_oz: r[2], price: r[3] });
      });
      drinks.forEach(d => { d.serving_options = byDrink[d.id] || []; });
      result = drinks;
      break;
    }
    case 'get_drink': {
      result = await fetchDrink(db, params);
      break;
    }
    case 'create_order': {
      const { items, customer_name } = params;
      if (!Array.isArray(items)) {
        throw new Error('The "items" parameter must be an array.');
      }
      const getServingOptionStmt = db.prepare(`
        SELECT so.id, so.price, so.volume_oz, d.inventory_oz, d.id as drink_id
        FROM serving_options so
        JOIN drinks d ON so.drink_id = d.id
        WHERE d.name = ? AND so.name = ?
      `);
      
      const getFirstServingOptionStmt = db.prepare(`
        SELECT so.id, so.price, so.volume_oz, d.inventory_oz, d.id as drink_id, so.name as serving_name
        FROM serving_options so
        JOIN drinks d ON so.drink_id = d.id
        WHERE d.name = ?
        ORDER BY so.id
        LIMIT 1
      `);
      
      const findSimilarDrinkStmt = db.prepare(`
        SELECT d.name
        FROM drinks d
        WHERE d.name LIKE ?
        ORDER BY LENGTH(d.name)
        LIMIT 1
      `);
      
      const findFuzzyDrinkStmt = db.prepare(`
        SELECT d.name, 
        CASE 
          WHEN LOWER(d.name) = LOWER(?) THEN 100
          WHEN LOWER(d.name) LIKE LOWER(?) THEN 90
          WHEN LOWER(d.name) LIKE LOWER(?) THEN 80
          WHEN LOWER(d.name) LIKE LOWER(?) THEN 70
          ELSE 0
        END as score
        FROM drinks d
        WHERE score > 0
        ORDER BY score DESC, LENGTH(d.name)
        LIMIT 1
      `);

      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        let servingOption;
        let actualDrinkName = item.drink_name;
        
        // First try exact match
        if (item.serving_name) {
          servingOption = getServingOptionStmt.get(actualDrinkName, item.serving_name);
        } else {
          servingOption = getFirstServingOptionStmt.get(actualDrinkName);
        }
        
        // If no exact match, try enhanced fuzzy matching
        if (!servingOption) {
          const fuzzyResult = findFuzzyDrinkStmt.get(
            actualDrinkName,                    // exact match
            `${actualDrinkName}%`,              // starts with
            `%${actualDrinkName}%`,             // contains
            `%${actualDrinkName.replace(/\s+/g, '%')}%`  // words contained
          );
          
          if (fuzzyResult && fuzzyResult.score >= 70) {
            actualDrinkName = fuzzyResult.name;
            if (item.serving_name) {
              servingOption = getServingOptionStmt.get(actualDrinkName, item.serving_name);
            } else {
              servingOption = getFirstServingOptionStmt.get(actualDrinkName);
            }
          }
        }

        if (!servingOption) {
          throw new Error(`Could not find drink '${item.drink_name}' in our inventory. Available drinks: ${getAvailableDrinks().slice(0, 5).join(', ')}...`);
        }

        const cost = servingOption.price * item.quantity;
        subtotal += cost;
        orderItems.push({
          serving_option_id: servingOption.id,
          quantity: item.quantity,
          price: servingOption.price
        });
        
        // Decrement inventory
        if (servingOption.inventory_oz !== null) {
          const totalVolumeDeducted = servingOption.volume_oz * item.quantity;
          const updateInventoryStmt = db.prepare('UPDATE drinks SET inventory_oz = inventory_oz - ? WHERE id = ?');
          updateInventoryStmt.run(totalVolumeDeducted, servingOption.drink_id);
        }
              }

        const tax = subtotal * 0.08; // 8% tax
      const total = subtotal + tax;

      const insertOrderStmt = db.prepare('INSERT INTO orders (customer_name, subtotal, tax, total) VALUES (?, ?, ?, ?)');
      const insertResult = insertOrderStmt.run(customer_name || null, subtotal, tax, total);
      const orderId = insertResult.lastInsertRowid;

      const insertOrderItemStmt = db.prepare('INSERT INTO order_items (order_id, serving_option_id, quantity, price) VALUES (?, ?, ?, ?)');
      for (const item of orderItems) {
        insertOrderItemStmt.run(orderId, item.serving_option_id, item.quantity, item.price);
      }
      
      saveDb();
      
      result = { order_id: orderId, total: total };
      break;
    }
    case 'get_order': {
        const { order_id } = params;
        const orderStmt = db.prepare('SELECT * FROM orders WHERE id = ?');
        const order = orderStmt.get(order_id);

        if (!order) throw new Error(`Order with ID ${order_id} not found.`);

        const itemsStmt = db.prepare(`
            SELECT oi.id, d.name as drink_name, so.name as serving_name, oi.quantity, oi.price
            FROM order_items oi
            JOIN serving_options so ON oi.serving_option_id = so.id
            JOIN drinks d ON so.drink_id = d.id
            WHERE oi.order_id = ?
        `);
        const items = itemsStmt.all(order_id);

        order.items = items;
        result = order;
        break;
    }
    case 'cancel_order': {
        const { order_id } = params;
        // First, get all items to restore inventory
        const itemsResult = db.exec(`
            SELECT oi.quantity, so.volume_oz, d.id as drink_id
            FROM order_items oi
            JOIN serving_options so ON oi.serving_option_id = so.id
            JOIN drinks d ON so.drink_id = d.id
            WHERE oi.order_id = ${order_id} AND d.inventory_oz IS NOT NULL
        `);
        
        if (itemsResult.length > 0) {
            const updateStmt = db.prepare('UPDATE drinks SET inventory_oz = inventory_oz + ? WHERE id = ?');
            itemsResult[0].values.forEach(([quantity, volume_oz, drink_id]) => {
                const totalVolumeRestored = volume_oz * quantity;
                updateStmt.run(totalVolumeRestored, drink_id);
            });
        }

        // Now, delete the order (cascades to order_items)
        db.run('DELETE FROM orders WHERE id = ?', [order_id]);
        saveDb();
        result = { success: true, message: `Order ${order_id} cancelled.` };
        break;
    }
    case 'check_inventory': {
        const { drink_name } = params;
        const stmt = db.prepare('SELECT name, inventory_oz FROM drinks WHERE name = ?');
        const dbResult = stmt.get(drink_name);
        if (!dbResult) throw new Error(`Drink '${drink_name}' not found.`);
        result = dbResult;
        break;
    }
    case 'update_inventory': {
        const { drink_name, inventory_oz } = params;
        const stmt = db.prepare('UPDATE drinks SET inventory_oz = ? WHERE name = ?');
        const dbResult = stmt.run(inventory_oz, drink_name);
        if (dbResult.changes === 0) throw new Error(`Drink '${drink_name}' not found.`);
        saveDb();
        result = { success: true, drink_name, inventory_oz };
        break;
    }
    case 'greeting': 
        result = { message: 'Hello from MCP' };
        break;
    case 'order_drink': {
       const { drink_name, serving_name, quantity, customer_name } = params;
       
       // Validate required parameters
       if (!drink_name) {
         throw new Error('Drink name is required to place an order.');
       }
       
       const orderQuantity = quantity || 1;
       const items = [{
         drink_name: drink_name,
         serving_name: serving_name || undefined,
         quantity: orderQuantity
       }];
       
       result = await invoke('create_order', { items, customer_name });
       break;
    }
    case 'multi_drink_order': {
       const { items, customer_name } = params;
       if (!items || !Array.isArray(items)) {
         throw new Error('Multi-drink orders require an items array.');
       }
       result = await invoke('create_order', { items, customer_name });
       break;
    }
    case 'complete_order': {
       const { order_id } = params;
       result = await invoke('get_order', { order_id });
       break;
    }
    case 'view_menu': {
        result = await invoke('list_drinks', {});
        break;
    }
    case 'stop_listening': {
        result = { success: true, message: "Stopped listening." };
        break;
    }
    case 'repeat_last': {
        result = { success: true, message: lastResponse };
        break;
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
  lastResponse = JSON.stringify(result);
  return result;
}

module.exports = { tools, invoke }; 