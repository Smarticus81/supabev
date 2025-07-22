const { getDb, saveDb } = require('./db');

// Enhanced drink name mapping for common aliases and variations
function mapDrinkName(inputName) {
  const lowerInput = inputName.toLowerCase().trim();
  
  // Common drink name mappings
  const drinkMappings = {
    'hennessy': 'Hennessy Cognac',
    'jack daniels': "JD's Whiskey",
    'jack daniel': "JD's Whiskey", 
    'jd': "JD's Whiskey",
    'jack': "JD's Whiskey",
    'jameson': 'Jameson Whiskey',
    'grey goose': 'Grey Goose Vodka',
    'patron': 'Patron Tequila',
    'don julio': 'Don Julio Tequila',
    'johnnie walker': 'Johnnie Walker Scotch',
    'macallan': 'Macallan Scotch',
    'glenlivet': 'Glenlivet Reserve',
    'bombay': 'Bombay Gin',
    'tanqueray': 'Tanqueray Gin',
    'kettle one': 'Ketel One Vodka',
    'ketel one': 'Ketel One Vodka',
    'titos': "Tito's Vodka",
    "tito's": "Tito's Vodka",
    'absolut': 'Absolut Vodka',
    'smirnoff': 'Smirnoff Vodka',
    'corona': 'Corona Extra',
    'heineken': 'Heineken',
    'stella': 'Stella Artois',
    'stella artois': 'Stella Artois',
    'bud light': 'Bud Light',
    'budweiser': 'Budweiser',
    'coors': 'Coors Light',
    'miller': 'Miller Lite',
    'michelob': 'Michelob Ultra',
    'ipa': 'Sierra Nevada IPA',
    'sierra nevada': 'Sierra Nevada IPA',
    'blue moon': 'Blue Moon',
    'sam adams': 'Samuel Adams Boston Lager'
  };
  
  // Check for exact mappings first
  if (drinkMappings[lowerInput]) {
    return drinkMappings[lowerInput];
  }
  
  // Check for partial matches (for multi-word inputs)
  for (const [alias, fullName] of Object.entries(drinkMappings)) {
    if (lowerInput.includes(alias) || alias.includes(lowerInput)) {
      return fullName;
    }
  }
  
  return inputName; // Return original if no mapping found
}

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
      name: 'add_inventory',
      description: 'Adds additional inventory for a drink in ounces or bottles.',
      parameters: {
          type: 'object',
          properties: {
              drink_name: { type: 'string', description: 'The name of the drink to add inventory to.' },
              quantity: { type: 'number', description: 'The quantity to add (in bottles or units).' },
              unit: { type: 'string', description: 'The unit type: "bottles", "units", or "ounces"', enum: ['bottles', 'units', 'ounces'] }
          },
          required: ['drink_name', 'quantity']
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
   },
   {
       name: 'read_back',
       description: 'Read back current cart contents or recent orders',
       parameters: { type: 'object', properties: {} }
   },
   {
       name: 'cart_view',
       description: 'View current cart contents',
       parameters: { type: 'object', properties: {} }
   },
   {
       name: 'cart_add',
       description: 'Add items to cart without placing order',
       parameters: {
         type: 'object',
         properties: {
           drink_name: { type: 'string', description: 'Name of the drink to add' },
           serving_name: { type: 'string', description: 'Serving size' },
           quantity: { type: 'integer', description: 'Quantity to add' }
         },
         required: ['drink_name', 'quantity']
       }
   },
   {
       name: 'cart_remove',
       description: 'Remove items from cart',
       parameters: {
         type: 'object',
         properties: {
           drink_name: { type: 'string', description: 'Name of the drink to remove' },
           quantity: { type: 'integer', description: 'Quantity to remove (optional, removes all if not specified)' }
         },
         required: ['drink_name']
       }
   },
   {
       name: 'cart_clear',
       description: 'Clear all items from cart',
       parameters: { type: 'object', properties: {} }
   },
   {
       name: 'modify_order',
       description: 'Modify existing cart by adding or removing items',
       parameters: {
         type: 'object',
         properties: {
           action: { type: 'string', enum: ['add', 'remove'], description: 'Whether to add or remove items' },
           items: {
             type: 'array',
             items: {
               type: 'object',
               properties: {
                 drink_name: { type: 'string' },
                 serving_name: { type: 'string' },
                 quantity: { type: 'integer' }
               },
               required: ['drink_name', 'quantity']
             }
           }
         },
         required: ['action', 'items']
       }
   },
   {
       name: 'cart_create_order',
       description: 'Create an order from current cart contents',
       parameters: {
         type: 'object',
         properties: {
           customer_name: { type: 'string', description: 'Optional customer name' },
           clientId: { type: 'string', description: 'Client session ID' }
         }
       }
   },
   {
       name: 'cart_add_multiple',
       description: 'Add multiple items to cart at once',
       parameters: {
         type: 'object',
         properties: {
           items: {
             type: 'array',
             items: {
               type: 'object',
               properties: {
                 drink_name: { type: 'string' },
                 serving_name: { type: 'string' },
                 quantity: { type: 'integer' }
               },
               required: ['drink_name', 'quantity']
             }
           },
           clientId: { type: 'string', description: 'Client session ID' }
         },
         required: ['items']
       }
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
        let actualDrinkName = mapDrinkName(item.drink_name);
        
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
        const stmt = db.prepare('SELECT name, inventory_oz, category, subcategory, unit_volume_oz FROM drinks WHERE name = ?');
        const dbResult = stmt.get(drink_name);
        if (!dbResult) {
            // Enhanced fuzzy matching with speech recognition corrections
            let searchTerms = [drink_name];
            
            // Add common speech recognition corrections
            const corrections = {
                'cores': 'coors',
                'course': 'coors', 
                'cors': 'coors',
                'heiniken': 'heineken',
                'budwiser': 'budweiser',
                'bud lite': 'bud light',
                'miller light': 'miller lite',
                'corona': 'corona extra'
            };
            
            const normalized = drink_name.toLowerCase();
            for (const [wrong, correct] of Object.entries(corrections)) {
                if (normalized.includes(wrong)) {
                    searchTerms.push(drink_name.toLowerCase().replace(wrong, correct));
                }
            }
            
            let fuzzyResult = null;
            for (const term of searchTerms) {
                fuzzyResult = db.prepare(`
                    SELECT name, inventory_oz, category, subcategory, unit_volume_oz,
                    CASE 
                      WHEN LOWER(name) = LOWER(?) THEN 100
                      WHEN LOWER(name) LIKE LOWER(?) THEN 90
                      WHEN LOWER(name) LIKE LOWER(?) THEN 80
                      WHEN LOWER(name) LIKE LOWER(?) THEN 70
                      ELSE 0
                    END as score
                    FROM drinks
                    WHERE score > 0
                    ORDER BY score DESC, LENGTH(name)
                    LIMIT 1
                `).get(term, `${term}%`, `%${term}%`, `%${term.replace(/\s+/g, '%')}%`);
                
                if (fuzzyResult && fuzzyResult.score >= 70) break;
            }
            
            if (!fuzzyResult || fuzzyResult.score < 70) {
                throw new Error(`Drink '${drink_name}' not found.`);
            }
            
            result = { 
                name: fuzzyResult.name, 
                inventory_oz: fuzzyResult.inventory_oz,
                category: fuzzyResult.category,
                subcategory: fuzzyResult.subcategory,
                unit_volume_oz: fuzzyResult.unit_volume_oz
            };
        } else {
            result = dbResult;
        }
        
        // Store the last checked drink for context
        global.lastCheckedDrink = result.name;
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
    case 'add_inventory': {
        const { drink_name, quantity, unit } = params;
        
        // If no drink_name provided, try to use the last checked drink from context
        let actualDrinkName = drink_name;
        if (!actualDrinkName && global.lastCheckedDrink) {
            actualDrinkName = global.lastCheckedDrink;
        }
        
        if (!actualDrinkName) {
            throw new Error('Please specify which drink to add inventory for.');
        }
        
        const drink = db.prepare('SELECT id, inventory_oz, unit_volume_oz, category, subcategory FROM drinks WHERE name = ?').get(actualDrinkName);
        if (!drink) {
            // Enhanced fuzzy matching with speech recognition corrections
            let searchTerms = [actualDrinkName];
            
            // Add common speech recognition corrections
            const corrections = {
                'cores': 'coors',
                'course': 'coors', 
                'cors': 'coors',
                'heiniken': 'heineken',
                'budwiser': 'budweiser',
                'bud lite': 'bud light',
                'miller light': 'miller lite',
                'corona': 'corona extra',
                'courvoisier': 'coors' // Common mishear
            };
            
            const normalized = actualDrinkName.toLowerCase();
            for (const [wrong, correct] of Object.entries(corrections)) {
                if (normalized.includes(wrong)) {
                    searchTerms.push(actualDrinkName.toLowerCase().replace(wrong, correct));
                }
            }
            
            let fuzzyResult = null;
            for (const term of searchTerms) {
                fuzzyResult = db.prepare(`
                    SELECT name, id, inventory_oz, unit_volume_oz, category, subcategory,
                    CASE 
                      WHEN LOWER(name) = LOWER(?) THEN 100
                      WHEN LOWER(name) LIKE LOWER(?) THEN 90
                      WHEN LOWER(name) LIKE LOWER(?) THEN 80
                      WHEN LOWER(name) LIKE LOWER(?) THEN 70
                      ELSE 0
                    END as score
                    FROM drinks
                    WHERE score > 0
                    ORDER BY score DESC, LENGTH(name)
                    LIMIT 1
                `).get(term, `${term}%`, `%${term}%`, `%${term.replace(/\s+/g, '%')}%`);
                
                if (fuzzyResult && fuzzyResult.score >= 70) break;
            }
            
            if (!fuzzyResult || fuzzyResult.score < 70) {
                throw new Error(`Drink '${actualDrinkName}' not found.`);
            }
            
            actualDrinkName = fuzzyResult.name;
            drink.id = fuzzyResult.id;
            drink.inventory_oz = fuzzyResult.inventory_oz;
            drink.unit_volume_oz = fuzzyResult.unit_volume_oz;
            drink.category = fuzzyResult.category;
            drink.subcategory = fuzzyResult.subcategory;
        }

        let addedOz;
        const defaultUnit = unit || 'bottles'; // Default to bottles if not specified
        
        if (defaultUnit === 'bottles') {
            // Use the drink's unit_volume_oz or default to 25.36 oz for spirits/wine, 12 oz for beer
            const bottleSize = drink.unit_volume_oz || 25.36;
            addedOz = quantity * bottleSize;
        } else if (defaultUnit === 'ounces') {
            addedOz = quantity;
        } else {
            addedOz = quantity; // Default to treating as ounces
        }

        const newInventoryOz = (drink.inventory_oz || 0) + addedOz;
        
        const updateStmt = db.prepare('UPDATE drinks SET inventory_oz = ? WHERE id = ?');
        const dbResult = updateStmt.run(newInventoryOz, drink.id);
        if (dbResult.changes === 0) throw new Error(`Failed to update inventory for drink '${actualDrinkName}'.`);
        
        saveDb();
        
        // Determine unit name and size based on category
        let unitName = "bottles";
        let unitSize = drink.unit_volume_oz || 25.36; // Default for spirits/wine
        
        if (drink.category === "Beer") {
            if (drink.subcategory === "Hard Seltzer") {
                unitName = "cans";
                unitSize = 12;
            } else {
                unitName = "bottles";
                unitSize = 12;
            }
        } else if (drink.category === "Wine") {
            unitName = "bottles";
            unitSize = 25.36;
        } else if (drink.category === "Non-Alcoholic") {
            unitName = "cans";
            unitSize = 12;
        }
        
        const unitsAdded = Math.round(addedOz / unitSize);
        const totalUnits = Math.floor(newInventoryOz / unitSize);
        
        result = { 
            success: true, 
            drink_name: actualDrinkName, 
            inventory_oz: newInventoryOz,
            units_added: unitsAdded,
            total_units: totalUnits,
            added_oz: addedOz,
            unit_name: unitName
        };
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
         case 'read_back': {
         const { clientId } = params;
         const cart = getCart(clientId);
         if (cart.length === 0) {
             result = { message: "Your cart is empty.", cart: [] };
         } else {
             const cartSummary = cart.map(item => 
                 `${item.quantity} ${item.serving_name || 'bottle'} ${item.drink_name}`
             ).join(', ');
             result = { 
                 message: `Your current order: ${cartSummary}`,
                 cart: cart 
             };
         }
         break;
     }
     case 'cart_view': {
         const { clientId } = params;
         const cart = getCart(clientId);
         if (cart.length === 0) {
             result = { message: "Your cart is empty.", cart: [] };
         } else {
             const cartSummary = cart.map(item => 
                 `${item.quantity} ${item.serving_name || 'bottle'} ${item.drink_name}`
             ).join(', ');
             result = { 
                 message: `Your current cart: ${cartSummary}`,
                 cart: cart 
             };
         }
         break;
     }
         case 'cart_add': {
         const { drink_name, serving_name, quantity, clientId } = params;
         console.log('Cart add called with params:', params);
         if (!drink_name) {
             throw new Error('Drink name is required to add to cart.');
         }
         
         const mappedDrinkName = mapDrinkName(drink_name);
         
         const cart = getCart(clientId);
         console.log('Current cart before adding:', cart);
         
         // Check if drink already exists in cart
         const existingItem = cart.find(item => 
             item.drink_name.toLowerCase() === mappedDrinkName.toLowerCase() && 
             (item.serving_name || 'bottle') === (serving_name || 'bottle')
         );
         
         if (existingItem) {
             existingItem.quantity += (quantity || 1);
             result = { 
                 success: true, 
                 message: `Updated ${mappedDrinkName} quantity to ${existingItem.quantity} in cart.`,
                 cart: cart
             };
         } else {
             cart.push({ 
                 drink_name: mappedDrinkName, 
                 serving_name: serving_name || 'bottle', 
                 quantity: quantity || 1 
             });
             result = { 
                 success: true, 
                 message: `Added ${quantity || 1} ${serving_name || 'bottle'} ${mappedDrinkName} to cart.`,
                 cart: cart
             };
         }
         console.log('Cart after adding:', cart);
         console.log('Cart add result:', result);
         break;
     }
         case 'cart_remove': {
         const { drink_name, quantity, clientId } = params;
         const cart = getCart(clientId);
         
         if (!drink_name) {
             throw new Error('Drink name is required to remove from cart.');
         }
         
         const itemIndex = cart.findIndex(item => 
             item.drink_name.toLowerCase() === drink_name.toLowerCase()
         );
         
         if (itemIndex === -1) {
             result = { success: true, message: `${drink_name} not found in cart.`, cart: cart };
         } else {
             const item = cart[itemIndex];
             
             if (quantity && quantity < item.quantity) {
                 // Reduce quantity
                 item.quantity -= quantity;
                 result = { 
                     success: true, 
                     message: `Removed ${quantity} ${drink_name} from cart. ${item.quantity} remaining.`,
                     cart: cart
                 };
             } else {
                 // Remove entire item
                 cart.splice(itemIndex, 1);
                 result = { 
                     success: true, 
                     message: `Removed all ${drink_name} from cart.`,
                     cart: cart
                 };
             }
         }
         break;
     }
         case 'cart_clear': {
         const { clientId } = params;
         clearCart(clientId);
         result = { success: true, message: "Cart cleared.", cart: [] };
         break;
     }
    case 'modify_order': {
        const { action, items } = params;
        const cart = getCart(params.clientId);
        if (!Array.isArray(items)) {
            throw new Error('The "items" parameter must be an array for modify_order.');
        }
        if (action === 'add') {
            for (const item of items) {
                const { drink_name, serving_name, quantity } = item;
                if (!drink_name) {
                    throw new Error('Drink name is required for add action.');
                }
                cart.push({ drink_name, serving_name, quantity });
            }
            result = { success: true, message: `Added ${items.length} items to cart.` };
        } else if (action === 'remove') {
            const initialLength = cart.length;
            cart.splice(0, cart.length); // Clear the cart
            if (initialLength === 0) {
                result = { success: true, message: "Cart is already empty." };
            } else {
                result = { success: true, message: `Removed all items from cart.` };
            }
        } else {
            throw new Error('Invalid action for modify_order. Must be "add" or "remove".');
        }
        break;
    }
         case 'cart_create_order': {
         const { customer_name, clientId } = params;
         const cart = getCart(clientId);
         console.log('Cart contents for order creation:', cart);
         if (cart.length === 0) {
             throw new Error('Your cart is empty. Cannot create an order.');
         }
         const orderResult = await invoke('create_order', { items: cart, customer_name });
         clearCart(clientId); // Clear cart after creating order
         result = orderResult;
         break;
     }
    case 'cart_add_multiple': {
        const { items, clientId } = params;
        if (!items || !Array.isArray(items)) {
            throw new Error('Multi-item cart_add_multiple requires an "items" array.');
        }
        const cart = getCart(clientId);
        for (const item of items) {
            const { drink_name, serving_name, quantity } = item;
            if (!drink_name) {
                throw new Error('Drink name is required for multi-item cart_add_multiple.');
            }
            const existingItem = cart.find(i => i.drink_name.toLowerCase() === drink_name.toLowerCase() && (i.serving_name || 'bottle') === (serving_name || 'bottle'));
            if (existingItem) {
                existingItem.quantity += (quantity || 1);
            } else {
                cart.push({ drink_name, serving_name: serving_name || 'bottle', quantity: quantity || 1 });
            }
        }
        result = { success: true, message: `Added ${items.length} items to cart.`, cart: cart };
        break;
    }

    default:
      throw new Error(`Unknown tool ${name}`);
  }
  lastResponse = JSON.stringify(result);
  return result;
}

// Cart state management - in-memory cart per session
const cartState = new Map(); // clientId -> cart items

function getCart(clientId) {
    console.log('getCart called with clientId type:', typeof clientId);
    console.log('Current cartState keys:', Array.from(cartState.keys()).map(k => typeof k));
    if (!cartState.has(clientId)) {
        console.log('Creating new cart for client:', typeof clientId);
        cartState.set(clientId, []);
    }
    const cart = cartState.get(clientId);
    console.log('Retrieved cart:', cart);
    return cart;
}

function clearCart(clientId) {
    console.log('clearCart called for clientId type:', typeof clientId);
    cartState.set(clientId, []);
}

module.exports = { tools, invoke }; 