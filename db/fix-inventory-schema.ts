/**
 * Database Schema Fix for Proper Inventory Tracking
 * Ensures all drinks have proper serving size and unit data
 */

import db from './index';
import { sql } from 'drizzle-orm';

async function fixInventorySchema() {
  console.log('🔧 Fixing inventory schema and data...');

  try {
    // 1. Ensure all drinks have proper serving_size_oz values
    console.log('1. Setting default serving sizes by category...');
    
    // Beer: 12 oz servings
    await db.execute(sql`
      UPDATE drinks 
      SET serving_size_oz = 12.0,
          unit_volume_oz = 12.0,
          servings_per_container = 1
      WHERE LOWER(category) = 'beer' 
      AND (serving_size_oz IS NULL OR serving_size_oz = 0)
    `);

    // Wine: 5 oz servings, 750ml bottles (25.36 oz)
    await db.execute(sql`
      UPDATE drinks 
      SET serving_size_oz = 5.0,
          unit_volume_oz = 25.36,
          servings_per_container = 5
      WHERE LOWER(category) = 'wine'
      AND (serving_size_oz IS NULL OR serving_size_oz = 0)
    `);

    // Spirits: 1.5 oz shots, 750ml bottles (25.36 oz)
    await db.execute(sql`
      UPDATE drinks 
      SET serving_size_oz = 1.5,
          unit_volume_oz = 25.36,
          servings_per_container = 17
      WHERE LOWER(category) IN ('spirits', 'liquor', 'whiskey', 'vodka', 'gin', 'rum', 'tequila')
      AND (serving_size_oz IS NULL OR serving_size_oz = 0)
    `);

    // Cocktails: 8 oz servings
    await db.execute(sql`
      UPDATE drinks 
      SET serving_size_oz = 8.0,
          unit_volume_oz = 8.0,
          servings_per_container = 1
      WHERE LOWER(category) IN ('cocktails', 'mixed drinks', 'specialty')
      AND (serving_size_oz IS NULL OR serving_size_oz = 0)
    `);

    // Default for anything else: 8 oz
    await db.execute(sql`
      UPDATE drinks 
      SET serving_size_oz = 8.0,
          unit_volume_oz = 8.0,
          servings_per_container = 1
      WHERE serving_size_oz IS NULL OR serving_size_oz = 0
    `);

    // 2. Create some sample inventory bottles for testing
    console.log('2. Creating sample inventory bottles...');
    
    // Get some drinks to create inventory for
    const sampleDrinks = await db.execute(sql`
      SELECT id, name, category, unit_volume_oz 
      FROM drinks 
      WHERE is_active = true 
      LIMIT 10
    `);

    for (const drink of sampleDrinks.rows) {
      const bottleSize = drink.unit_volume_oz || 25.36;
      const remainingMl = Math.round(bottleSize * 29.5735); // Convert to ml

      // Create 2-3 bottles per drink for testing
      for (let i = 1; i <= 3; i++) {
        const bottleId = `${drink.name.replace(/\s+/g, '_').toLowerCase()}_bottle_${i}`;
        
        await db.execute(sql`
          INSERT INTO inventory (
            drink_id, bottle_id, size_oz, remaining_ml, 
            status, received_date, location, created_at
          ) VALUES (
            ${drink.id}, ${bottleId}, ${bottleSize}, ${remainingMl.toString()},
            ${i === 1 ? 'opened' : 'unopened'}, CURRENT_DATE, 'Main Bar', NOW()
          )
          ON CONFLICT (bottle_id) DO NOTHING
        `);
      }
    }

    // 3. Verify the fixes
    console.log('3. Verifying inventory schema fixes...');
    
    const verificationResults = await db.execute(sql`
      SELECT 
        category,
        COUNT(*) as drink_count,
        AVG(serving_size_oz) as avg_serving_size,
        AVG(unit_volume_oz) as avg_unit_volume,
        AVG(servings_per_container) as avg_servings_per_container
      FROM drinks 
      WHERE is_active = true
      GROUP BY category
      ORDER BY category
    `);

    console.log('\n📊 Verification Results:');
    console.table(verificationResults.rows.map(row => ({
      Category: row.category,
      'Drink Count': row.drink_count,
      'Avg Serving Size (oz)': parseFloat(row.avg_serving_size).toFixed(2),
      'Avg Unit Volume (oz)': parseFloat(row.avg_unit_volume).toFixed(2),
      'Avg Servings/Container': parseFloat(row.avg_servings_per_container).toFixed(1)
    })));

    // 4. Count inventory bottles
    const inventoryCount = await db.execute(sql`
      SELECT COUNT(*) as bottle_count FROM inventory
    `);

    console.log(`\n🍾 Total inventory bottles: ${inventoryCount.rows[0].bottle_count}`);

    console.log('✅ Inventory schema fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing inventory schema:', error);
    throw error;
  }
}

// Run the fix if this file is executed directly
if (require.main === module) {
  fixInventorySchema()
    .then(() => {
      console.log('🎉 Inventory schema fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Inventory schema fix failed:', error);
      process.exit(1);
    });
}

export { fixInventorySchema };