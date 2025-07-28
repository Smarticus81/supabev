#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { eq, like, desc, sql, and, gte, lte } = require('drizzle-orm');

class MCPServer {
    constructor() {
        // Initialize Supabase database connection
        const client = postgres(process.env.DATABASE_URL, {
            prepare: false,
            ssl: 'require',
        });
        this.db = drizzle(client);
        this.client = client; // Store client for cleanup
        
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
                    // Voice agent compatibility - always ensure default clientId
                    return this.cartView({
                        clientId: params.clientId || 'default'
                    });
                case 'cart_clear':
                    // Voice agent compatibility - always ensure default clientId
                    return this.cartClear({
                        clientId: params.clientId || 'default'
                    });
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
                case 'set_drink_inventory':
                    return await this.setDrinkInventory(params);
                case 'bulk_update_inventory':
                    return await this.bulkUpdateInventory(params);
                case 'get_low_inventory_bottles':
                    return await this.getLowInventoryBottles(params);

                // Alias for voice commands
                case 'set_inventory':
                    return await this.setDrinkInventory({
                        drink_name: params.drink_name,
                        new_inventory: params.quantity || params.new_inventory,
                        reason: params.reason || 'Voice inventory update'
                    });

                // Drink menu management
                case 'create_drink':
                    return await this.createDrink(params);
                
                // Voice agent compatibility functions - FIXED VERSION
                case 'add_drink_to_cart':
                    return await this.cartAdd({
                        clientId: params.clientId || 'default', // Ensure default clientId
                        drink_name: params.drink_name,
                        serving_name: params.serving_name || 'bottle',
                        quantity: params.quantity || 1
                    });
                case 'search_drinks':
                    return await this.searchDrinks(params);
                case 'remove_drink_from_cart':
                    return this.cartRemove({
                        clientId: params.clientId || 'default', // Ensure default clientId
                        drink_name: params.drink_name,
                        quantity: params.quantity
                    });
                case 'process_order':
                    return await this.cartCreateOrder({
                        clientId: params.clientId || 'default', // Ensure default clientId
                        customer_name: params.customer_name
                    });
                case 'clear_cart':
                    return this.cartClear({
                        clientId: params.clientId || 'default' // Ensure default clientId
                    });
                case 'list_drinks':
                    return this.viewMenu(params);
                case 'get_drink':
                    return await this.getDrink(params);
                case 'get_inventory_status':
                    return await this.checkInventory(params);
                case 'cart_view':
                    return this.cartView({
                        clientId: params.clientId || 'default' // Ensure default clientId
                    });
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            process.stderr.write(`Error in tool ${toolName}: ${error}\n`);
            return { error: error.message };
        }
    }

    // --- INVENTORY FUNCTIONS (comprehensive fix) ---

    async checkInventory(params) {
        const { drink_name } = params;
        
        if (!drink_name) {
            return { error: 'drink_name is required' };
        }

        try {
            const result = await this.db.execute(
                sql`SELECT id, name, inventory, category, subcategory, price 
                    FROM drinks 
                    WHERE LOWER(name) = LOWER(${drink_name}) 
                    AND (is_active IS NULL OR is_active = true)
                    LIMIT 1`
            );
            
            const rows = result.rows || result || [];
            if (rows.length === 0) {
                return { 
                    success: false,
                    error: `Drink "${drink_name}" not found in inventory` 
                };
            }

            const drink = rows[0];
            return {
                success: true,
                id: drink.id,
                name: drink.name,
                inventory: parseInt(drink.inventory) || 0,
                category: drink.category,
                subcategory: drink.subcategory,
                price: drink.price,
                message: `Current inventory for ${drink.name}: ${drink.inventory} units`
            };
        } catch (error) {
            process.stderr.write(`Database error in checkInventory: ${error}\n`);
            return { 
                success: false,
                error: `Database error while checking inventory: ${error.message}` 
            };
        }
    }

    async addInventory(params) {
        const { drink_name, quantity } = params;
        
        if (!drink_name || quantity === undefined) {
            return { 
                success: false,
                error: 'drink_name and quantity are required' 
            };
        }

        if (quantity === 0) {
            return { 
                success: false,
                error: 'quantity must be non-zero' 
            };
        }

        try {
            // First check if drink exists
            const drinkResult = await this.db.execute(
                sql`SELECT id, name, inventory, category, subcategory 
                    FROM drinks 
                    WHERE LOWER(name) = LOWER(${drink_name}) 
                    AND (is_active IS NULL OR is_active = true)
                    LIMIT 1`
            );
            
            const drinkRows = drinkResult.rows || drinkResult || [];
            if (drinkRows.length === 0) {
                return { 
                    success: false,
                    error: `Drink "${drink_name}" not found` 
                };
            }

            const drink = drinkRows[0];
            
            // Calculate new inventory - ensure proper integer handling
            const currentInventory = parseInt(drink.inventory) || 0;
            const quantityToAdd = parseInt(quantity);
            const newInventory = currentInventory + quantityToAdd;

            if (newInventory < 0) {
                return { 
                    success: false,
                    error: `Cannot adjust inventory below zero. Current: ${currentInventory}, Change: ${quantityToAdd}` 
                };
            }

            // Update inventory using the drink's ID for precision
            const updateResult = await this.db.execute(
                sql`UPDATE drinks 
                    SET inventory = ${newInventory}, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ${drink.id}
                    RETURNING inventory`
            );
            
            // Verify the update worked
            if (!updateResult.rows || updateResult.rows.length === 0) {
                return {
                    success: false,
                    error: 'Failed to update inventory in database'
                };
            }
            
            // Determine unit name based on category
            let unitName = 'bottles';
            if (drink.category === 'Beer' && drink.subcategory === 'Hard Seltzer') {
                unitName = 'cans';
            } else if (drink.category === 'Beer') {
                unitName = 'bottles';
            } else if (drink.category === 'Non-Alcoholic') {
                unitName = 'cans';
            }

            const action = quantityToAdd > 0 ? 'Added' : 'Deducted';
            const absQuantity = Math.abs(quantityToAdd);

            return {
                success: true,
                drink_name: drink.name,
                drink_id: drink.id,
                units_adjusted: absQuantity,
                previous_inventory: currentInventory,
                new_inventory: newInventory,
                unit_name: unitName,
                message: `Successfully ${action.toLowerCase()} ${absQuantity} ${unitName} of ${drink.name}. New total: ${newInventory} ${unitName}`
            };
        } catch (error) {
            process.stderr.write(`Database error in addInventory: ${error}\n`);
            return { 
                success: false,
                error: `Database error while adjusting inventory: ${error.message}` 
            };
        }
    }

    async updateDrinkInventory(params) {
        const { drink_name, quantity_change, reason = 'Voice inventory update' } = params;
        
        if (!drink_name || quantity_change === undefined) {
            return { 
                success: false,
                error: 'drink_name and quantity_change are required' 
            };
        }
        
        try {
            // Find the drink first
            const drinkResult = await this.db.execute(
                sql`SELECT id, name, inventory, category, subcategory 
                    FROM drinks 
                    WHERE LOWER(name) = LOWER(${drink_name}) 
                    AND (is_active IS NULL OR is_active = true)
                    LIMIT 1`
            );

            const drinkRows = drinkResult.rows || drinkResult || [];
            if (drinkRows.length === 0) {
                return { 
                    success: false, 
                    error: `Drink "${drink_name}" not found in inventory` 
                };
            }

            const drink = drinkRows[0];
            const currentInventory = parseInt(drink.inventory) || 0;
            const changeAmount = parseInt(quantity_change);
            const newInventory = Math.max(0, currentInventory + changeAmount);
            
            // Update the specific drink record
            const updateResult = await this.db.execute(
                sql`UPDATE drinks 
                    SET inventory = ${newInventory}, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ${drink.id}
                    RETURNING inventory`
            );
            
            const updateRows = updateResult.rows || updateResult || [];
            // Verify the update worked
            if (updateRows.length === 0) {
                return {
                    success: false,
                    error: 'Failed to update inventory in database'
                };
            }

            const finalInventory = parseInt(updateRows[0].inventory);
            
            // Log the successful update for debugging
            process.stderr.write(`Successfully updated ${drink.name} inventory from ${currentInventory} to ${finalInventory}\n`);
            
            return {
                success: true,
                message: `Successfully updated ${drink.name} inventory to ${finalInventory} units`,
                drink_name: drink.name,
                drink_id: drink.id,
                previous_inventory: currentInventory,
                new_inventory: finalInventory,
                change: changeAmount,
                reason: reason
            };
        } catch (error) {
            process.stderr.write(`Error in updateDrinkInventory: ${error}\n`);
            return { 
                success: false, 
                error: `Failed to update inventory: ${error.message}` 
            };
        }
    }

    // Alternative function that sets inventory to an absolute value instead of relative change
    async setDrinkInventory(params) {
        const { drink_name, new_inventory, reason = 'Inventory set to absolute value' } = params;
        
        if (!drink_name || new_inventory === undefined) {
            return { 
                success: false,
                error: 'drink_name and new_inventory are required' 
            };
        }
        
        const newInventoryInt = parseInt(new_inventory);
        if (newInventoryInt < 0) {
            return {
                success: false,
                error: 'new_inventory cannot be negative'
            };
        }
        
        try {
            // Find the drink first
            const drinkResult = await this.db.execute(
                sql`SELECT id, name, inventory, category, subcategory 
                    FROM drinks 
                    WHERE LOWER(name) = LOWER(${drink_name}) 
                    AND (is_active IS NULL OR is_active = true)
                    LIMIT 1`
            );

            const drinkRows = drinkResult.rows || drinkResult || [];
            if (drinkRows.length === 0) {
                return { 
                    success: false, 
                    error: `Drink "${drink_name}" not found in inventory` 
                };
            }

            const drink = drinkRows[0];
            const currentInventory = parseInt(drink.inventory) || 0;
            
            // Set the inventory to the absolute value
            const updateResult = await this.db.execute(
                sql`UPDATE drinks 
                    SET inventory = ${newInventoryInt}, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ${drink.id}
                    RETURNING inventory`
            );
            
            const updateRows = updateResult.rows || updateResult || [];
            // Verify the update worked
            if (updateRows.length === 0) {
                return {
                    success: false,
                    error: 'Failed to set inventory in database'
                };
            }

            const finalInventory = parseInt(updateRows[0].inventory);
            
            // Log the successful update for debugging
            process.stderr.write(`Successfully set ${drink.name} inventory from ${currentInventory} to ${finalInventory}\n`);
            
            return {
                success: true,
                message: `Successfully set ${drink.name} inventory to ${finalInventory} units`,
                drink_name: drink.name,
                drink_id: drink.id,
                previous_inventory: currentInventory,
                new_inventory: finalInventory,
                change: finalInventory - currentInventory,
                reason: reason
            };
        } catch (error) {
            process.stderr.write(`Error in setDrinkInventory: ${error}\n`);
            return { 
                success: false, 
                error: `Failed to set inventory: ${error.message}` 
            };
        }
    }

    async bulkUpdateInventory(params) {
        const { updates } = params;
        
        if (!updates || !Array.isArray(updates)) {
            return { 
                success: false, 
                error: 'updates array is required' 
            };
        }
        
        const results = [];
        let successCount = 0;
        let failureCount = 0;
        
        for (const update of updates) {
            try {
                // Use setDrinkInventory if new_inventory is provided, otherwise use updateDrinkInventory
                let result;
                if (update.new_inventory !== undefined) {
                    result = await this.setDrinkInventory(update);
                } else {
                    result = await this.updateDrinkInventory(update);
                }
                
                results.push({
                    drink_name: update.drink_name,
                    ...result
                });
                
                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                }
            } catch (error) {
                results.push({
                    drink_name: update.drink_name,
                    success: false,
                    error: error.message
                });
                failureCount++;
            }
        }
        
        return {
            success: successCount > 0,
            message: `Bulk inventory update completed: ${successCount} successful, ${failureCount} failed`,
            results,
            summary: {
                total: updates.length,
                successful: successCount,
                failed: failureCount
            }
        };
    }

    async getLowInventoryBottles(params) {
        const { threshold = 5 } = params;
        
        try {
            // Simplified query to avoid complex aggregation issues
            const result = await this.db.execute(
                sql`SELECT id, name, inventory, category, subcategory, price
                    FROM drinks 
                    WHERE (is_active IS NULL OR is_active = true)
                    AND inventory <= ${threshold}
                    ORDER BY inventory ASC, name ASC`
            );
            
            const lowInventoryDrinks = result.rows || [];
            
            return {
                success: true,
                low_inventory_drinks: lowInventoryDrinks.map(drink => ({
                    ...drink,
                    inventory: parseInt(drink.inventory) || 0
                })),
                count: lowInventoryDrinks.length,
                threshold,
                message: `Found ${lowInventoryDrinks.length} drinks with inventory at or below ${threshold} units`
            };
        } catch (error) {
            process.stderr.write(`Error in getLowInventoryBottles: ${error}\n`);
            return { 
                success: false, 
                error: `Failed to get low inventory items: ${error.message}` 
            };
        }
    }

    // --- END INVENTORY FUNCTIONS ---

    // DEBUG LOGGING ADDED
    async cartAdd(params) {
        const { clientId, drink_name, quantity = 1, serving_name = 'bottle' } = params;
        
        // 🎯 DEBUG LOGGING
        console.log('🛒 MCP cartAdd called with:', {
            clientId: clientId,
            clientIdType: typeof clientId,
            drink_name,
            quantity,
            serving_name
        });
        
        if (!clientId || !drink_name) {
            return { error: 'clientId and drink_name are required' };
        }

        try {
            // Verify drink exists
            const drinkResult = await this.db.execute(
                sql`SELECT name, price FROM drinks WHERE LOWER(name) = LOWER(${drink_name}) LIMIT 1`
            );
            
            const drinkRows = drinkResult.rows || drinkResult || [];
            if (drinkRows.length === 0) {
                return { error: `Drink "${drink_name}" not found` };
            }

            const drink = drinkRows[0];

            // Get or create cart for client
            if (!this.cartStorage.has(clientId)) {
                console.log('🆕 Creating new cart for clientId:', clientId);
                this.cartStorage.set(clientId, []);
            } else {
                console.log('📦 Using existing cart for clientId:', clientId);
            }
            
            const cart = this.cartStorage.get(clientId);
            console.log('🛒 Current cart before adding:', cart);
            
            // Check if item already in cart
            const existingItem = cart.find(item => 
                item.drink_name.toLowerCase() === drink.name.toLowerCase() &&
                item.serving_name === serving_name
            );
            
            if (existingItem) {
                existingItem.quantity += quantity;
                console.log('📈 Updated existing item quantity:', existingItem);
            } else {
                const newItem = {
                    drink_name: drink.name,
                    quantity,
                    price: drink.price,
                    serving_name
                };
                cart.push(newItem);
                console.log('➕ Added new item to cart:', newItem);
            }

            console.log('🛒 Cart after adding:', cart);
            console.log('🗂️ All cart storage keys:', Array.from(this.cartStorage.keys()));

            return {
                success: true,
                message: `Added ${quantity} ${drink.name} to cart`,
                cart: [...cart], // Return copy of cart
                clientId: clientId // Return clientId for verification
            };
        } catch (error) {
            console.error('❌ Error in cartAdd:', error);
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

    async cartCreateOrder(params) {
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

            // Create order from cart (await the async function)
            const result = await this.createOrder({
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

        // Use a transaction with proper error handling for PostgreSQL
        try {
            const result = await this.client.begin(async db => {
                // Check stock for all items
                for (const item of items) {
                    const drinkResult = await db`
                        SELECT name, inventory, price FROM drinks 
                        WHERE LOWER(name) = LOWER(${item.drink_name})
                    `;
                    
                    if (drinkResult.length === 0) {
                        throw new Error(`Drink "${item.drink_name}" not found`);
                    }
                    
                    const drink = drinkResult[0];
                    if (drink.inventory < item.quantity) {
                        throw new Error(`Insufficient stock for ${item.drink_name}: need ${item.quantity} but only ${drink.inventory} available`);
                    }
                }

                // Calculate totals (use prices from database)
                let subtotal = 0;
                for (const item of items) {
                    const drinkResult = await db`
                        SELECT price FROM drinks WHERE LOWER(name) = LOWER(${item.drink_name})
                    `;
                    const price = parseFloat(drinkResult[0].price);
                    subtotal += item.quantity * price;
                }
                
                const tax = subtotal * 0.08; // 8% tax
                const total = subtotal + tax;

                // Prepare items for JSON storage BEFORE creating order
                const orderItems = [];
                for (const item of items) {
                    const drinkResult = await db`
                        SELECT price FROM drinks WHERE LOWER(name) = LOWER(${item.drink_name})
                    `;
                    const price = parseFloat(drinkResult[0].price);
                    
                    orderItems.push({
                        name: item.drink_name,
                        quantity: item.quantity,
                        price: price,
                        total: price * item.quantity
                    });
                }

                // Create order in database WITH items included
                const orderResult = await db`
                    INSERT INTO orders (
                        customer_id, subtotal, tax_amount, total, 
                        payment_method, payment_status, status,
                        order_number, items, created_at
                    ) 
                    VALUES (
                        null, ${subtotal}, ${tax}, ${total},
                        ${payment_method}, 'completed', 'completed',
                        'ORD-' || extract(epoch from now())::bigint, ${JSON.stringify(orderItems)}, now()
                    ) 
                    RETURNING id, order_number
                `;
                
                const orderId = orderResult[0].id;
                const orderNumber = orderResult[0].order_number;

                // Deduct inventory
                for (const item of items) {
                    await db`
                        UPDATE drinks 
                        SET inventory = inventory - ${item.quantity}
                        WHERE LOWER(name) = LOWER(${item.drink_name})
                    `;
                }

                return {
                    orderId,
                    orderNumber,
                    subtotal: subtotal.toFixed(2),
                    tax: tax.toFixed(2),
                    total: total.toFixed(2),
                    payment_method
                };
            });

            return {
                success: true,
                order_id: result.orderId,
                order_number: result.orderNumber,
                subtotal: result.subtotal,
                tax: result.tax,
                total: result.total,
                payment_method: result.payment_method,
                message: `Order ${result.orderNumber} created and inventory updated successfully`
            };

        } catch (error) {
            console.error(`Transaction error in createOrder: ${error}`);
            return { 
                success: false,
                error: `Failed to create order: ${error.message}` 
            };
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
                tts_voice: 'shimmer',
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
            // In a production system, you would save this to Supabase if needed
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

    async createDrink(params) {
        const { 
            name, 
            category, 
            subcategory = null,
            price, 
            inventory = 0,
            unit_type = 'ounce',
            unit_volume_oz = null,
            cost_per_unit = null,
            description = null,
            image_url = null,
            ingredients = []
        } = params;
        
        try {
            // Convert price from dollars to cents
            const priceInCents = Math.round(price * 100);
            const costInCents = cost_per_unit ? Math.round(cost_per_unit * 100) : null;
            
            // Set appropriate serving sizes and volume based on category
            let serving_size_oz = unit_volume_oz;
            let servings_per_container = 1;
            
            if (!serving_size_oz) {
                switch (category.toLowerCase()) {
                    case 'spirits':
                        serving_size_oz = 1.5;
                        servings_per_container = Math.floor(25.4 / 1.5); // ~17 shots per 750ml bottle
                        break;
                    case 'wine':
                        serving_size_oz = 5.0;
                        servings_per_container = Math.floor(25.4 / 5.0); // ~5 glasses per 750ml bottle
                        break;
                    case 'beer':
                        serving_size_oz = 12.0;
                        servings_per_container = 1; // 1 serving per 12oz bottle
                        break;
                    case 'cocktails':
                        serving_size_oz = 8.0;
                        servings_per_container = 1; // 1 serving per cocktail
                        break;
                    default:
                        serving_size_oz = 8.0;
                        servings_per_container = 1;
                }
            }
            
            // Insert the new drink
            const result = await this.db.execute(
                sql`
                    INSERT INTO drinks (
                        name, category, subcategory, price, inventory, 
                        unit_type, unit_volume_oz, serving_size_oz, 
                        servings_per_container, cost_per_unit, 
                        description, image_url, is_active
                    ) VALUES (
                        ${name}, ${category}, ${subcategory}, ${priceInCents}, ${inventory},
                        ${unit_type}, ${unit_volume_oz}, ${serving_size_oz},
                        ${servings_per_container}, ${costInCents},
                        ${description}, ${image_url}, true
                    ) RETURNING *
                `
            );
            
            const newDrink = result.rows[0];
            
            // If ingredients are provided, create cocktail recipe entries
            // (This would require a cocktail_recipes table - for now we'll store in description)
            if (ingredients && ingredients.length > 0) {
                const ingredientsList = ingredients.map(ing => 
                    `${ing.amount} ${ing.unit} ${ing.ingredient_name}`
                ).join(', ');
                
                const enhancedDescription = description 
                    ? `${description}. Ingredients: ${ingredientsList}`
                    : `Ingredients: ${ingredientsList}`;
                
                // Update the drink with ingredient information
                await this.db.execute(
                    sql`
                        UPDATE drinks 
                        SET description = ${enhancedDescription}
                        WHERE id = ${newDrink.id}
                    `
                );
            }
            
            return {
                success: true,
                message: `Successfully created ${name}`,
                drink: {
                    ...newDrink,
                    price: newDrink.price / 100, // Convert back to dollars for display
                    cost_per_unit: newDrink.cost_per_unit ? newDrink.cost_per_unit / 100 : null
                },
                ingredients: ingredients || []
            };
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to create drink: ${error.message}` 
            };
        }
    }

    async searchDrinks(params) {
        const { query, category, max_results = 10 } = params;
        
        try {
            let dbQuery;
            
            if (query && category) {
                // Search by both query and category
                const searchPattern = `%${query.toLowerCase()}%`;
                dbQuery = sql`
                    SELECT name, category, subcategory, price, inventory
                    FROM drinks 
                    WHERE is_active = true 
                    AND LOWER(category) = LOWER(${category})
                    AND (LOWER(name) LIKE ${searchPattern} OR LOWER(subcategory) LIKE ${searchPattern})
                    ORDER BY category, name
                    LIMIT ${max_results}
                `;
            } else if (query) {
                // Search by query only
                const searchPattern = `%${query.toLowerCase()}%`;
                dbQuery = sql`
                    SELECT name, category, subcategory, price, inventory
                    FROM drinks 
                    WHERE is_active = true 
                    AND (LOWER(name) LIKE ${searchPattern} OR LOWER(category) LIKE ${searchPattern} OR LOWER(subcategory) LIKE ${searchPattern})
                    ORDER BY category, name
                    LIMIT ${max_results}
                `;
            } else if (category) {
                // Filter by category only
                dbQuery = sql`
                    SELECT name, category, subcategory, price, inventory
                    FROM drinks 
                    WHERE is_active = true 
                    AND LOWER(category) = LOWER(${category})
                    ORDER BY name
                    LIMIT ${max_results}
                `;
            } else {
                // Return all drinks
                dbQuery = sql`
                    SELECT name, category, subcategory, price, inventory
                    FROM drinks 
                    WHERE is_active = true 
                    ORDER BY category, name
                    LIMIT ${max_results}
                `;
            }
            
            const result = await this.db.execute(dbQuery);
            const drinks = result.rows || result || [];
            
            return {
                success: true,
                drinks: drinks,
                total_found: drinks.length,
                search_query: query,
                category_filter: category
            };
        } catch (error) {
            process.stderr.write(`Error in searchDrinks: ${error}\n`);
            return { 
                success: false, 
                error: `Failed to search drinks: ${error.message}` 
            };
        }
    }

    async getDrink(params) {
        const { id, name } = params;
        
        try {
            let result;
            
            if (id) {
                result = await this.db.execute(
                    sql`SELECT * FROM drinks WHERE id = ${id} LIMIT 1`
                );
            } else if (name) {
                result = await this.db.execute(
                    sql`SELECT * FROM drinks WHERE LOWER(name) LIKE LOWER(${`%${name}%`}) LIMIT 1`
                );
            } else {
                return {
                    success: false,
                    error: 'Either id or name parameter is required'
                };
            }
            
            if (!result.rows || result.rows.length === 0) {
                return {
                    success: false,
                    error: `Drink not found with ${id ? 'id: ' + id : 'name: ' + name}`
                };
            }
            
            const drink = result.rows[0];
            
            // Add serving options for compatibility
            drink.serving_options = [{
                name: drink.unit_type || 'serving',
                volume_oz: drink.serving_size_oz || 1,
                price: drink.price
            }];
            
            return {
                success: true,
                drink: drink
            };
        } catch (error) {
            process.stderr.write(`Error in getDrink: ${error}\n`);
            return { 
                success: false, 
                error: `Failed to get drink: ${error.message}` 
            };
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
        // Close Supabase database connection
        if (this.client) {
            this.client.end();
        }
        process.stderr.write('Cleaning up MCP server\n');
    }
}

// Start the MCP server
new MCPServer();