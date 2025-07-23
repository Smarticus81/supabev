// Production-level database integration for voice assistant
const dbManager = require('./db-connection');
const { learningSystem } = require('./learning-system');

// Production database access - PostgreSQL via Neon
async function getDb() {
  return dbManager;
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
        
        // Update inventory with quantity tracking (not volume)
        await dbManager.updateInventoryForOrder(servingOption.drink_id, item.quantity);
        processingSteps.push(`Inventory updated for ${actualDrinkName}: -${item.quantity} units`);
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
        const { drink_name, inventory_oz } = params;
        const success = await dbManager.updateInventory(drink_name, inventory_oz);
        if (!success) throw new Error(`Drink '${drink_name}' not found.`);
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
        
        const result_obj = await dbManager.addInventory(actualDrinkName, quantity, unit);
        if (!result_obj.success) {
            throw new Error(result_obj.error || `Drink '${actualDrinkName}' not found.`);
        }
        
        result = result_obj;
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
  
  } catch (err) {
    success = false;
    error = {
      type: err.name || 'Error',
      message: err.message,
      stack: err.stack
    };
    
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