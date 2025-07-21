#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { drinks, orders, customers, venues, eventBookings, inventory, transactions } = require('../db/schema');
const { eq, like, desc, sql, and, gte, lte } = require('drizzle-orm');
const path = require('path');
const fs = require('fs');

class MCPServer {
    constructor() {
        // Initialize Neon database connection
        const sqlConnection = neon(process.env.DATABASE_URL);
        this.db = drizzle(sqlConnection, { 
            schema: { drinks, orders, customers, venues, eventBookings, inventory, transactions }
        });
        
        this.cartStorage = new Map(); // In-memory cart storage by clientId
        this.paymentMethods = new Map(); // In-memory payment methods by clientId
        this.requestBuffer = '';
        this.isReady = false;
        
        this.setupProcessHandlers();
        this.notifyReady();
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
                    return await this.checkInventory(params);
                case 'add_inventory':
                    return await this.addInventory(params);
                case 'cart_add':
                    return await this.cartAdd(params);
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
                case 'payment_select':
                    return this.paymentSelect(params);
                case 'payment_process':
                    return this.paymentProcess(params);
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            process.stderr.write(`Error in tool ${toolName}: ${error}\n`);
            return { error: error.message };
        }
    }

    async checkInventory(params) {
        const { drink_name } = params;
        
        if (!drink_name) {
            return { error: 'drink_name is required' };
        }

        try {
            const result = await this.db
                .select()
                .from(drinks)
                .where(sql`lower(${drinks.name}) = lower(${drink_name})`)
                .limit(1);
            
            if (!result || result.length === 0) {
                return { error: `Drink "${drink_name}" not found in inventory` };
            }

            return {
                ...result[0],
                success: true
            };
        } catch (error) {
            process.stderr.write(`Database error in checkInventory: ${error}\n`);
            return { error: 'Database error while checking inventory' };
        }
    }

    async addInventory(params) {
        const { drink_name, quantity } = params;
        
        if (!drink_name || quantity === undefined) {
            return { error: 'drink_name and quantity are required' };
        }

        if (quantity === 0) {
            return { error: 'quantity must be non-zero' };
        }

        try {
            // First check if drink exists
            const drinkResult = await this.db
                .select()
                .from(drinks)
                .where(sql`lower(${drinks.name}) = lower(${drink_name})`)
                .limit(1);
            
            if (!drinkResult || drinkResult.length === 0) {
                return { error: `Drink "${drink_name}" not found` };
            }

            const drink = drinkResult[0];
            
            // Calculate new inventory (assuming inventory is in units)
            const currentInventory = drink.inventory || 0;
            const newInventory = currentInventory + quantity;

            if (newInventory < 0) {
                return { error: 'Cannot adjust inventory below zero' };
            }

            // Update inventory
            await this.db
                .update(drinks)
                .set({ inventory: newInventory })
                .where(sql`lower(${drinks.name}) = lower(${drink_name})`);
            
            // Determine unit name
            let unitName = 'bottles';
            if (drink.category === 'Beer' && drink.subcategory === 'Hard Seltzer') {
                unitName = 'cans';
            } else if (drink.category === 'Beer') {
                unitName = 'bottles';
            } else if (drink.category === 'Non-Alcoholic') {
                unitName = 'cans';
            }

            const action = quantity > 0 ? 'Added' : 'Deducted';
            const absQuantity = Math.abs(quantity);

            return {
                success: true,
                drink_name: drink.name,
                units_adjusted: absQuantity,
                total_units: newInventory,
                unit_name: unitName,
                message: `${action} ${absQuantity} ${unitName} of ${drink.name} in inventory`
            };
        } catch (error) {
            process.stderr.write(`Database error in addInventory: ${error}\n`);
            return { error: 'Database error while adjusting inventory' };
        }
    }

    async cartAdd(params) {
        const { clientId, drink_name, quantity = 1, serving_name = 'bottle' } = params;
        
        if (!clientId || !drink_name) {
            return { error: 'clientId and drink_name are required' };
        }

        try {
            // Verify drink exists
            const drinkResult = await this.db
                .select({ name: drinks.name, price: drinks.price })
                .from(drinks)
                .where(sql`lower(${drinks.name}) = lower(${drink_name})`)
                .limit(1);
            
            if (!drinkResult || drinkResult.length === 0) {
                return { error: `Drink "${drink_name}" not found` };
            }

            const drink = drinkResult[0];

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

            // Get payment method if selected
            const payment_method = this.paymentMethods.get(clientId) || 'cash';

            // Create order from cart
            const result = this.createOrder({
                items: cart,
                customer_name,
                payment_method
            });

            if (result.success) {
                // Clear cart and payment method after successful order
                this.cartStorage.set(clientId, []);
                this.paymentMethods.delete(clientId);
            }

            return result;
        } catch (error) {
            process.stderr.write(`Error in cartCreateOrder: ${error}\n`);
            return { error: 'Failed to create order from cart' };
        }
    }

    createOrder(params) {
        const { items, customer_name, payment_method = 'cash' } = params;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return { error: 'items array is required and cannot be empty' };
        }

        const transaction = this.db.transaction(() => {
            try {
                // Check stock for all items
                const stockCheckStmt = this.db.prepare(`
                    SELECT name, inventory_oz, unit_volume_oz
                    FROM drinks 
                    WHERE name = ? COLLATE NOCASE
                `);

                for (const item of items) {
                    const drink = stockCheckStmt.get(item.drink_name);
                    if (!drink) {
                        throw new Error(`Drink "${item.drink_name}" not found`);
                    }
                    const neededOz = item.quantity * drink.unit_volume_oz;
                    if (drink.inventory_oz < neededOz) {
                        throw new Error(`Insufficient stock for ${item.drink_name}: need ${item.quantity} but only ${Math.floor(drink.inventory_oz / drink.unit_volume_oz)} available`);
                    }
                }

                // Calculate totals
                const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                const tax = subtotal * 0.08; // 8% tax
                const total = subtotal + tax;

                // Create order in database
                const insertOrder = this.db.prepare(`
                    INSERT INTO orders (customer_name, total_amount, status, payment_method)
                    VALUES (?, ?, 'completed', ?)
                `);
                
                const orderResult = insertOrder.run(customer_name, total, payment_method);
                const orderId = orderResult.lastInsertRowid;

                // Add order items
                const insertOrderItem = this.db.prepare(`
                    INSERT INTO order_items (order_id, drink_name, quantity, price, serving_name)
                    VALUES (?, ?, ?, ?, ?)
                `);

                for (const item of items) {
                    insertOrderItem.run(
                        orderId,
                        item.drink_name,
                        item.quantity,
                        item.price,
                        item.serving_name || 'bottle'
                    );
                }

                // Deduct inventory
                const updateInventory = this.db.prepare(`
                    UPDATE drinks 
                    SET inventory_oz = inventory_oz - ?, updated_at = CURRENT_TIMESTAMP
                    WHERE name = ? COLLATE NOCASE
                `);

                for (const item of items) {
                    const drink = stockCheckStmt.get(item.drink_name);
                    const deductOz = item.quantity * drink.unit_volume_oz;
                    updateInventory.run(deductOz, item.drink_name);
                }

                return {
                    success: true,
                    order_id: orderId,
                    subtotal: subtotal.toFixed(2),
                    tax: tax.toFixed(2),
                    total: total.toFixed(2),
                    payment_method,
                    message: `Order ${orderId} created and inventory updated successfully`
                };
            } catch (error) {
                throw error;
            }
        });

        try {
            return transaction();
        } catch (error) {
            process.stderr.write(`Transaction error in createOrder: ${error}\n`);
            return { error: error.message };
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
                WHERE (inventory_oz / unit_volume_oz) < 5
                ORDER BY units ASC
            `);
            const lowStock = lowStockStmt.all();

            // Total inventory value
            const valueStmt = this.db.prepare(`
                SELECT SUM((inventory_oz / unit_volume_oz) * price) as total_value
                FROM drinks
            `);
            const { total_value } = valueStmt.get();

            // Categories summary
            const categoriesStmt = this.db.prepare(`
                SELECT category, COUNT(*) as count, SUM((inventory_oz / unit_volume_oz) * price) as value
                FROM drinks
                GROUP BY category
            `);
            const categories = categoriesStmt.all();

            return {
                success: true,
                lowStock,  // Renamed for consistency
                total_inventory_value: total_value ? total_value.toFixed(2) : '0.00',
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
                topSellers,  // Renamed for consistency
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
            const stmt = this.db.prepare(`
                SELECT * FROM config WHERE key IN (
                    'tts_provider', 'tts_voice', 'tts_rate', 'tts_temperature',
                    'vad_threshold', 'prefix_padding', 'silence_duration', 'max_tokens',
                    'response_style', 'audio_gain', 'noise_suppression', 'echo_cancellation',
                    'personality_mode', 'verbosity'
                )
            `);
            const rows = stmt.all();
            const config = rows.reduce((acc, row) => {
                acc[row.key] = row.value;
                return acc;
            }, {});
            
            // Ensure we always return a config with fallback to working provider
            const finalConfig = Object.keys(config).length > 0 ? config : { 
                tts_provider: 'openai', 
                tts_voice: 'alloy',
                tts_rate: '1.0',
                tts_temperature: '0.5',
                vad_threshold: '0.5',
                prefix_padding: '200',
                silence_duration: '300',
                max_tokens: '1500',
                response_style: 'efficient',
                audio_gain: '1.0',
                noise_suppression: 'true',
                echo_cancellation: 'true',
                personality_mode: 'professional',
                verbosity: 'balanced'
            };
            
            // Convert string values to appropriate types
            if (finalConfig.tts_rate) finalConfig.rate = parseFloat(finalConfig.tts_rate);
            if (finalConfig.tts_temperature) finalConfig.temperature = parseFloat(finalConfig.tts_temperature);
            if (finalConfig.vad_threshold) finalConfig.vad_threshold = parseFloat(finalConfig.vad_threshold);
            if (finalConfig.prefix_padding) finalConfig.prefix_padding = parseInt(finalConfig.prefix_padding);
            if (finalConfig.silence_duration) finalConfig.silence_duration = parseInt(finalConfig.silence_duration);
            if (finalConfig.max_tokens) finalConfig.max_tokens = parseInt(finalConfig.max_tokens);
            if (finalConfig.audio_gain) finalConfig.audio_gain = parseFloat(finalConfig.audio_gain);
            if (finalConfig.noise_suppression) finalConfig.noise_suppression = finalConfig.noise_suppression === 'true';
            if (finalConfig.echo_cancellation) finalConfig.echo_cancellation = finalConfig.echo_cancellation === 'true';
            
            return {
                success: true,
                config: finalConfig
            };
        } catch (error) {
            return { error: 'Failed to get TTS config' };
        }
    }

    setTtsConfig(params) {
        const { 
            tts_provider, tts_voice, rate, temperature,
            vad_threshold, prefix_padding, silence_duration, max_tokens,
            response_style, audio_gain, noise_suppression, echo_cancellation,
            personality_mode, verbosity
        } = params;
        
        if (!tts_provider || !tts_voice) {
            return { error: 'tts_provider and tts_voice required' };
        }
        
        try {
            const insert = this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
            insert.run('tts_provider', tts_provider);
            insert.run('tts_voice', tts_voice);
            
            // Store all configuration parameters
            if (rate !== undefined) insert.run('tts_rate', rate.toString());
            if (temperature !== undefined) insert.run('tts_temperature', temperature.toString());
            if (vad_threshold !== undefined) insert.run('vad_threshold', vad_threshold.toString());
            if (prefix_padding !== undefined) insert.run('prefix_padding', prefix_padding.toString());
            if (silence_duration !== undefined) insert.run('silence_duration', silence_duration.toString());
            if (max_tokens !== undefined) insert.run('max_tokens', max_tokens.toString());
            if (response_style !== undefined) insert.run('response_style', response_style);
            if (audio_gain !== undefined) insert.run('audio_gain', audio_gain.toString());
            if (noise_suppression !== undefined) insert.run('noise_suppression', noise_suppression.toString());
            if (echo_cancellation !== undefined) insert.run('echo_cancellation', echo_cancellation.toString());
            if (personality_mode !== undefined) insert.run('personality_mode', personality_mode);
            if (verbosity !== undefined) insert.run('verbosity', verbosity);
            
            return { success: true };
        } catch (error) {
            return { error: 'Failed to set TTS config' };
        }
    }

    paymentSelect(params) {
        const { clientId, method } = params;
        if (!clientId || !method) {
            return { error: 'clientId and method are required' };
        }
        if (!['card', 'cash'].includes(method)) {
            return { error: 'Invalid payment method. Must be "card" or "cash"' };
        }
        this.paymentMethods.set(clientId, method);
        return {
            success: true,
            method,
            message: `Payment method set to ${method}`
        };
    }

    paymentProcess(params) {
        const { clientId } = params;
        if (!clientId) {
            return { error: 'clientId is required' };
        }
        // Simulate payment processing
        // In real system, integrate with payment gateway
        const method = this.paymentMethods.get(clientId) || 'cash';
        // Assume success
        return {
            success: true,
            method,
            message: 'Payment processed successfully'
        };
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
        // Neon database connections are handled automatically
        // No manual cleanup needed
        process.stderr.write('Cleaning up MCP server\n');
    }
}

// Start the MCP server
new MCPServer();