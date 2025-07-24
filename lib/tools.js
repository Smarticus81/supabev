// Production-level database integration for voice assistant
// Updated to use Supabase database
const { supabaseDb } = require('./supabase-db');
const { learningSystem } = require('./learning-system');

// Production database access - PostgreSQL via Supabase
async function getDb() {
  return supabaseDb;
}

// No-op for PostgreSQL (auto-commits)
function saveDb() {
  // PostgreSQL auto-commits, no action needed
}

// Enhanced drink name mapping for common aliases and variations
function mapDrinkName(inputName, sessionId = null) {
  const startTime = Date.now();
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
  
  let mappingMethod = 'failed';
  let mappedName = inputName;
  let confidence = 0;
  let alternatives = [];
  
  // Check for exact mappings first
  if (drinkMappings[lowerInput]) {
    mappedName = drinkMappings[lowerInput];
    mappingMethod = 'alias';
    confidence = 1.0;
  } else {
    // Check for partial matches (for multi-word inputs)
    for (const [alias, fullName] of Object.entries(drinkMappings)) {
      if (lowerInput.includes(alias) || alias.includes(lowerInput)) {
        mappedName = fullName;
        mappingMethod = 'partial_alias';
        confidence = 0.8;
        break;
      }
    }
    
    if (mappingMethod === 'failed') {
      mappingMethod = 'exact';
      confidence = inputName === mappedName ? 0.9 : 0.1;
    }
  }
  
  // Log the drink mapping for learning
  if (sessionId) {
    learningSystem.logDrinkMapping({
      sessionId,
      inputName,
      mappedName,
      mappingMethod,
      confidence,
      alternatives,
      processingTime: Date.now() - startTime
    }).catch(console.error);
  }
  
  return mappedName;
}

// Get available drinks (fallback list)
function getAvailableDrinks() {
  try {
    // Static fallback list - in production this would be an API call
    return [
      'Bud Light', 'Coors Light', 'Miller Lite', 'Heineken', 'Corona Extra',
      'Stella Artois', 'Dos XX', 'White Claw', "Truly's Seltzer", 'Michelob Ultra',
      'Shiner Bock', "Tito's Vodka", 'Grey Goose Vodka', 'Captain Morgan',
      'Hennessy Cognac', "JD's Whiskey", 'Jameson Whiskey', 'Patron Tequila'
    ];
  } catch (error) {
    console.error('Error getting drinks:', error);
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
   // VOICE AGENT COMPATIBILITY - Add missing tools that voice agent expects
   {
       name: 'add_drink_to_cart',
       description: 'Add a drink to the customer\'s cart (voice agent compatibility)',
       parameters: {
         type: 'object',
         properties: {
           drink_name: { type: 'string', description: 'Name of the drink to add' },
           serving_name: { type: 'string', description: 'Serving size' },
           quantity: { type: 'integer', description: 'Quantity to add' }
         },
         required: ['drink_name']
       }
   },
   {
       name: 'search_drinks',
       description: 'Search for available drinks by name, category, or type',
       parameters: {
         type: 'object',
         properties: {
           query: { type: 'string', description: 'Search term for drinks (name, category, type)' },
           category: { type: 'string', description: 'Filter by category (optional)' },
           max_results: { type: 'integer', description: 'Maximum number of results (default: 10)' }
         },
         required: ['query']
       }
   },
   {
       name: 'remove_drink_from_cart',
       description: 'Remove a drink from the cart (voice agent compatibility)',
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
       name: 'process_order',
       description: 'Process and complete the current cart as an order (voice agent compatibility)',
       parameters: {
         type: 'object',
         properties: {
           customer_name: { type: 'string', description: 'Customer name (optional)' },
           payment_method: { type: 'string', description: 'Payment method (optional)' }
         }
       }
   },
   {
       name: 'clear_cart',
       description: 'Clear all items from cart (voice agent compatibility)',
       parameters: { type: 'object', properties: {} }
   },
   {
       name: 'process_payment',
       description: 'Process payment for an order',
       parameters: {
         type: 'object',
         properties: {
           order_id: { type: 'integer', description: 'Order ID to process payment for' },
           payment_method: { type: 'string', description: 'Payment method: cash, credit_card, debit_card, mobile_payment, gift_card (defaults to credit_card)' },
           amount: { type: 'number', description: 'Payment amount in dollars (optional, defaults to order total)' }
         },
         required: ['order_id']
       }
   },
   {
       name: 'get_transaction_status',
       description: 'Get transaction status for an order',
       parameters: {
         type: 'object',
         properties: {
           order_id: { type: 'integer', description: 'Order ID to check transaction status for' }
         },
         required: ['order_id']
       }
   },
   // END VOICE AGENT COMPATIBILITY
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
       name: 'get_inventory_status',
       description: 'Get detailed inventory status for a specific drink',
       parameters: {
         type: 'object',
         properties: {
           drink_name: { type: 'string', description: 'Name of the drink to check inventory status for' },
           clientId: { type: 'string', description: 'Client session ID' }
         },
         required: ['drink_name']
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
   },
   {
       name: 'create_event_package',
       description: 'Create a new event package for venue bookings',
       parameters: {
         type: 'object',
         properties: {
           name: { type: 'string', description: 'Name of the event package' },
           description: { type: 'string', description: 'Description of the package' },
           price_per_person: { type: 'integer', description: 'Price per person in cents' },
           min_guests: { type: 'integer', description: 'Minimum number of guests' },
           max_guests: { type: 'integer', description: 'Maximum number of guests' },
           duration_hours: { type: 'integer', description: 'Duration of the event in hours' },
           clientId: { type: 'string', description: 'Client session ID' }
         },
         required: ['name', 'price_per_person', 'duration_hours']
       }
   },
   {
       name: 'book_event',
       description: 'Book an event with the venue using a specific package',
       parameters: {
         type: 'object',
         properties: {
           package: { type: 'string', description: 'Name of the event package to book' },
           guest_count: { type: 'integer', description: 'Number of guests' },
           event_date: { type: 'string', description: 'Date of the event (YYYY-MM-DD)' },
           customer_name: { type: 'string', description: 'Name of the customer booking the event' },
           clientId: { type: 'string', description: 'Client session ID' }
         },
         required: ['package', 'guest_count', 'event_date']
       }
   },
   {
       name: 'get_orders_list',
       description: 'Get a list of orders filtered by status',
       parameters: {
         type: 'object',
         properties: {
           status: { type: 'string', description: 'Filter orders by status: pending, processing, completed, cancelled' },
           limit: { type: 'integer', description: 'Maximum number of orders to return' },
           clientId: { type: 'string', description: 'Client session ID' }
         }
       }
   },
   {
       name: 'get_drinks_by_filter',
       description: 'Get drinks filtered by category or availability',
       parameters: {
         type: 'object',
         properties: {
           category: { type: 'string', description: 'Filter by drink category (e.g., Beer, Wine, Spirits)' },
           availability: { type: 'boolean', description: 'Filter by availability status' },
           clientId: { type: 'string', description: 'Client session ID' }
         }
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

  // Since we're using the consolidated drinks table, serving options are now part of the drinks table
  // The serving_size_oz and unit_type fields provide the serving information
  drinkRes.serving_options = [{
    name: drinkRes.unit_type || 'serving',
    volume_oz: drinkRes.serving_size_oz || 1,
    price: drinkRes.price
  }];
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

async function invoke(name, params, context = {}) {
  const startTime = Date.now();
  const sessionId = context.sessionId || context.clientId || 'default';
  const db = await getDb();
  let result;
  let success = true;
  let error = null;
  
  // Ensure consistent clientId for all tool calls
  if (!params.clientId && context.clientId) {
    params.clientId = context.clientId;
  } else if (!params.clientId) {
    params.clientId = 'default';
  }
  
  try {
    // Log tool invocation start
    await learningSystem.logInteraction({
      sessionId,
      type: 'tool_invocation_start',
      toolName: name,
      parameters: params,
      context: context
    });

    switch (name) {
    case 'list_drinks': {
      // Get all drinks with serving options from PostgreSQL
      const drinks = await dbManager.getDrinks();
      result = drinks || [];
      break;
    }
    case 'get_drink': {
      result = await dbManager.getDrink(params.id, params.name);
      break;
    }
    
    // VOICE AGENT COMPATIBILITY CASES
    case 'add_drink_to_cart': {
      // Forward to cart_add with proper parameter mapping
      const { drink_name, serving_name, quantity, clientId } = params;
      console.log('Voice agent add_drink_to_cart called, forwarding to cart_add');
      result = await invoke('cart_add', { 
        drink_name, 
        serving_name: serving_name || 'bottle', 
        quantity: quantity || 1, 
        clientId: clientId || context.clientId || 'default'
      }, context);
      break;
    }
    case 'search_drinks': {
      const { query, category, max_results = 10 } = params;
      console.log('Voice agent search_drinks called:', { query, category, max_results });
      
      // Get all drinks and filter based on query
      const allDrinks = await dbManager.getDrinks();
      let filteredDrinks = allDrinks;
      
      if (query) {
        const searchTerm = query.toLowerCase();
        filteredDrinks = allDrinks.filter(drink => 
          drink.name.toLowerCase().includes(searchTerm) ||
          drink.category.toLowerCase().includes(searchTerm) ||
          (drink.subcategory && drink.subcategory.toLowerCase().includes(searchTerm))
        );
      }
      
      if (category) {
        filteredDrinks = filteredDrinks.filter(drink => 
          drink.category.toLowerCase() === category.toLowerCase()
        );
      }
      
      result = {
        drinks: filteredDrinks.slice(0, max_results),
        total_found: filteredDrinks.length,
        search_query: query,
        category_filter: category
      };
      break;
    }
    case 'remove_drink_from_cart': {
      // Forward to cart_remove
      console.log('Voice agent remove_drink_from_cart called, forwarding to cart_remove');
      result = await invoke('cart_remove', params, context);
      break;
    }
    case 'process_order': {
      // Forward to cart_create_order
      console.log('Voice agent process_order called, forwarding to cart_create_order');
      result = await invoke('cart_create_order', {
        customer_name: params.customer_name,
        clientId: params.clientId || context.clientId || 'default'
      }, context);
      break;
    }
    case 'clear_cart': {
      // Forward to cart_clear
      console.log('Voice agent clear_cart called, forwarding to cart_clear');
      result = await invoke('cart_clear', {
        clientId: params.clientId || context.clientId || 'default'
      }, context);
      break;
    }
    case 'process_payment': {
      const { order_id, payment_method = 'credit_card', amount } = params;
      console.log('Process payment called:', { order_id, payment_method, amount });
      
      try {
        const response = await fetch('http://localhost:3000/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'auto_process_payment',
            orderId: order_id,
            paymentMethod: payment_method,
            amount: amount ? Math.round(amount * 100) : undefined // Convert to cents
          })
        });
        
        const data = await response.json();
        result = data;
      } catch (error) {
        result = {
          success: false,
          message: `Payment processing failed: ${error.message}`
        };
      }
      break;
    }
    case 'get_transaction_status': {
      const { order_id } = params;
      console.log('Get transaction status called for order:', order_id);
      
      try {
        const response = await fetch(`http://localhost:3000/api/payments?orderId=${order_id}`);
        const data = await response.json();
        result = data;
      } catch (error) {
        result = {
          success: false,
          message: `Failed to get transaction status: ${error.message}`
        };
      }
      break;
    }
    // END VOICE AGENT COMPATIBILITY CASES
    
    case 'create_order': {
      const { items, customer_name } = params;
      if (!Array.isArray(items)) {
        throw new Error('The "items" parameter must be an array.');
      }
      
      const processingSteps = [];
      processingSteps.push('Validating order items');
      
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        let actualDrinkName = mapDrinkName(item.drink_name, sessionId);
        processingSteps.push(`Processing item: ${item.drink_name} -> ${actualDrinkName}`);
        
        // Get drink and serving option with unit-aware inventory
        const servingOption = await dbManager.getServingOption(actualDrinkName, item.serving_name);
        
        if (!servingOption) {
          processingSteps.push(`Failed to find drink: ${item.drink_name}`);
          throw new Error(`Could not find drink '${item.drink_name}' in our inventory. Available drinks: ${getAvailableDrinks().slice(0, 5).join(', ')}...`);
        }

        const cost = servingOption.price * item.quantity;
        subtotal += cost;
        orderItems.push({
          drink_id: servingOption.drink_id,
          quantity: item.quantity,
          price: servingOption.price,
          drink_name: actualDrinkName,
          category: servingOption.category
        });
        
        // Update inventory with proper serving-to-bottle conversion logic
        // Standard conversions:
        // - Wine: 5oz serving, 750ml bottle = ~5 servings per bottle
        // - Spirits: 1.5oz serving, 750ml bottle = ~17 servings per bottle  
        // - Beer/Non-alcoholic: 1:1 ratio (each serving = 1 bottle/can)
        // Only deduct from bottle inventory when equivalent servings reach full bottle
        const inventorySuccess = await dbManager.updateInventoryForOrder(actualDrinkName, item.quantity, servingOption);
        
        if (!inventorySuccess) {
          processingSteps.push(`Insufficient inventory for ${actualDrinkName}`);
          throw new Error(`Insufficient inventory for ${actualDrinkName}. Please check available stock.`);
        }
        
        processingSteps.push(`Inventory updated for ${actualDrinkName}: -${item.quantity} ${servingOption.unit_type || 'units'}`);
      }

      const tax = subtotal * 0.08; // 8% tax
      const total = subtotal + tax;

      // Create order and items in PostgreSQL
      const orderId = await dbManager.createOrder({
        subtotal,
        tax,
        total,
        items: orderItems
      });
      
      result = { 
        order_id: orderId, 
        total: total,
        subtotal: subtotal,
        tax: tax,
        items: orderItems
      };
      
      // Log successful order processing
      await learningSystem.logOrderProcessing({
        sessionId,
        orderId,
        items: orderItems,
        total,
        subtotal,
        tax,
        customerName: customer_name,
        processingSteps,
        success: true
      });
      
      break;
    }
    case 'get_order': {
        const { order_id } = params;
        const order = await dbManager.getOrder(order_id);
        if (!order) throw new Error(`Order with ID ${order_id} not found.`);
        result = order;
        break;
    }
    case 'cancel_order': {
        const { order_id } = params;
        const success = await dbManager.cancelOrder(order_id);
        result = { success, message: `Order ${order_id} cancelled.` };
        break;
    }
    case 'check_inventory': {
        const { drink_name } = params;
        const drinkInfo = await dbManager.checkInventory(drink_name);
        if (!drinkInfo) {
            throw new Error(`Drink '${drink_name}' not found.`);
        }
        
        result = drinkInfo;
        // Store the last checked drink for context
        global.lastCheckedDrink = result.name;
        break;
    }
    case 'update_inventory': {
        const { drink_name, quantity_change, unit } = params;
        const db = await getDb();
        const result = await db.updateInventory(drink_name, quantity_change, unit || 'bottle');
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
        
        const db = await getDb();
        const result = await db.addInventory(actualDrinkName, quantity, unit || 'bottle');
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
     case 'get_inventory_status': {
         const { drink_name, clientId } = params;
         if (!drink_name) {
             throw new Error('Drink name is required to check inventory status.');
         }
         
         // Use the existing check_inventory function to get drink data
         try {
             const inventoryData = await invoke('check_inventory', { drink_name });
             
             // Calculate status based on inventory levels and convert to servings
             const inventory = inventoryData.inventory || 0; // This is in bottles
             const drinkCategory = inventoryData.category || '';
             const unitType = inventoryData.unit_type || 'bottle';
             
             // Convert bottle inventory to servings available
             let servingsAvailable = inventory;
             let servingUnit = 'servings';
             
             if (drinkCategory === 'Wine') {
                 servingsAvailable = inventory * 5; // 5 glasses per bottle
                 servingUnit = 'glasses';
             } else if (drinkCategory === 'Spirits') {
                 servingsAvailable = inventory * 17; // 17 shots per bottle
                 servingUnit = 'shots';
             } else if (drinkCategory === 'Beer' || drinkCategory === 'Non-alcoholic') {
                 servingsAvailable = inventory; // 1:1 ratio
                 servingUnit = inventory === 1 ? 'bottle' : 'bottles';
             }
             
             // Set thresholds based on servings available
             let criticalThreshold = 5;
             let lowThreshold = 20;
             
             if (drinkCategory === 'Wine') {
                 criticalThreshold = 5; // Less than 1 bottle worth
                 lowThreshold = 15; // Less than 3 bottles worth
             } else if (drinkCategory === 'Spirits') {
                 criticalThreshold = 17; // Less than 1 bottle worth
                 lowThreshold = 51; // Less than 3 bottles worth
             } else if (drinkCategory === 'Beer' || drinkCategory === 'Non-alcoholic') {
                 criticalThreshold = 3; // Less than 3 bottles/cans
                 lowThreshold = 10; // Less than 10 bottles/cans
             }
             
             let status = "good";
             let color = "green";
             
             // Calculate progress based on servings available vs max expected servings
             let maxServings = 100; // Default max
             if (drinkCategory === 'Wine') {
                 maxServings = 50; // 10 bottles worth
             } else if (drinkCategory === 'Spirits') {
                 maxServings = 170; // 10 bottles worth
             } else if (drinkCategory === 'Beer' || drinkCategory === 'Non-alcoholic') {
                 maxServings = 50; // 50 bottles/cans
             }
             
             let progressValue = Math.min((servingsAvailable / maxServings) * 100, 100);
             
             // Determine status based on servings available
             if (servingsAvailable <= criticalThreshold) {
                 status = "critical";
                 color = "red";
             } else if (servingsAvailable <= lowThreshold) {
                 status = "low";
                 color = "yellow";
             }
             
             // Format display text to show both servings and bottles
             let displayUnits;
             
             if (drinkCategory === 'Wine') {
                 displayUnits = `${servingsAvailable} glasses (${inventory} bottles)`;
             } else if (drinkCategory === 'Spirits') {
                 displayUnits = `${servingsAvailable} shots (${inventory} bottles)`;
             } else if (drinkCategory === 'Beer' || drinkCategory === 'Non-alcoholic') {
                 displayUnits = `${inventory} ${servingUnit}`;
             } else {
                 // For other categories, show servings and bottles
                 displayUnits = `${servingsAvailable} servings (${inventory} bottles)`;
             }
             
             result = {
                 success: true,
                 drink_name: inventoryData.name,
                 category: inventoryData.category,
                 unit_type: unitType,
                 inventory: inventory, // Bottles in stock
                 servings_available: servingsAvailable, // Servings available
                 serving_unit: servingUnit, // Type of serving (glasses, shots, bottles)
                 display_units: displayUnits,
                 status: status,
                 color: color,
                 progress_value: progressValue,
                 critical_threshold: criticalThreshold,
                 low_threshold: lowThreshold,
                 details: inventoryData
             };
         } catch (error) {
             throw new Error(`Could not retrieve inventory status for ${drink_name}: ${error.message}`);
         }
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

    case 'create_event_package': {
        const { name, description, price_per_person, min_guests, max_guests, duration_hours, clientId } = params;
        
        if (!name) {
            throw new Error('Event package name is required.');
        }
        
        // In a real system, we would store this in the database
        // For now, we'll just return a success message
        result = {
            success: true,
            package_id: `pkg_${Date.now()}`,
            name,
            description: description || '',
            price_per_person: price_per_person || 0,
            min_guests: min_guests || 10,
            max_guests: max_guests || 1000,
            duration_hours: duration_hours || 4,
            created_at: new Date().toISOString()
        };
        break;
    }
    
    case 'book_event': {
        const { package: packageName, guest_count, event_date, customer_name, clientId } = params;
        
        if (!packageName) {
            throw new Error('Event package name is required.');
        }
        
        if (!guest_count || guest_count <= 0) {
            throw new Error('Valid guest count is required.');
        }
        
        if (!event_date) {
            throw new Error('Event date is required.');
        }
        
        // In a real system, we would store this in the database
        // For now, we'll just return a success message
        result = {
            success: true,
            booking_id: `booking_${Date.now()}`,
            package: packageName,
            guest_count,
            event_date,
            customer_name: customer_name || 'Anonymous',
            status: 'confirmed',
            created_at: new Date().toISOString()
        };
        break;
    }
    
    case 'get_orders_list': {
        const { status, limit, clientId } = params;
        
        // In a real system, we would fetch this from the database
        // For now, we'll just return sample data
        const sampleOrders = [
            {
                order_id: 1001,
                customer_name: 'John Smith',
                total: 45.99,
                status: 'completed',
                date: '2025-07-22T14:30:00Z'
            },
            {
                order_id: 1002,
                customer_name: 'Jane Doe',
                total: 32.50,
                status: 'pending',
                date: '2025-07-24T09:15:00Z'
            }
        ];
        
        // Filter by status if provided
        let filteredOrders = sampleOrders;
        if (status) {
            filteredOrders = sampleOrders.filter(order => order.status === status);
        }
        
        // Apply limit if provided
        if (limit && limit > 0) {
            filteredOrders = filteredOrders.slice(0, limit);
        }
        
        result = {
            success: true,
            orders: filteredOrders,
            count: filteredOrders.length,
            total_count: sampleOrders.length
        };
        break;
    }
    
    case 'get_drinks_by_filter': {
        const { category, availability, clientId } = params;
        
        // Start with all drinks
        const allDrinks = await dbManager.getDrinks();
        
        // Apply filters
        let filteredDrinks = [...allDrinks];
        
        // Filter by category if provided
        if (category) {
            filteredDrinks = filteredDrinks.filter(drink => drink.category === category);
        }
        
        // Filter by availability if provided
        if (availability !== undefined) {
            filteredDrinks = filteredDrinks.filter(drink => {
                const isAvailable = (drink.inventory > 0);
                return availability ? isAvailable : !isAvailable;
            });
        }
        
        result = {
            success: true,
            drinks: filteredDrinks,
            count: filteredDrinks.length,
            filters: {
                category: category || 'all',
                availability: availability !== undefined ? availability : 'all'
            }
        };
        break;
    }
    case 'update_drink_inventory': {
        const { drink_name, quantity_change, unit } = params;
        if (!drink_name || quantity_change === undefined) {
            throw new Error('drink_name and quantity_change are required');
        }
        result = await invoke('update_inventory', { 
            drink_name, 
            quantity_change, 
            unit: unit || 'bottle' 
        });
        break;
    }
    case 'bulk_update_inventory': {
        const { updates } = params;
        if (!updates || !Array.isArray(updates)) {
            throw new Error('updates array is required');
        }
        
        // Process each update individually
        const results = [];
        for (const update of updates) {
            try {
                const { drink_name, quantity_change, unit } = update;
                if (!drink_name || quantity_change === undefined) {
                    throw new Error(`Invalid update: ${JSON.stringify(update)}`);
                }
                const updateResult = await invoke('update_inventory', { 
                    drink_name, 
                    quantity_change, 
                    unit: unit || 'bottle' 
                });
                results.push({ 
                    drink_name, 
                    success: true, 
                    result: updateResult 
                });
            } catch (error) {
                results.push({ 
                    drink_name: update.drink_name || 'unknown', 
                    success: false, 
                    error: error.message 
                });
            }
        }
        
        result = {
            total_updates: updates.length,
            successful_updates: results.filter(r => r.success).length,
            failed_updates: results.filter(r => !r.success).length,
            results: results
        };
        break;
    }

    default:
      throw new Error(`Unknown tool ${name}`);
  }
  
  } catch (err) {
    success = false;
    error = {
      type: err.name || 'Error',
      message: err.message,
      stack: err.stack
    };
    
    // Enhanced error logging
    console.error(`MCP Tool Error in '${name}':`, {
      message: err.message,
      params: JSON.stringify(params),
      toolName: name
    });
    
    // Log error for learning
    await learningSystem.logError({
      sessionId,
      toolName: name,
      parameters: params,
      error: err,
      context: context,
      userImpact: 'tool_failure'
    });
    
    throw err; // Re-throw the error
  } finally {
    const executionTime = Date.now() - startTime;
    
    // Log tool invocation completion
    await learningSystem.logToolInvocation({
      sessionId,
      toolName: name,
      parameters: params,
      result: success ? result : null,
      success,
      error,
      executionTime,
      context: context
    });
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