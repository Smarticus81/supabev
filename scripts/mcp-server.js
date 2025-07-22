#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, like, desc, sql, and, gte, lte } = require('drizzle-orm');

class MCPServer {
    constructor() {
        // Initialize Neon database connection
        const sqlConnection = neon(process.env.DATABASE_URL);
        this.db = drizzle(sqlConnection);
        
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
                
                // Advanced inventory tools
                case 'update_drink_inventory':
                    return await this.updateDrinkInventory(params);
                case 'bulk_update_inventory':
                    return await this.bulkUpdateInventory(params);
                case 'get_low_inventory_bottles':
                    return await this.getLowInventoryBottles(params);
                
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
            const result = await this.db.execute(
                sql`SELECT * FROM drinks WHERE LOWER(name) = LOWER(${drink_name}) LIMIT 1`
            );
            
            if (!result.rows || result.rows.length === 0) {
                return { error: `Drink "${drink_name}" not found in inventory` };
            }

            return {
                ...result.rows[0],
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
            const drinkResult = await this.db.execute(
                sql`SELECT * FROM drinks WHERE LOWER(name) = LOWER(${drink_name}) LIMIT 1`
            );
            
            if (!drinkResult.rows || drinkResult.rows.length === 0) {
                return { error: `Drink "${drink_name}" not found` };
            }

            const drink = drinkResult.rows[0];
            
            // Calculate new inventory (assuming inventory is in units)
            const currentInventory = drink.inventory || 0;
            const newInventory = currentInventory + quantity;

            if (newInventory < 0) {
                return { error: 'Cannot adjust inventory below zero' };
            }

            // Update inventory
            await this.db.execute(
                sql`UPDATE drinks SET inventory = ${newInventory} WHERE LOWER(name) = LOWER(${drink_name})`
            );
            
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
            const drinkResult = await this.db.execute(
                sql`SELECT name, price FROM drinks WHERE LOWER(name) = LOWER(${drink_name}) LIMIT 1`
            );
            
            if (!drinkResult.rows || drinkResult.rows.length === 0) {
                return { error: `Drink "${drink_name}" not found` };
            }

            const drink = drinkResult.rows[0];

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

    async createOrder(params) {
        const { items, customer_name, payment_method = 'cash' } = params;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return { error: 'items array is required and cannot be empty' };
        }

        try {
            // Begin transaction
            await this.db.execute(sql`BEGIN`);

            try {
                // Check stock for all items
                for (const item of items) {
                    const drinkResult = await this.db.execute(
                        sql`SELECT name, inventory FROM drinks WHERE LOWER(name) = LOWER(${item.drink_name})`
                    );
                    
                    if (!drinkResult.rows || drinkResult.rows.length === 0) {
                        throw new Error(`Drink "${item.drink_name}" not found`);
                    }
                    
                    const drink = drinkResult.rows[0];
                    if (drink.inventory < item.quantity) {
                        throw new Error(`Insufficient stock for ${item.drink_name}: need ${item.quantity} but only ${drink.inventory} available`);
                    }
                }

                // Calculate totals
                const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                const tax = subtotal * 0.08; // 8% tax
                const total = subtotal + tax;

                // Create order in database
                const orderResult = await this.db.execute(
                    sql`INSERT INTO orders (customer_name, total_amount, status, payment_method) 
                        VALUES (${customer_name}, ${total}, 'completed', ${payment_method}) 
                        RETURNING id`
                );
                
                const orderId = orderResult.rows[0].id;

                // Add order items
                for (const item of items) {
                    await this.db.execute(
                        sql`INSERT INTO order_items (order_id, drink_name, quantity, price, serving_name)
                            VALUES (${orderId}, ${item.drink_name}, ${item.quantity}, ${item.price}, ${item.serving_name || 'bottle'})`
                    );
                }

                // Deduct inventory
                for (const item of items) {
                    await this.db.execute(
                        sql`UPDATE drinks 
                            SET inventory = inventory - ${item.quantity}
                            WHERE LOWER(name) = LOWER(${item.drink_name})`
                    );
                }

                // Commit transaction
                await this.db.execute(sql`COMMIT`);

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
                // Rollback on error
                await this.db.execute(sql`ROLLBACK`);
                throw error;
            }
        } catch (error) {
            process.stderr.write(`Transaction error in createOrder: ${error}\n`);
            return { error: error.message };
        }
    }

    async viewMenu(params) {
        try {
            const result = await this.db.execute(
                sql`SELECT name, category, subcategory, price, inventory
                    FROM drinks 
                    ORDER BY category, name`
            );
            
            const drinks = result.rows;
            
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

    async healthCheck() {
        try {
            // Test database connection
            const result = await this.db.execute(sql`SELECT 1 as test`);
            
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

    async inventoryInsights(params) {
        try {
            // Low stock items (less than 5 units)
            const lowStockResult = await this.db.execute(
                sql`SELECT name, inventory as units
                    FROM drinks 
                    WHERE inventory < 5
                    ORDER BY inventory ASC`
            );
            const lowStock = lowStockResult.rows;

            // Total inventory value
            const valueResult = await this.db.execute(
                sql`SELECT SUM(inventory * price) as total_value FROM drinks`
            );
            const total_value = valueResult.rows[0]?.total_value || 0;

            // Categories summary
            const categoriesResult = await this.db.execute(
                sql`SELECT category, COUNT(*) as count, SUM(inventory * price) as value
                    FROM drinks
                    GROUP BY category`
            );
            const categories = categoriesResult.rows;

            return {
                success: true,
                lowStock,
                total_inventory_value: total_value ? total_value.toFixed(2) : '0.00',
                category_summary: categories,
                message: 'Inventory insights generated'
            };
        } catch (error) {
            process.stderr.write(`Error in inventoryInsights: ${error}\n`);
            return { error: 'Failed to generate inventory insights' };
        }
    }

    async salesInsights(params) {
        try {
            // Top selling drinks
            const topSellersResult = await this.db.execute(
                sql`SELECT drink_name, SUM(quantity) as total_sold, SUM(quantity * price) as revenue
                    FROM order_items
                    GROUP BY drink_name
                    ORDER BY total_sold DESC
                    LIMIT 10`
            );
            const topSellers = topSellersResult.rows;

            // Total sales
            const totalSalesResult = await this.db.execute(
                sql`SELECT SUM(total_amount) as total_revenue, COUNT(*) as order_count
                    FROM orders
                    WHERE status = 'completed'`
            );
            const { total_revenue, order_count } = totalSalesResult.rows[0] || { total_revenue: 0, order_count: 0 };

            // Recent orders
            const recentResult = await this.db.execute(
                sql`SELECT * FROM orders
                    ORDER BY created_at DESC
                    LIMIT 5`
            );
            const recentOrders = recentResult.rows;

            return {
                success: true,
                topSellers,
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
            // Return optimized OpenAI configuration for fast, unlimited responses
            const finalConfig = { 
                tts_provider: 'openai', 
                tts_voice: 'alloy',
                rate: 1.4, // Faster speech speed (1.4x normal)
                temperature: 0.6, // Minimum required by OpenAI Realtime API
                vad_threshold: 0.3, // More sensitive voice detection
                prefix_padding: 100, // Reduced padding for faster response
                silence_duration: 200, // Shorter silence detection for quicker responses
                max_tokens: 2500, // Increased token limit
                response_style: 'efficient',
                audio_gain: 1.0,
                noise_suppression: true,
                echo_cancellation: true,
                personality_mode: 'professional',
                verbosity: 'balanced'
            };
            
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
            // For now, just return success since we're using in-memory config
            // In a production system, you would save this to NeonDB if needed
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

    // Advanced inventory management tools
    async updateDrinkInventory(params) {
        const { drink_name, quantity_change, reason = 'Voice inventory update' } = params;
        
        try {
            // Use the consolidated inventory function to get current total
            const currentResult = await this.db.execute(
                sql`SELECT * FROM get_drink_inventory(${drink_name})`
            );
            
            if (!currentResult.rows.length) {
                return { success: false, error: 'Drink not found' };
            }
            
            const currentDrink = currentResult.rows[0];
            const newTotalInventory = Math.max(0, currentDrink.total_inventory + quantity_change);
            
            // For simplicity, update the first entry with the new total inventory
            // and set others to 0 (consolidation approach)
            const firstDrinkResult = await this.db.execute(
                sql`SELECT id FROM drinks WHERE LOWER(name) = LOWER(${drink_name}) AND is_active = true ORDER BY created_at ASC LIMIT 1`
            );
            
            if (firstDrinkResult.rows.length > 0) {
                const firstDrinkId = firstDrinkResult.rows[0].id;
                
                // Set all other entries to 0
                await this.db.execute(
                    sql`UPDATE drinks SET inventory = 0 WHERE LOWER(name) = LOWER(${drink_name}) AND id != ${firstDrinkId} AND is_active = true`
                );
                
                // Set the first entry to the new total
                await this.db.execute(
                    sql`UPDATE drinks SET inventory = ${newTotalInventory}, updated_at = NOW() WHERE id = ${firstDrinkId}`
                );
            }
            
            return {
                success: true,
                message: `Updated ${drink_name} inventory`,
                previous_inventory: currentDrink.total_inventory,
                new_inventory: newTotalInventory,
                change: quantity_change
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async bulkUpdateInventory(params) {
        const { updates } = params;
        const results = [];
        
        for (const update of updates) {
            const result = await this.updateDrinkInventory(update);
            results.push({
                drink_name: update.drink_name,
                ...result
            });
        }
        
        return {
            success: true,
            message: 'Bulk inventory update completed',
            results,
            updated: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };
    }

    async getLowInventoryBottles(params) {
        const { threshold = 5 } = params;
        
        try {
            // Use consolidated inventory to avoid duplicates
            const result = await this.db.execute(
                sql`
                    SELECT 
                        name, 
                        SUM(inventory) as inventory,
                        category
                    FROM drinks 
                    WHERE is_active = true
                    GROUP BY name, category
                    HAVING SUM(inventory) <= ${threshold}
                    ORDER BY SUM(inventory) ASC
                `
            );
            
            return {
                success: true,
                low_inventory_drinks: result.rows,
                count: result.rows.length,
                threshold
            };
        } catch (error) {
            return { success: false, error: error.message };
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
        // Neon database connections are handled automatically
        // No manual cleanup needed
        process.stderr.write('Cleaning up MCP server\n');
    }
}

// Start the MCP server
new MCPServer();