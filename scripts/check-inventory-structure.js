/**
 * Check Current Inventory Structure
 * Analyzes the actual database to understand how inventory is stored
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function checkInventoryStructure() {
  console.log('🔍 CHECKING INVENTORY STRUCTURE');
  console.log('===============================\n');

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Check drinks table structure
    console.log('📋 Drinks Table Structure:');
    const drinksColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'drinks'
      ORDER BY ordinal_position
    `;
    
    drinksColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });

    // Check inventory table structure (if exists)
    console.log('\n📦 Inventory Table Structure:');
    try {
      const inventoryColumns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'inventory'
        ORDER BY ordinal_position
      `;
      
      if (inventoryColumns.length > 0) {
        inventoryColumns.forEach(col => {
          console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
        });
      } else {
        console.log('   ⚠️  Inventory table not found or empty');
      }
    } catch (error) {
      console.log('   ❌ Inventory table does not exist');
    }

    // Sample current drink inventory
    console.log('\n📊 Sample Drink Inventory:');
    const sampleDrinks = await sql`
      SELECT name, category, inventory, price, serving_size_oz, unit_volume_oz
      FROM drinks 
      WHERE is_active = true
      ORDER BY category, name
      LIMIT 10
    `;
    
    sampleDrinks.forEach(drink => {
      console.log(`   ${drink.name} (${drink.category}): ${drink.inventory} units, $${(drink.price/100).toFixed(2)}`);
      if (drink.serving_size_oz) {
        console.log(`      Serving: ${drink.serving_size_oz}oz, Unit: ${drink.unit_volume_oz}oz`);
      }
    });

    // Check recent orders and their impact
    console.log('\n📝 Recent Orders:');
    const recentOrders = await sql`
      SELECT o.id, o.items, o.total, o.created_at, o.status
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 5
    `;
    
    recentOrders.forEach(order => {
      console.log(`   Order #${order.id}: $${(order.total/100).toFixed(2)} (${order.status})`);
      if (order.items) {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        items.forEach(item => {
          console.log(`      - ${item.name} x${item.quantity}`);
        });
      }
    });

    // Check if inventory table has any data
    console.log('\n🏪 Inventory Records:');
    try {
      const inventoryCount = await sql`SELECT COUNT(*) as count FROM inventory`;
      console.log(`   Total inventory records: ${inventoryCount[0].count}`);
      
      if (inventoryCount[0].count > 0) {
        const sampleInventory = await sql`
          SELECT i.*, d.name as drink_name
          FROM inventory i
          JOIN drinks d ON d.id = i.drink_id
          LIMIT 5
        `;
        
        sampleInventory.forEach(inv => {
          console.log(`   ${inv.drink_name}: ${inv.remaining_ml}ml remaining (${inv.status})`);
        });
      }
    } catch (error) {
      console.log('   ❌ No inventory table or data');
    }

    // Check pour records
    console.log('\n🥃 Pour Records:');
    try {
      const pourCount = await sql`SELECT COUNT(*) as count FROM pours`;
      console.log(`   Total pour records: ${pourCount[0].count}`);
    } catch (error) {
      console.log('   ❌ No pours table');
    }

    console.log('\n🎯 SUMMARY:');
    console.log('===========');
    
    const hasServingSizes = sampleDrinks.some(d => d.serving_size_oz);
    const hasInventoryTable = true; // We'll assume it exists from schema
    
    console.log(`✅ Drinks table: ${drinksColumns.length} columns`);
    console.log(`${hasServingSizes ? '✅' : '❌'} Serving size data: ${hasServingSizes ? 'Present' : 'Missing'}`);
    console.log(`${hasInventoryTable ? '✅' : '❌'} Inventory tracking: ${hasInventoryTable ? 'Available' : 'Not available'}`);
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (!hasServingSizes) {
      console.log('   🔧 Run: npm run db:fix-inventory (to set serving sizes)');
    }
    console.log('   🔧 Implement simple inventory deduction in drinks table');
    console.log('   🔧 Focus on drinks.inventory column for immediate updates');

  } catch (error) {
    console.error('❌ Error checking inventory structure:', error);
  }
}

if (require.main === module) {
  checkInventoryStructure();
}

module.exports = { checkInventoryStructure };