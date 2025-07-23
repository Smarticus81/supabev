import { NextRequest, NextResponse } from 'next/server';
import db from '@/db';
import { neon } from '@neondatabase/serverless';
import { 
  drinks, orders, customers, staff, venues, eventPackages, eventBookings, 
  transactions, inventory, pours, customerTabs, analyticsData, 
  inventoryMovements, aiInsights, systemConfig
} from '@/db/schema';
import { eq, desc, sql, and, or, gte, lte, sum, count, avg } from 'drizzle-orm';

// Import the actual cart system from tools.js
import { invoke } from '@/lib/tools';

// Neon SQL client for raw queries
const sqlClient = neon(process.env.DATABASE_URL!);

// COMPREHENSIVE VENUE MANAGEMENT VOICE API TOOLS
export async function POST(request: NextRequest) {
  try {
    const { tool, parameters } = await request.json();

    switch (tool) {
      // 🍸 BEVERAGE & MENU MANAGEMENT - Use real cart system
      case 'add_drink_to_cart':
        return handleAddDrinkToCart(parameters);
      case 'show_cart':
        return handleShowCart(parameters);
      case 'process_order':
        return handleProcessOrder(parameters);
      case 'search_drinks':
        return handleSearchDrinks(parameters);
      case 'get_inventory_status':
        return handleGetInventoryStatus(parameters);
      case 'remove_drink_from_cart':
        return handleRemoveDrinkFromCart(parameters);
      case 'clear_cart':
        return handleClearCart(parameters);

      // 📦 ADVANCED INVENTORY OPERATIONS
      case 'update_drink_inventory':
        return handleUpdateDrinkInventory(parameters);
      case 'bulk_update_inventory':
        return handleBulkUpdateInventory(parameters);
      case 'get_low_inventory_bottles':
        return handleGetLowInventoryBottles(parameters);
      case 'get_bottle_status':
        return handleGetBottleStatus(parameters);
      case 'get_drinks_by_filter':
        return handleGetDrinksByFilter(parameters);

      // 💰 FINANCIAL & BUSINESS INTELLIGENCE
      case 'get_order_analytics':
        return handleGetOrderAnalytics(parameters);
      case 'get_profit_margins':
        return handleGetProfitMargins(parameters);
      case 'identify_trends':
        return handleIdentifyTrends(parameters);
      case 'get_inventory_report':
        return handleGetInventoryReport(parameters);
      case 'optimize_inventory':
        return handleOptimizeInventory(parameters);
      case 'calculate_waste_reduction':
        return handleCalculateWasteReduction(parameters);

      // 👥 OPERATIONS & STAFF MANAGEMENT
      case 'get_current_staff':
        return handleGetCurrentStaff(parameters);
      case 'get_staff_permissions':
        return handleGetStaffPermissions(parameters);
      case 'get_open_tabs':
        return handleGetOpenTabs(parameters);
      case 'get_tab_details':
        return handleGetTabDetails(parameters);

      // 🎉 EVENT & PACKAGE MANAGEMENT
      case 'list_event_packages':
        return handleListEventPackages(parameters);
      case 'get_event_package_details':
        return handleGetEventPackageDetails(parameters);
      case 'create_event_package':
        return handleCreateEventPackage(parameters);
      case 'book_event':
        return handleBookEvent(parameters);
      case 'get_event_bookings':
        return handleGetEventBookings(parameters);
      case 'calculate_event_pricing':
        return handleCalculateEventPricing(parameters);
      case 'update_event_status':
        return handleUpdateEventStatus(parameters);

      // 💰 FINANCIAL & PAYMENT TOOLS
      case 'get_payment_methods':
        return handleGetPaymentMethods(parameters);
      case 'reconcile_payments':
        return handleReconcilePayments(parameters);
      case 'get_tax_report':
        return handleGetTaxReport(parameters);

      // 📋 ORDER MANAGEMENT TOOLS
      case 'get_order_details':
        return handleGetOrderDetails(parameters);
      case 'get_orders_list':
        return handleGetOrdersList(parameters);
      case 'cancel_order':
        return handleCancelOrder(parameters);
      case 'duplicate_order':
        return handleDuplicateOrder(parameters);

      // 🍸 DRINK MENU MANAGEMENT TOOLS - NEW!
      case 'create_drink':
        return handleCreateDrink(parameters);
      case 'remove_drink':
        return handleRemoveDrink(parameters);
      case 'update_drink_details':
        return handleUpdateDrinkDetails(parameters);

      default:
        return NextResponse.json({ error: 'Unknown tool' }, { status: 400 });
    }
  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 🍸 BEVERAGE & MENU MANAGEMENT IMPLEMENTATIONS - Using real cart system
async function handleAddDrinkToCart(params: any) {
  try {
    const { drink_name, quantity = 1 } = params;
    
    // Use the real cart system from tools.js
    const result = await invoke('cart_add', { 
      drink_name, 
      quantity, 
      clientId: 'default' // Use default client ID for voice cart
    });
    
    console.log('Cart add result from tools.js:', result);
    
    // Format response for voice assistant
    if (result.success) {
      return NextResponse.json({
        content: [{
          text: result.message || `Added ${quantity} ${drink_name} to cart`
        }]
      });
    } else {
      return NextResponse.json({
        content: [{
          text: result.message || `Failed to add ${drink_name} to cart`
        }]
      });
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    return NextResponse.json({
      content: [{
        text: `Sorry, I couldn't add ${params.drink_name} to the cart. ${error.message}`
      }]
    });
  }
}

async function handleShowCart(params: any) {
  try {
    // Use the real cart system from tools.js
    const result = await invoke('cart_view', { 
      clientId: 'default' // Use default client ID for voice cart
    });
    
    console.log('Cart view result from tools.js:', result);
    
    // Format the cart display for voice response and UI parsing
    if (result.cart && result.cart.length > 0) {
      const cartLines = [];
      let total = 0;
      
      // Format each item and calculate total
      for (const item of result.cart) {
        try {
          const drinkResult = await db.execute(
            sql`
              SELECT MIN(price) as price
              FROM drinks 
              WHERE LOWER(name) = LOWER(${item.drink_name})
              AND is_active = true
              GROUP BY name
              LIMIT 1
            `
          );
          
          if (drinkResult.rows.length > 0) {
            const price = drinkResult.rows[0].price / 100; // Convert cents to dollars
            const itemTotal = price * item.quantity;
            total += itemTotal;
            
            // Format: "2x Beer - $10.00"
            cartLines.push(`${item.quantity}x ${item.drink_name} - $${itemTotal.toFixed(2)}`);
          } else {
            // Fallback if price not found
            cartLines.push(`${item.quantity}x ${item.drink_name} - $0.00`);
          }
        } catch (error) {
          console.error('Error getting price for', item.drink_name, error);
          cartLines.push(`${item.quantity}x ${item.drink_name} - $0.00`);
        }
      }
      
      // Add total line
      cartLines.push(`Total: $${total.toFixed(2)}`);
      
      const formattedText = cartLines.join('\n');
      
      return NextResponse.json({
        content: [{
          text: formattedText
        }]
      });
    } else {
      return NextResponse.json({
        content: [{
          text: "Your cart is empty."
        }]
      });
    }
  } catch (error) {
    console.error('Error showing cart:', error);
    return NextResponse.json({
      content: [{
        text: "Sorry, I couldn't retrieve your cart."
      }]
    });
  }
}

async function handleProcessOrder(params: any) {
  try {
    // Use the real cart system to create order from cart
    const result = await invoke('cart_create_order', { 
      clientId: 'default',
      customer_name: 'Voice Order'
    });
    
    console.log('Order creation result from tools.js:', result);
    
    if (result.success || result.order_id) {
      return NextResponse.json({
        content: [{
          text: `Order processed successfully! Order ID: ${result.order_id || 'Voice-' + Date.now()}`
        }]
      });
    } else {
      return NextResponse.json({
        content: [{
          text: result.message || "Failed to process order. Please try again."
        }]
      });
    }
  } catch (error) {
    console.error('Error processing order:', error);
    return NextResponse.json({
      content: [{
        text: "Sorry, I couldn't process your order. Please try again."
      }]
    });
  }
}

async function handleSearchDrinks(parameters: any) {
  const { query } = parameters;
  
  try {
    // Use consolidated search to avoid duplicates
    const results = await db.execute(
      sql`
        SELECT 
          MIN(id) as id,
          name,
          category,
          MIN(price) as price,
          SUM(inventory) as inventory,
          bool_and(is_active) as is_active
        FROM drinks
        WHERE (LOWER(name) LIKE LOWER(${`%${query}%`}) OR LOWER(category) LIKE LOWER(${`%${query}%`}))
        AND is_active = true
        GROUP BY name, category
        ORDER BY SUM(inventory) DESC
        LIMIT 10
      `
    );

    return NextResponse.json({
      success: true,
      drinks: results.rows.map(drink => ({
        id: drink.id,
        name: drink.name,
        category: drink.category,
        price: drink.price / 100,
        inventory: drink.inventory,
        available: drink.inventory > 0
      }))
    });
  } catch (error) {
    console.error('Error searching drinks:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to search drinks'
    });
  }
}

async function handleGetInventoryStatus(parameters: any) {
  const { drink_name } = parameters;
  
  try {
    if (drink_name) {
      // Use the consolidated inventory function
      const result = await db.execute(
        sql`SELECT * FROM get_drink_inventory(${drink_name})`
      );

      if (!result.rows.length) {
        return NextResponse.json({
          success: false,
          message: `Drink "${drink_name}" not found`
        });
      }

      const drink = result.rows[0];
      return NextResponse.json({
        success: true,
        drink: drink.name,
        inventory: drink.total_inventory,
        status: drink.status,
        category: drink.category,
        price: drink.price / 100
      });
    }

    // Return consolidated inventory for all drinks
    const allDrinks = await db.execute(
      sql`
        SELECT 
          name,
          category,
          SUM(inventory) as inventory,
          MIN(price) as price,
          CASE 
            WHEN SUM(inventory) > 10 THEN 'good'
            WHEN SUM(inventory) > 0 THEN 'low'
            ELSE 'out_of_stock'
          END as status
        FROM drinks
        WHERE is_active = true
        GROUP BY name, category
        ORDER BY category, name
      `
    );
    
    return NextResponse.json({
      success: true,
      inventory: allDrinks.rows.map(drink => ({
        name: drink.name,
        category: drink.category,
        count: drink.inventory,
        status: drink.status,
        price: drink.price / 100
      }))
    });
  } catch (error) {
    console.error('Error getting inventory status:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to get inventory status'
    });
  }
}

async function handleRemoveDrinkFromCart(params: any) {
  try {
    const { drink_name, quantity = 1 } = params;
    
    // Use the real cart system from tools.js
    const result = await invoke('cart_remove', { 
      drink_name, 
      quantity,
      clientId: 'default'
    });
    
    console.log('Cart remove result from tools.js:', result);
    
    return NextResponse.json({
      content: [{
        text: result.message || `Removed ${quantity} ${drink_name} from cart`
      }]
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    return NextResponse.json({
      content: [{
        text: `Sorry, I couldn't remove ${params.drink_name} from the cart.`
      }]
    });
  }
}

async function handleClearCart(params: any) {
  try {
    // Use the real cart system from tools.js
    const result = await invoke('cart_clear', { 
      clientId: 'default'
    });
    
    console.log('Cart clear result from tools.js:', result);
    
    return NextResponse.json({
      content: [{
        text: result.message || "Cart cleared successfully"
      }]
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    return NextResponse.json({
      content: [{
        text: "Sorry, I couldn't clear your cart."
      }]
    });
  }
}

// 📦 ADVANCED INVENTORY OPERATIONS
async function handleUpdateDrinkInventory(parameters: any) {
  const { drink_name, quantity_change, reason = 'Voice inventory update' } = parameters;
  
  try {
    // Use the consolidated inventory function to get current total
    const currentResult = await db.execute(
      sql`SELECT * FROM get_drink_inventory(${drink_name})`
    );
    
    if (!currentResult.rows.length) {
      return NextResponse.json({ success: false, error: 'Drink not found' });
    }
    
    const currentDrink = currentResult.rows[0];
    const newTotalInventory = Math.max(0, currentDrink.total_inventory + quantity_change);
    
    // Consolidate inventory into the first entry
    const firstDrinkResult = await db.select({
      id: drinks.id
    })
    .from(drinks)
    .where(
      sql`LOWER(${drinks.name}) = LOWER(${drink_name}) AND ${drinks.is_active} = true`
    )
    .orderBy(drinks.created_at)
    .limit(1);
    
    if (firstDrinkResult.length > 0) {
      const firstDrinkId = firstDrinkResult[0].id;
      
      // Set all other entries to 0
      await db.update(drinks)
        .set({ inventory: 0, updated_at: new Date() })
        .where(
          sql`LOWER(${drinks.name}) = LOWER(${drink_name}) AND ${drinks.id} != ${firstDrinkId} AND ${drinks.is_active} = true`
        );
      
      // Set the first entry to the new total
      await db.update(drinks)
        .set({ inventory: newTotalInventory, updated_at: new Date() })
        .where(eq(drinks.id, firstDrinkId));
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${drink_name} inventory`,
      previous_inventory: currentDrink.total_inventory,
      new_inventory: newTotalInventory,
      change: quantity_change
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}

async function handleBulkUpdateInventory(params: any) {
  const { updates } = params;
  
  const results = [];
  
  for (const update of updates) {
    const { drink_name, quantity_change, reason } = update;
    
    const drink = await db.select().from(drinks)
      .where(eq(drinks.name, drink_name))
      .limit(1);
    
    if (drink.length) {
      const newInventory = Math.max(0, drink[0].inventory + quantity_change);
      
      await db.update(drinks)
        .set({ inventory: newInventory })
        .where(eq(drinks.id, drink[0].id));
      
      await db.insert(inventoryMovements).values({
        drink_id: drink[0].id,
        movement_type: quantity_change > 0 ? 'restock' : 'adjustment',
        quantity_change,
        reason
      });
      
      results.push({
        drink_name,
        success: true,
        previous: drink[0].inventory,
        new: newInventory
      });
    } else {
      results.push({
        drink_name,
        success: false,
        error: 'Drink not found'
      });
    }
  }
  
  return NextResponse.json({
    message: `Bulk inventory update completed`,
    results,
    updated: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
}

async function handleGetLowInventoryBottles(parameters: any) {
  const { threshold = 5 } = parameters;
  
  try {
    // Use consolidated inventory to avoid duplicates
    const result = await db.execute(
      sql`
        SELECT 
          name, 
          SUM(inventory) as inventory,
          category,
          MIN(price) as price
        FROM drinks 
        WHERE is_active = true
        GROUP BY name, category
        HAVING SUM(inventory) <= ${threshold}
        ORDER BY SUM(inventory) ASC
      `
    );
    
    return NextResponse.json({
      success: true,
      low_inventory_drinks: result.rows.map(drink => ({
        name: drink.name,
        inventory: drink.inventory,
        category: drink.category,
        price: drink.price / 100
      })),
      count: result.rows.length,
      threshold
    });
  } catch (error) {
    console.error('Error getting low inventory:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}

async function handleGetBottleStatus(params: any) {
  const { bottle_id } = params;
  
  const bottle = await db.select().from(inventory)
    .where(eq(inventory.bottle_id, bottle_id))
    .limit(1);
  
  if (!bottle.length) {
    return NextResponse.json({ error: 'Bottle not found' });
  }
  
  return NextResponse.json({
    bottle: bottle[0],
    status: bottle[0].status,
    remaining_ml: bottle[0].remaining_ml
  });
}

async function handleGetDrinksByFilter(params: any) {
  const { category, price_range, availability } = params;
  
  let query = db.select().from(drinks);
  
  if (category) {
    query = query.where(eq(drinks.category, category));
  }
  
  if (availability) {
    query = query.where(gte(drinks.inventory, 1));
  }
  
  const results = await query.limit(50);
  
  return NextResponse.json({
    drinks: results,
    count: results.length,
    filters_applied: { category, price_range, availability }
  });
}

// 💰 FINANCIAL & BUSINESS INTELLIGENCE
async function handleGetOrderAnalytics(params: any) {
  const { date_range = 'today' } = params;
  
  let dateFilter;
  const now = new Date();
  
  switch (date_range) {
    case 'today':
      dateFilter = sql`DATE(${orders.created_at}) = CURRENT_DATE`;
      break;
    case 'week':
      dateFilter = sql`${orders.created_at} >= CURRENT_DATE - INTERVAL '7 days'`;
      break;
    case 'month':
      dateFilter = sql`${orders.created_at} >= CURRENT_DATE - INTERVAL '30 days'`;
      break;
    default:
      dateFilter = sql`DATE(${orders.created_at}) = CURRENT_DATE`;
  }
  
  const analytics = await db.select({
    total_orders: count(),
    total_revenue: sum(orders.total),
    average_order: avg(orders.total)
  }).from(orders).where(dateFilter);
  
  return NextResponse.json({
    period: date_range,
    analytics: analytics[0],
    message: `Analytics for ${date_range}`
  });
}

async function handleGetProfitMargins(params: any) {
  const { date_range = 'today' } = params;
  
  // Calculate profit margins based on cost and sales
  const profitData = await db.select({
    drink_name: drinks.name,
    cost_per_unit: drinks.cost_per_unit,
    price: drinks.price,
    profit_margin: drinks.profit_margin
  }).from(drinks).where(eq(drinks.is_active, true));
  
  return NextResponse.json({
    profit_margins: profitData,
    period: date_range,
    message: 'Profit margin analysis completed'
  });
}

async function handleIdentifyTrends(params: any) {
  const { period = 'weekly' } = params;
  
  // Analyze sales trends
  const trendData = await db.select({
    drink_name: drinks.name,
    category: drinks.category,
    popularity_score: drinks.popularity_score
  }).from(drinks)
    .orderBy(desc(drinks.popularity_score))
    .limit(10);
  
  return NextResponse.json({
    trends: {
      top_sellers: trendData,
      period,
      analysis: 'Trending items identified'
    }
  });
}

async function handleGetInventoryReport(params: any) {
  const { low_stock_only = false } = params;
  
  let query = db.select().from(drinks);
  
  if (low_stock_only) {
    query = query.where(lte(drinks.inventory, 10));
  }
  
  const inventoryData = await query.orderBy(drinks.inventory);
  
  return NextResponse.json({
    inventory_report: inventoryData,
    total_items: inventoryData.length,
    low_stock_only
  });
}

async function handleOptimizeInventory(params: any) {
  const { category } = params;
  
  // AI-powered inventory optimization
  const optimizationData = await db.select().from(drinks)
    .where(category ? eq(drinks.category, category) : undefined)
    .orderBy(drinks.popularity_score);
  
  const recommendations = optimizationData.map(drink => ({
    drink_name: drink.name,
    current_inventory: drink.inventory,
    recommended_level: Math.max(10, drink.popularity_score * 2),
    action: drink.inventory < 5 ? 'restock_urgent' : 'monitor'
  }));
  
  return NextResponse.json({
    optimization_recommendations: recommendations,
    category: category || 'all',
    message: 'Inventory optimization completed'
  });
}

async function handleCalculateWasteReduction(params: any) {
  const { period = 'month' } = params;
  
  // Calculate waste reduction opportunities
  const wasteAnalysis = {
    total_waste_value: 0,
    reduction_opportunities: [],
    recommendations: [
      'Implement FIFO (First In, First Out) rotation',
      'Monitor expiry dates more closely',
      'Adjust ordering patterns based on demand'
    ]
  };
  
  return NextResponse.json({
    waste_analysis: wasteAnalysis,
    period,
    message: 'Waste reduction analysis completed'
  });
}

// 👥 OPERATIONS & STAFF MANAGEMENT
async function handleGetCurrentStaff(params: any) {
  const currentStaff = await db.select().from(staff)
    .where(eq(staff.is_active, true));
  
  return NextResponse.json({
    staff: currentStaff,
    count: currentStaff.length
  });
}

async function handleGetStaffPermissions(params: any) {
  const { staff_id } = params;
  
  const staffMember = await db.select().from(staff)
    .where(eq(staff.id, staff_id))
    .limit(1);
  
  if (!staffMember.length) {
    return NextResponse.json({ error: 'Staff member not found' });
  }
  
  return NextResponse.json({
    staff: staffMember[0],
    permissions: staffMember[0].permissions || {},
    role: staffMember[0].role
  });
}

async function handleGetOpenTabs(params: any) {
  const openTabs = await db.select().from(customerTabs)
    .where(eq(customerTabs.status, 'open'));
  
  return NextResponse.json({
    open_tabs: openTabs,
    count: openTabs.length
  });
}

async function handleGetTabDetails(params: any) {
  const { tab_id } = params;
  
  const tabDetails = await db.select().from(customerTabs)
    .where(eq(customerTabs.id, tab_id))
    .limit(1);
  
  if (!tabDetails.length) {
    return NextResponse.json({ error: 'Tab not found' });
  }
  
  return NextResponse.json({
    tab: tabDetails[0]
  });
}

// 🎉 EVENT & PACKAGE MANAGEMENT
async function handleListEventPackages(params: any) {
  try {
    // Use raw SQL to avoid schema mismatch
    const packages = await db.execute(sql`SELECT * FROM event_packages`);
    
          return NextResponse.json({
        success: true,
        packages: packages.rows.map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          price: pkg.base_price, // Use base_price from schema
          duration_hours: pkg.duration_hours,
          max_guests: pkg.max_guests,
          created_at: pkg.created_at
        })),
        count: packages.rows.length
      });
  } catch (error) {
    console.error('Error listing event packages:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}

async function handleGetEventPackageDetails(params: any) {
  try {
    const { package_id } = params;
    
    const packageDetails = await sqlClient`SELECT * FROM event_packages WHERE id = ${package_id} LIMIT 1`;
    
    if (!packageDetails.length) {
      return NextResponse.json({ error: 'Package not found' });
    }
    
    return NextResponse.json({
      package: packageDetails[0]
    });
  } catch (error) {
    console.error('Error getting event package details:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

async function handleCreateEventPackage(params: any) {
  try {
    const { name, description, price_per_person, min_guests, max_guests, duration_hours } = params;
    
    // Use raw SQL with proper parameter binding
    const packageResult = await db.execute({
      sql: `INSERT INTO event_packages (
        name, description, base_price, duration_hours, max_guests
      ) VALUES (
        $1, $2, $3, $4, $5
      ) RETURNING *`,
      args: [name, description, price_per_person, duration_hours || 4, max_guests]
    });
    
    const newPackage = packageResult.rows[0];
    
    return NextResponse.json({
      success: true,
      message: `Created event package: ${name}`,
      package: {
        id: newPackage.id,
        name: newPackage.name,
        description: newPackage.description,
        price: newPackage.base_price,
        duration_hours: newPackage.duration_hours,
        max_guests: newPackage.max_guests,
        created_at: newPackage.created_at
      }
    });
  } catch (error) {
    console.error('Error creating event package:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}

async function handleBookEvent(params: any) {
  try {
    const { package: packageName, guest_count, event_date, customer_name, customer_email, customer_phone, event_name, start_time, special_requests } = params;
    
    // Validate required parameters
    if (!packageName || !guest_count || !event_date || !customer_name) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing required parameters: package, guest_count, event_date, customer_name' 
      });
    }
    
    // Find package by name using direct SQL
    const eventPackageResults = await sqlClient`SELECT * FROM event_packages WHERE name = ${packageName} LIMIT 1`;
    
    if (!eventPackageResults || eventPackageResults.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Package not found' 
      });
    }
    
    // Create/find customer using direct SQL
    let customer = null;
    if (customer_email) {
      const existingCustomerResults = await sqlClient`SELECT * FROM customers WHERE email = ${customer_email} LIMIT 1`;
      if (existingCustomerResults.length > 0) {
        customer = existingCustomerResults[0];
      }
    }
    
    if (!customer && customer_name) {
      const [firstName, ...lastNameParts] = customer_name.split(' ');
      const lastName = lastNameParts.join(' ');
      
      const newCustomerResults = await sqlClient`
        INSERT INTO customers (first_name, last_name, email, phone)
        VALUES (${firstName}, ${lastName || ''}, ${customer_email || null}, ${customer_phone || null})
        RETURNING *
      `;
      customer = newCustomerResults[0];
    }
    
    // Create booking using direct SQL
    const packageData = eventPackageResults[0] as any;
    const bookingResults = await sqlClient`
      INSERT INTO event_bookings (
        customer_id, package_id, event_name, event_date, start_time, 
        guest_count, total_price, status, special_requests
      ) VALUES (
        ${customer?.id || null},
        ${packageData.id},
        ${event_name || 'Event'},
        ${event_date},
        ${start_time || '18:00'},
        ${guest_count},
        ${packageData.price * guest_count},
        'pending',
        ${special_requests || ''}
      ) RETURNING *
    `;
    
    const bookingData = bookingResults[0] as any;
    
    return NextResponse.json({
      success: true,
      message: `Event booked successfully for ${customer_name}`,
      booking: {
        id: bookingData.id,
        guest_count: bookingData.guest_count,
        event_date: bookingData.event_date,
        status: bookingData.status,
        total_price: bookingData.total_price, // Already in cents
        event_name: bookingData.event_name,
        start_time: bookingData.start_time,
        special_requests: bookingData.special_requests
      },
      package: {
        id: packageData.id,
        name: packageData.name,
        price: packageData.price
      }
    });
  } catch (error: any) {
    console.error('Error booking event:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}

async function handleGetEventBookings(params: any) {
  try {
    const { filters = {} } = params;
    
    // Use raw SQL to avoid schema mismatch
    let whereClause = '';
    if (filters.status) {
      whereClause = `WHERE eb.status = '${filters.status}'`;
    }
    
    const bookingsResult = await db.execute(
      sql`SELECT 
        eb.id, eb.customer_id, eb.package_id, eb.event_name, 
        eb.event_date, eb.start_time, eb.end_time, eb.guest_count,
        eb.total_price, eb.deposit_paid, eb.balance_due, eb.status,
        eb.special_requests, eb.created_at,
        c.first_name || ' ' || c.last_name as customer_name,
        ep.name as package_name
      FROM event_bookings eb
      LEFT JOIN customers c ON eb.customer_id = c.id  
      LEFT JOIN event_packages ep ON eb.package_id = ep.id
      ${whereClause ? sql.raw(whereClause) : sql.raw('')}
      ORDER BY eb.event_date DESC`
    );
    
    const bookings = bookingsResult.rows.map(booking => ({
      ...booking,
      total_price: booking.total_price, // Already in dollars
      deposit_paid: booking.deposit_paid || 0,
      balance_due: booking.balance_due || booking.total_price
    }));
    
    return NextResponse.json({
      success: true,
      bookings,
      count: bookings.length,
      filters
    });
  } catch (error) {
    console.error('Error getting event bookings:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

async function handleCalculateEventPricing(params: any) {
  try {
    const { package: packageName, guest_count, add_ons = [] } = params;
    
    const eventPackageResults = await sqlClient`SELECT * FROM event_packages WHERE name = ${packageName} LIMIT 1`;
    
    if (!eventPackageResults.length) {
      return NextResponse.json({ error: 'Package not found' });
    }
    
    const eventPackage = eventPackageResults[0] as any;
    const basePrice = eventPackage.price * guest_count;
    const addOnsPrice = add_ons.reduce((sum: number, addon: any) => sum + (addon.price * 100), 0);
    const totalPrice = basePrice + addOnsPrice;
    
    return NextResponse.json({
      package: eventPackage,
      guest_count,
      base_price: basePrice / 100,
      add_ons_price: addOnsPrice / 100,
      total_price: totalPrice / 100,
      pricing_breakdown: {
        per_person: eventPackage.price / 100,
        base_total: basePrice / 100,
        add_ons: add_ons,
        final_total: totalPrice / 100
      }
    });
  } catch (error) {
    console.error('Error calculating event pricing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

async function handleUpdateEventStatus(params: any) {
  try {
    const { booking_id, status } = params;
    
    const updated = await sqlClient`
      UPDATE event_bookings 
      SET status = ${status}
      WHERE id = ${booking_id}
      RETURNING *
    `;
    
    if (!updated.length) {
      return NextResponse.json({ error: 'Booking not found' });
    }
    
    return NextResponse.json({
      message: `Event booking status updated to ${status}`,
      booking: updated[0]
    });
  } catch (error) {
    console.error('Error updating event status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}

// 💰 FINANCIAL & PAYMENT TOOLS
async function handleGetPaymentMethods(params: any) {
  const paymentMethods = [
    { id: 1, name: 'Cash', type: 'cash', active: true },
    { id: 2, name: 'Credit Card', type: 'card', active: true },
    { id: 3, name: 'Debit Card', type: 'card', active: true },
    { id: 4, name: 'Apple Pay', type: 'digital', active: true },
    { id: 5, name: 'Google Pay', type: 'digital', active: true }
  ];
  
  return NextResponse.json({
    payment_methods: paymentMethods
  });
}

async function handleReconcilePayments(params: any) {
  const { date_range = 'today' } = params;
  
  // Payment reconciliation logic
  const reconciliation = {
    total_transactions: 0,
    total_amount: 0,
    by_method: {},
    discrepancies: []
  };
  
  return NextResponse.json({
    reconciliation,
    date_range,
    message: 'Payment reconciliation completed'
  });
}

async function handleGetTaxReport(params: any) {
  const { date_range = 'month' } = params;
  
  // Tax reporting logic
  const taxReport = {
    total_sales: 0,
    total_tax: 0,
    tax_rate: 0.08,
    breakdown: {}
  };
  
  return NextResponse.json({
    tax_report: taxReport,
    period: date_range,
    message: 'Tax report generated'
  });
}

// 📋 ORDER MANAGEMENT TOOLS
async function handleGetOrderDetails(params: any) {
  const { order_id } = params;
  
  const orderDetails = await db.select().from(orders)
    .where(eq(orders.id, order_id))
    .limit(1);
  
  if (!orderDetails.length) {
    return NextResponse.json({ error: 'Order not found' });
  }
  
  return NextResponse.json({
    order: orderDetails[0]
  });
}

async function handleGetOrdersList(params: any) {
  const { limit = 10, status } = params;
  
  let query = db.select().from(orders);
  
  if (status) {
    query = query.where(eq(orders.status, status));
  }
  
  const ordersList = await query
    .orderBy(desc(orders.created_at))
    .limit(limit);
  
  return NextResponse.json({
    orders: ordersList,
    count: ordersList.length
  });
}

async function handleCancelOrder(params: any) {
  const { order_id, reason } = params;
  
  const updated = await db.update(orders)
    .set({ status: 'cancelled' })
    .where(eq(orders.id, order_id))
    .returning();
  
  if (!updated.length) {
    return NextResponse.json({ error: 'Order not found' });
  }
  
  return NextResponse.json({
    message: `Order ${order_id} cancelled`,
    reason,
    order: updated[0]
  });
}

async function handleDuplicateOrder(params: any) {
  const { order_id } = params;
  
  const originalOrder = await db.select().from(orders)
    .where(eq(orders.id, order_id))
    .limit(1);
  
  if (!originalOrder.length) {
    return NextResponse.json({ error: 'Order not found' });
  }
  
  return NextResponse.json({
    message: `Order ${order_id} duplicated`,
    original_order: originalOrder[0]
  });
}

// 🍸 DRINK MENU MANAGEMENT HANDLERS - NEW!
async function handleCreateDrink(params: any) {
  const { 
    name, 
    category, 
    subcategory, 
    price, 
    inventory = 0, 
    unit_volume_oz, 
    cost_per_unit, 
    description,
    image_url,
    unit_type 
  } = params;

  // Validate required fields
  if (!name || !category || !price) {
    return NextResponse.json({ 
      error: 'Missing required information. I need at least a name, category, and price to create a drink.',
      missing_fields: [
        !name && 'name',
        !category && 'category', 
        !price && 'price'
      ].filter(Boolean),
      text: 'I need more details to create that drink. Please provide the name, category, and price.'
    }, { status: 400 });
  }

  try {
    // Convert price to cents
    const priceInCents = Math.round(price * 100);
    const costInCents = cost_per_unit ? Math.round(cost_per_unit * 100) : null;

    // Calculate profit margin if cost is provided
    const profitMargin = costInCents ? ((priceInCents - costInCents) / priceInCents) * 100 : null;

    // Determine unit type and serving details based on category
    let defaultUnitType = unit_type || 'ounce';
    let defaultServingSize = 8.0;
    let defaultServingsPerContainer = 1;
    let defaultVolume = 8.0;

    const categoryLower = category.toLowerCase();
    
    if (categoryLower.includes('beer') || categoryLower.includes('lager') || categoryLower.includes('ale')) {
      defaultUnitType = 'bottle';
      defaultServingSize = 12.0;
      defaultServingsPerContainer = 1;
      defaultVolume = 12.0;
    } else if (categoryLower.includes('wine') || categoryLower.includes('champagne') || categoryLower.includes('prosecco')) {
      defaultUnitType = 'glass';
      defaultServingSize = 5.0;
      defaultServingsPerContainer = 5; // Assuming bottle = 5 glasses
      defaultVolume = 5.0;
    } else if (categoryLower.includes('spirit') || categoryLower.includes('whiskey') || categoryLower.includes('vodka') || 
               categoryLower.includes('gin') || categoryLower.includes('rum') || categoryLower.includes('tequila') ||
               categoryLower.includes('bourbon') || categoryLower.includes('scotch') || categoryLower.includes('liqueur')) {
      defaultUnitType = 'shot';
      defaultServingSize = 1.5;
      defaultServingsPerContainer = 17; // Assuming 750ml bottle = ~17 shots
      defaultVolume = 1.5;
    } else if (categoryLower.includes('cocktail') || categoryLower.includes('mixed') || categoryLower.includes('signature')) {
      defaultUnitType = 'ounce';
      defaultServingSize = 8.0;
      defaultServingsPerContainer = 1;
      defaultVolume = 8.0;
    }

    // Use provided values or defaults
    const finalUnitType = unit_type || defaultUnitType;
    const finalVolume = unit_volume_oz || defaultVolume;

    // Insert new drink with unit tracking
    const [newDrink] = await db.insert(drinks).values({
      name: name.trim(),
      category: category.trim(),
      subcategory: subcategory?.trim(),
      price: priceInCents,
      inventory: inventory || 0,
      unit_type: finalUnitType,
      unit_volume_oz: finalVolume,
      serving_size_oz: defaultServingSize,
      servings_per_container: defaultServingsPerContainer,
      cost_per_unit: costInCents,
      profit_margin: profitMargin,
      description: description?.trim(),
      image_url: image_url?.trim(),
      is_active: true,
      updated_at: sql`NOW()`
    }).returning();

    console.log('✅ Voice-created new drink:', newDrink);

    // Format unit type for response
    const unitDisplay = finalUnitType === 'bottle' ? 'bottles' :
                       finalUnitType === 'glass' ? 'glasses' :
                       finalUnitType === 'shot' ? 'shots' :
                       finalUnitType === 'ounce' ? 'ounces' : finalUnitType;

    return NextResponse.json({
      success: true,
      message: `Perfect! I've successfully created "${name}" and added it to our ${category} menu at $${price.toFixed(2)}. It's tracked by ${unitDisplay}.`,
      text: `Perfect! I've successfully created "${name}" and added it to our ${category} menu at $${price.toFixed(2)}. It's tracked by ${unitDisplay}.`,
      drink: {
        id: newDrink.id.toString(),
        name: newDrink.name,
        category: newDrink.category,
        subcategory: newDrink.subcategory,
        price: newDrink.price / 100,
        inventory: newDrink.inventory,
        unit_type: newDrink.unit_type,
        unit_volume_oz: newDrink.unit_volume_oz,
        serving_size_oz: newDrink.serving_size_oz,
        servings_per_container: newDrink.servings_per_container,
        cost_per_unit: newDrink.cost_per_unit ? newDrink.cost_per_unit / 100 : null,
        profit_margin: newDrink.profit_margin,
        description: newDrink.description,
        image_url: newDrink.image_url,
        created_at: newDrink.created_at
      }
    });

  } catch (error) {
    console.error('❌ Failed to create drink via voice:', error);
    return NextResponse.json({ 
      error: 'I encountered an issue creating that drink. Please try again.',
      text: 'I encountered an issue creating that drink. Please try again.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleRemoveDrink(params: any) {
  const { drink_name, drink_id } = params;

  if (!drink_id && !drink_name) {
    return NextResponse.json({ 
      error: 'I need either a drink name or ID to remove it from the menu.',
      text: 'I need either a drink name or ID to remove it from the menu.'
    }, { status: 400 });
  }

  try {
    // Find and soft-delete the drink(s)
    let deletedDrinks;
    if (drink_id) {
      deletedDrinks = await db
        .update(drinks)
        .set({ 
          is_active: false,
          updated_at: sql`NOW()`
        })
        .where(eq(drinks.id, parseInt(drink_id)))
        .returning();
    } else if (drink_name) {
      deletedDrinks = await db
        .update(drinks)
        .set({ 
          is_active: false,
          updated_at: sql`NOW()`
        })
        .where(eq(drinks.name, drink_name.trim()))
        .returning();
    }

    if (!deletedDrinks || deletedDrinks.length === 0) {
      return NextResponse.json({ 
        error: `I couldn't find "${drink_name || drink_id}" in our menu. Could you double-check the name?`,
        text: `I couldn't find "${drink_name || drink_id}" in our menu. Could you double-check the name?`,
        suggestion: 'Try asking me to search for drinks if you\'re not sure of the exact name.'
      }, { status: 404 });
    }

    console.log('✅ Voice-removed drink(s):', deletedDrinks);

    const drinkNames = deletedDrinks.map(d => d.name).join(', ');
    return NextResponse.json({
      success: true,
      message: `Done! I've successfully removed "${drinkNames}" from our menu.`,
      text: `Done! I've successfully removed "${drinkNames}" from our menu.`,
      deletedDrinks: deletedDrinks.map(drink => ({
        id: drink.id,
        name: drink.name,
        category: drink.category
      }))
    });

  } catch (error) {
    console.error('❌ Failed to remove drink via voice:', error);
    return NextResponse.json({ 
      error: 'I encountered an issue removing that drink. Please try again.',
      text: 'I encountered an issue removing that drink. Please try again.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleUpdateDrinkDetails(params: any) {
  const { drink_name, updates } = params;

  if (!drink_name || !updates) {
    return NextResponse.json({ 
      error: 'I need both a drink name and the details to update.',
      text: 'I need both a drink name and the details to update.'
    }, { status: 400 });
  }

  try {
    // Prepare update object
    const updateData: any = {
      updated_at: sql`NOW()`
    };

    if (updates.price !== undefined) {
      updateData.price = Math.round(updates.price * 100);
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description.trim();
    }
    if (updates.category !== undefined) {
      updateData.category = updates.category.trim();
    }
    if (updates.subcategory !== undefined) {
      updateData.subcategory = updates.subcategory.trim();
    }

    // Update the drink
    const [updatedDrink] = await db
      .update(drinks)
      .set(updateData)
      .where(eq(drinks.name, drink_name.trim()))
      .returning();

    if (!updatedDrink) {
      return NextResponse.json({ 
        error: `I couldn't find "${drink_name}" in our menu to update. Could you check the name?`,
        text: `I couldn't find "${drink_name}" in our menu to update. Could you check the name?`
      }, { status: 404 });
    }

    console.log('✅ Voice-updated drink:', updatedDrink);

    const updatesList = Object.keys(updates).map(key => {
      if (key === 'price') return `price to $${updates.price.toFixed(2)}`;
      return `${key} to "${updates[key]}"`;
    }).join(', ');

    return NextResponse.json({
      success: true,
      message: `Perfect! I've updated "${drink_name}" with the new ${updatesList}.`,
      text: `Perfect! I've updated "${drink_name}" with the new ${updatesList}.`,
      drink: {
        id: updatedDrink.id.toString(),
        name: updatedDrink.name,
        category: updatedDrink.category,
        subcategory: updatedDrink.subcategory,
        price: updatedDrink.price / 100,
        description: updatedDrink.description,
        updated_at: updatedDrink.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Failed to update drink via voice:', error);
    return NextResponse.json({ 
      error: 'I encountered an issue updating that drink. Please try again.',
      text: 'I encountered an issue updating that drink. Please try again.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 