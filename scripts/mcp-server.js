#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class MCPServer {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '..', 'data', 'bar.db');
        this.cartStorage = new Map(); // In-memory cart storage by clientId
        this.requestBuffer = '';
        this.isReady = false;
        
        this.initializeDatabase();
        this.setupProcessHandlers();
        this.notifyReady();
    }

    initializeDatabase() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Initialize database with better options
            this.db = new Database(this.dbPath, { 
                // verbose: console.log, // Comment out verbose logging
                fileMustExist: false,
                timeout: 10000,
                readonly: false
            });
            
            // Set pragmas for better performance and reliability
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');
            this.db.pragma('mmap_size = 268435456'); // 256MB
            
            this.initializeTables();
            this.loadInitialData();
            
            process.stderr.write('Database initialized successfully\n');
            
        } catch (error) {
            process.stderr.write(`Failed to initialize database: ${error}\n`);
            process.exit(1);
        }
    }

    initializeTables() {
        try {
            // Create drinks table if not exists
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS drinks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    category TEXT NOT NULL,
                    subcategory TEXT,
                    price REAL NOT NULL,
                    inventory_oz REAL DEFAULT 0,
                    unit_volume_oz REAL DEFAULT 12,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create orders table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_name TEXT,
                    total_amount REAL,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create order_items table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER,
                    drink_name TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    price REAL NOT NULL,
                    serving_name TEXT DEFAULT 'bottle',
                    FOREIGN KEY (order_id) REFERENCES orders (id)
                )
            `);

            // Create config table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            `);

            // Create indexes for better performance
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_drinks_name ON drinks(name);
                CREATE INDEX IF NOT EXISTS idx_drinks_category ON drinks(category);
                CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
                CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
            `);

        } catch (error) {
            process.stderr.write(`Error creating tables: ${error}\n`);
            throw error;
        }
    }

    loadInitialData() {
        try {
            // Check if we need to load initial data
            const drinkCount = this.db.prepare('SELECT COUNT(*) as count FROM drinks').get().count;
            
            if (drinkCount === 0) {
                process.stderr.write('Loading initial drink data...\n');
                this.loadDrinksFromJson();
            }
        } catch (error) {
            process.stderr.write(`Error loading initial data: ${error}\n`);
        }
    }

    loadDrinksFromJson() {
        try {
            const drinksPath = path.join(__dirname, '..', 'data', 'drinks.json');
            if (fs.existsSync(drinksPath)) {
                const drinksData = JSON.parse(fs.readFileSync(drinksPath, 'utf8'));
                
                const insertDrink = this.db.prepare(`
                    INSERT OR REPLACE INTO drinks 
                    (name, category, subcategory, price, inventory_oz, unit_volume_oz)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                const insertMany = this.db.transaction((drinks) => {
                    for (const drink of drinks) {
                        // Calculate inventory in ounces (default inventory * unit volume)
                        const inventory = drink.inventory || 0;
                        let unitVolumeOz = 12; // Default to 12oz

                        // Set unit volume based on category
                        if (drink.category === 'Wine') {
                            unitVolumeOz = 25.36; // 750ml in oz
                        } else if (drink.category === 'Spirits') {
                            unitVolumeOz = 25.36; // 750ml in oz
                        } else if (drink.category === 'Beer') {
                            unitVolumeOz = 12; // 12oz bottle/can
                        } else if (drink.category === 'Non-Alcoholic') {
                            unitVolumeOz = 12; // 12oz
                        }

                        const inventoryOz = inventory * unitVolumeOz;

                        insertDrink.run(
                            drink.name,
                            drink.category,
                            drink.subcategory || null,
                            drink.price,
                            inventoryOz,
                            unitVolumeOz
                        );
                    }
                });

                insertMany(drinksData);
                process.stderr.write(`Loaded ${drinksData.length} drinks into database\n`);
            }
        } catch (error) {
            process.stderr.write(`Error loading drinks from JSON: ${error}\n`);
        }
    }

    setupProcessHandlers() {
        // Handle stdin for requests
        process.stdin.on('data', (data) => {
            this.handleInput(data.toString());
        });

        process.stdin.on('end', () => {
            this.cleanup();
            process.exit(0);
        });

        // Handle cleanup on exit
        process.on('exit', () => {
            this.cleanup();
        });

        process.on('SIGINT', () => {
            this.cleanup();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.cleanup();
            process.exit(0);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            process.stderr.write(`Uncaught exception: ${error}\n`);
            this.cleanup();
            process.exit(1);
        });
    }

    handleInput(input) {
        this.requestBuffer += input;
        
        // Process complete requests (delimited by newlines)
        const lines = this.requestBuffer.split('\n');
        this.requestBuffer = lines.pop(); // Keep incomplete line
        
        lines.forEach(line => {
            if (line.trim()) {
                this.processRequest(line.trim());
            }
        });
    }

    async processRequest(requestStr) {
        try {
            const request = JSON.parse(requestStr);
            // process.stderr.write(`Processing request: ${requestStr}\n`);
            
            const { action, name, params, requestId } = request;
            
            if (action === 'invoke_tool') {
                const result = await this.invokeTool(name, params);
                this.sendResponse({ requestId, result });
            } else {
                this.sendResponse({ 
                    requestId, 
                    error: `Unknown action: ${action}` 
                });
            }
        } catch (error) {
            process.stderr.write(`Error processing request: ${error}\n`);
            this.sendResponse({ 
                error: `Failed to process request: ${error.message}` 
            });
        }
    }

    async invokeTool(toolName, params) {
        try {
            // process.stderr.write(`Invoking tool: ${toolName} with params: ${JSON.stringify(params)}\n`);
            
            switch (toolName) {
                case 'check_inventory':
                    return this.checkInventory(params);
                case 'add_inventory':
                    return this.addInventory(params);
                case 'cart_add':
                    return this.cartAdd(params);
                case 'cart_add_multiple':
                    return this.cartAddMultiple(params);
                case 'cart_remove':
                    return this.cartRemove(params);
                case 'cart_view':
                    return this.cartView(params);
                case 'cart_clear':
                    return this.cartClear(params);
                case 'cart_create_order':
                    return this.cartCreateOrder(params);
                case 'create_order':
                    return this.createOrder(params);
                case 'view_menu':
                    return this.viewMenu(params);
                case 'health_check':
                    return this.healthCheck();
                case 'inventory_insights':
                    return this.inventoryInsights(params);
                case 'sales_insights':
                    return this.salesInsights(params);
                case 'get_tts_config':
                    return this.getTtsConfig();
                case 'set_tts_config':
                    return this.setTtsConfig(params);
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            process.stderr.write(`Error in tool ${toolName}: ${error}\n`);
            return { error: error.message };
        }
    }

    checkInventory(params) {
        const { drink_name } = params;
        
        if (!drink_name) {
            return { error: 'drink_name is required' };
        }

        try {
            const stmt = this.db.prepare(`
                SELECT name, category, subcategory, price, inventory_oz, unit_volume_oz
                FROM drinks 
                WHERE name = ? COLLATE NOCASE
            `);
            
            const result = stmt.get(drink_name);
            
            if (!result) {
                return { error: `Drink \"${drink_name}\" not found in inventory` };
            }

            return {
                ...result,
                success: true
            };
        } catch (error) {
            process.stderr.write(`Database error in checkInventory: ${error}\n`);
            return { error: 'Database error while checking inventory' };
        }
    }

    addInventory(params) {
        const { drink_name, quantity } = params;
        
        if (!drink_name || !quantity) {
            return { error: 'drink_name and quantity are required' };
        }

        if (quantity <= 0) {
            return { error: 'quantity must be positive' };
        }

        try {
            // First check if drink exists
            const checkStmt = this.db.prepare(`
                SELECT name, category, unit_volume_oz, inventory_oz 
                FROM drinks 
                WHERE name = ? COLLATE NOCASE
            `);
            const drink = checkStmt.get(drink_name);
            
            if (!drink) {
                return { error: `Drink \"${drink_name}\" not found` };
            }

            // Calculate ounces to add
            const ouncesToAdd = quantity * drink.unit_volume_oz;
            
            // Update inventory
            const updateStmt = this.db.prepare(`
                UPDATE drinks 
                SET inventory_oz = inventory_oz + ?, updated_at = CURRENT_TIMESTAMP
                WHERE name = ? COLLATE NOCASE
            `);
            
            const updateResult = updateStmt.run(ouncesToAdd, drink_name);
            
            if (updateResult.changes === 0) {
                return { error: 'Failed to update inventory' };
            }

            // Get updated values
            const updatedDrink = checkStmt.get(drink_name);
            const totalUnits = Math.floor(updatedDrink.inventory_oz / drink.unit_volume_oz);
            
            // Determine unit name
            let unitName = 'bottles';
            if (drink.category === 'Beer' && updatedDrink.subcategory === 'Hard Seltzer') {
                unitName = 'cans';
            } else if (drink.category === 'Beer') {
                unitName = 'bottles';
            } else if (drink.category === 'Non-Alcoholic') {
                unitName = 'cans';
            }

            return {
                success: true,
                drink_name: drink.name,
                units_added: quantity,
                total_units: totalUnits,
                added_oz: ouncesToAdd,
                unit_name: unitName,
                message: `Added ${quantity} ${unitName} of ${drink.name} to inventory`
            };
        } catch (error) {
            process.stderr.write(`Database error in addInventory: ${error}\n`);
            return { error: 'Database error while adding inventory' };
        }
    }

    cartAdd(params) {
        const { clientId, drink_name, quantity = 1, serving_name = 'bottle' } = params;
        
        if (!clientId || !drink_name) {
            return { error: 'clientId and drink_name are required' };
        }

        try {
            // Verify drink exists
            const drinkStmt = this.db.prepare(`
                SELECT name, price FROM drinks WHERE name = ? COLLATE NOCASE
            `);
            const drink = drinkStmt.get(drink_name);
            
            if (!drink) {
                return { error: `Drink \"${drink_name}\" not found` };
            }

            // Get or create cart for client
            if (!this.cartStorage.has(clientId)) {
                this.cartStorage.set(clientId, []);
            }
            
            const cart = this.cartStorage.get(clientId);
            
            // Check if item already in cart
            const existingItem = cart.find(item => 
                item.drink_name.toLowerCase() === drink.name.toLowerCase() &&
                item.serving_name === serving_name
            );
            
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({
                    drink_name: drink.name,
                    quantity,
                    price: drink.price,
                    serving_name
                });
            }

            return {
                success: true,
                message: `Added ${quantity} ${drink.name} to cart`,
                cart: [...cart] // Return copy of cart
            };
        } catch (error) {
            process.stderr.write(`Error in cartAdd: ${error}\n`);
            return { error: 'Failed to add item to cart' };
        }
    }

    cartAddMultiple(params) {
        const { clientId, items } = params;
        
        if (!clientId || !items || !Array.isArray(items)) {
            return { error: 'clientId and items array are required' };
        }

        try {
            let addedCount = 0;
            const errors = [];
            
            for (const item of items) {
                const result = this.cartAdd({
                    clientId,
                    drink_name: item.drink_name,
                    quantity: item.quantity || 1,
                    serving_name: item.serving_name || 'bottle'
                });
                
                if (result.success) {
                    addedCount++;
                } else {
                    errors.push(`${item.drink_name}: ${result.error}`);
                }
            }

            const cart = this.cartStorage.get(clientId) || [];
            
            return {
                success: addedCount > 0,
                message: `Added ${addedCount} items to cart${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
                cart: [...cart],
                errors: errors.length > 0 ? errors : undefined
            };
        } catch (error) {
            process.stderr.write(`Error in cartAddMultiple: ${error}\n`);
            return { error: 'Failed to add multiple items to cart' };
        }
    }

    cartRemove(params) {
        const { clientId, drink_name, quantity } = params;
        
        if (!clientId || !drink_name) {
            return { error: 'clientId and drink_name are required' };
        }

        try {
            const cart = this.cartStorage.get(clientId) || [];
            const itemIndex = cart.findIndex(item => 
                item.drink_name.toLowerCase() === drink_name.toLowerCase()
            );
            
            if (itemIndex === -1) {
                return { error: `${drink_name} not found in cart` };
            }

            if (quantity && quantity > 0) {
                // Remove specific quantity
                cart[itemIndex].quantity -= quantity;
                if (cart[itemIndex].quantity <= 0) {
                    cart.splice(itemIndex, 1);
                }
            } else {
                // Remove entire item
                cart.splice(itemIndex, 1);
            }

            return {
                success: true,
                message: `Removed ${drink_name} from cart`,
                cart: [...cart]
            };
        } catch (error) {
            process.stderr.write(`Error in cartRemove: ${error}\n`);
            return { error: 'Failed to remove item from cart' };
        }
    }

    cartView(params) {
        const { clientId } = params;
        
        if (!clientId) {
            return { error: 'clientId is required' };
        }

        try {
            const cart = this.cartStorage.get(clientId) || [];
            
            if (cart.length === 0) {
                return {
                    success: true,
                    cart: [],
                    message: 'Your cart is empty'
                };
            }

            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            const totalPrice = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            
            const cartSummary = cart.map(item => 
                `${item.quantity} ${item.drink_name}`
            ).join(', ');

            return {
                success: true,
                cart: [...cart],
                totalItems,
                totalPrice: totalPrice.toFixed(2),
                message: `Cart contains: ${cartSummary}`
            };
        } catch (error) {
            process.stderr.write(`Error in cartView: ${error}\n`);
            return { error: 'Failed to view cart' };
        }
    }

    cartClear(params) {
        const { clientId } = params;
        
        if (!clientId) {
            return { error: 'clientId is required' };
        }

        try {
            this.cartStorage.set(clientId, []);
            return {
                success: true,
                message: 'Cart cleared',
                cart: []
            };
        } catch (error) {
            process.stderr.write(`Error in cartClear: ${error}\n`);
            return { error: 'Failed to clear cart' };
        }
    }

    cartCreateOrder(params) {
        const { clientId, customer_name } = params;
        
        if (!clientId) {
            return { error: 'clientId is required' };
        }

        try {
            const cart = this.cartStorage.get(clientId) || [];
            
            if (cart.length === 0) {
                return { error: 'Cart is empty' };
            }

            // Create order from cart
            const result = this.createOrder({
                items: cart,
                customer_name
            });

            if (result.success) {
                // Clear cart after successful order
                this.cartStorage.set(clientId, []);
            }

            return result;
        } catch (error) {
            process.stderr.write(`Error in cartCreateOrder: ${error}\n`);
            return { error: 'Failed to create order from cart' };
        }
    }

    createOrder(params) {
        const { items, customer_name } = params;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return { error: 'items array is required and cannot be empty' };
        }

        try {
            // Calculate totals
            const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const tax = subtotal * 0.08; // 8% tax
            const total = subtotal + tax;

            // Create order in database
            const insertOrder = this.db.prepare(`
                INSERT INTO orders (customer_name, total_amount, status)
                VALUES (?, ?, 'completed')
            `);
            
            const orderResult = insertOrder.run(customer_name, total);
            const orderId = orderResult.lastInsertRowid;

            // Add order items
            const insertOrderItem = this.db.prepare(`
                INSERT INTO order_items (order_id, drink_name, quantity, price, serving_name)
                VALUES (?, ?, ?, ?, ?)
            `);

            const insertItems = this.db.transaction((orderItems) => {
                for (const item of orderItems) {
                    insertOrderItem.run(
                        orderId,
                        item.drink_name,
                        item.quantity,
                        item.price,
                        item.serving_name || 'bottle'
                    );
                }
            });

            insertItems(items);

            return {
                success: true,
                order_id: orderId,
                subtotal: subtotal.toFixed(2),
                tax: tax.toFixed(2),
                total: total.toFixed(2),
                message: `Order ${orderId} created successfully`
            };
        } catch (error) {
            process.stderr.write(`Error in createOrder: ${error}\n`);
            return { error: 'Failed to create order' };
        }
    }

    viewMenu(params) {
        try {
            const stmt = this.db.prepare(`
                SELECT name, category, subcategory, price, inventory_oz, unit_volume_oz
                FROM drinks 
                ORDER BY category, name
            `);
            
            const drinks = stmt.all();
            
            return {
                success: true,
                drinks,
                message: `Menu contains ${drinks.length} drinks`
            };
        } catch (error) {
            process.stderr.write(`Error in viewMenu: ${error}\n`);
            return { error: 'Failed to view menu' };
        }
    }

    healthCheck() {
        try {
            // Test database connection
            const result = this.db.prepare('SELECT 1 as test').get();
            
            return {
                success: true,
                status: 'healthy',
                database: 'connected',
                carts: this.cartStorage.size,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            process.stderr.write(`Health check failed: ${error}\n`);
            return {
                success: false,
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    inventoryInsights(params) {
        try {
            // Low stock items (less than 5 units)
            const lowStockStmt = this.db.prepare(`
                SELECT name, inventory_oz / unit_volume_oz as units
                FROM drinks 
                WHERE units < 5
                ORDER BY units ASC
            `);
            const lowStock = lowStockStmt.all();

            // Total inventory value
            const valueStmt = this.db.prepare(`
                SELECT SUM(inventory_oz / unit_volume_oz * price) as total_value
                FROM drinks
            `);
            const { total_value } = valueStmt.get();

            // Categories summary
            const categoriesStmt = this.db.prepare(`
                SELECT category, COUNT(*) as count, SUM(inventory_oz / unit_volume_oz * price) as value
                FROM drinks
                GROUP BY category
            `);
            const categories = categoriesStmt.all();

            return {
                success: true,
                low_stock: lowStock,
                total_inventory_value: total_value.toFixed(2),
                category_summary: categories,
                message: 'Inventory insights generated'
            };
        } catch (error) {
            process.stderr.write(`Error in inventoryInsights: ${error}\n`);
            return { error: 'Failed to generate inventory insights' };
        }
    }

    salesInsights(params) {
        try {
            // Top selling drinks
            const topSellersStmt = this.db.prepare(`
                SELECT drink_name, SUM(quantity) as total_sold, SUM(quantity * price) as revenue
                FROM order_items
                GROUP BY drink_name
                ORDER BY total_sold DESC
                LIMIT 10
            `);
            const topSellers = topSellersStmt.all();

            // Total sales
            const totalSalesStmt = this.db.prepare(`
                SELECT SUM(total_amount) as total_revenue,
                       COUNT(*) as order_count
                FROM orders
                WHERE status = 'completed'
            `);
            const { total_revenue, order_count } = totalSalesStmt.get();

            // Recent orders
            const recentStmt = this.db.prepare(`
                SELECT * FROM orders
                ORDER BY created_at DESC
                LIMIT 5
            `);
            const recentOrders = recentStmt.all();

            return {
                success: true,
                top_sellers: topSellers,
                total_revenue: total_revenue ? total_revenue.toFixed(2) : '0.00',
                order_count: order_count || 0,
                recent_orders: recentOrders,
                message: 'Sales insights generated'
            };
        } catch (error) {
            process.stderr.write(`Error in salesInsights: ${error}\n`);
            return { error: 'Failed to generate sales insights' };
        }
    }

    getTtsConfig() {
        try {
            const stmt = this.db.prepare('SELECT * FROM config WHERE key IN (\'tts_provider\', \'tts_voice\')');
            const rows = stmt.all();
            const config = rows.reduce((acc, row) => {
                acc[row.key] = row.value;
                return acc;
            }, {});
            return {
                success: true,
                config: config || { tts_provider: 'deepgram', tts_voice: 'aura-2-juno-en' }
            };
        } catch (error) {
            return { error: 'Failed to get TTS config' };
        }
    }

    setTtsConfig(params) {
        const { tts_provider, tts_voice } = params;
        if (!tts_provider || !tts_voice) {
            return { error: 'tts_provider and tts_voice required' };
        }
        try {
            const insert = this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
            insert.run('tts_provider', tts_provider);
            insert.run('tts_voice', tts_voice);
            return { success: true };
        } catch (error) {
            return { error: 'Failed to set TTS config' };
        }
    }

    sendResponse(response) {
        try {
            const responseStr = JSON.stringify(response);
            process.stdout.write(responseStr + '\n');
        } catch (error) {
            process.stderr.write(`Error sending response: ${error}\n`);
        }
    }

    notifyReady() {
        this.isReady = true;
        this.sendResponse({ type: 'ready', message: 'MCP Server is ready' });
        process.stderr.write('MCP Server initialized and ready\n');
    }

    cleanup() {
        if (this.db) {
            try {
                this.db.close();
                process.stderr.write('Database connection closed\n');
            } catch (error) {
                process.stderr.write(`Error closing database: ${error}\n`);
            }
        }
    }
}

// Start the MCP server
new MCPServer(); 