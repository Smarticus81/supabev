import 'dotenv/config';
import { sql } from 'drizzle-orm';
import db from './index';

async function addInventoryUnits() {
  try {
    console.log('🔧 Adding inventory unit tracking columns...');

    // Add the new columns
    await db.execute(sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "unit_type" text DEFAULT 'ounce' NOT NULL`);
    console.log('✅ Added unit_type column');

    await db.execute(sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "serving_size_oz" real`);
    console.log('✅ Added serving_size_oz column');

    await db.execute(sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "servings_per_container" integer`);
    console.log('✅ Added servings_per_container column');

    // Update existing drinks with appropriate units based on category
    console.log('🍺 Setting unit types for beers...');
    await db.execute(sql`
      UPDATE drinks 
      SET unit_type = 'bottle', 
          serving_size_oz = 12.0,
          servings_per_container = 1,
          unit_volume_oz = 12.0
      WHERE LOWER(category) LIKE '%beer%' OR LOWER(category) LIKE '%lager%' OR LOWER(category) LIKE '%ale%'
    `);

    console.log('🍷 Setting unit types for wines...');
    await db.execute(sql`
      UPDATE drinks 
      SET unit_type = 'glass',
          serving_size_oz = 5.0,
          servings_per_container = 5,
          unit_volume_oz = 5.0
      WHERE LOWER(category) LIKE '%wine%' OR LOWER(category) LIKE '%champagne%' OR LOWER(category) LIKE '%prosecco%'
    `);

    console.log('🥃 Setting unit types for spirits...');
    await db.execute(sql`
      UPDATE drinks 
      SET unit_type = 'shot',
          serving_size_oz = 1.5,
          servings_per_container = 17,
          unit_volume_oz = 1.5
      WHERE LOWER(category) LIKE '%spirit%' OR LOWER(category) LIKE '%whiskey%' OR LOWER(category) LIKE '%vodka%' 
         OR LOWER(category) LIKE '%gin%' OR LOWER(category) LIKE '%rum%' OR LOWER(category) LIKE '%tequila%'
         OR LOWER(category) LIKE '%bourbon%' OR LOWER(category) LIKE '%scotch%' OR LOWER(category) LIKE '%liqueur%'
    `);

    console.log('🍹 Setting unit types for cocktails...');
    await db.execute(sql`
      UPDATE drinks 
      SET unit_type = 'ounce',
          serving_size_oz = 8.0,
          servings_per_container = 1,
          unit_volume_oz = 8.0
      WHERE LOWER(category) LIKE '%cocktail%' OR LOWER(category) LIKE '%mixed%' OR LOWER(category) LIKE '%signature%'
    `);

    console.log('🥤 Setting unit types for non-alcoholic drinks...');
    await db.execute(sql`
      UPDATE drinks 
      SET unit_type = 'ounce',
          serving_size_oz = 12.0,
          servings_per_container = 1,
          unit_volume_oz = 12.0
      WHERE LOWER(category) LIKE '%soda%' OR LOWER(category) LIKE '%juice%' OR LOWER(category) LIKE '%water%' 
         OR LOWER(category) LIKE '%coffee%' OR LOWER(category) LIKE '%tea%'
    `);

    // Show sample of updated data
    console.log('\n📊 Sample updated drinks:');
    const sampleDrinks = await db.execute(sql`
      SELECT name, category, unit_type, serving_size_oz, servings_per_container, inventory 
      FROM drinks 
      LIMIT 10
    `);
    console.table(sampleDrinks.rows);

    // Show inventory summary by unit type
    console.log('\n📈 Inventory summary by unit type:');
    const summary = await db.execute(sql`
      SELECT 
        unit_type,
        COUNT(*) as drink_count,
        SUM(inventory) as total_units,
        AVG(serving_size_oz) as avg_serving_size
      FROM drinks 
      WHERE is_active = true
      GROUP BY unit_type
      ORDER BY drink_count DESC
    `);
    console.table(summary.rows);

    console.log('\n✅ Inventory unit tracking successfully implemented!');

  } catch (error) {
    console.error('❌ Error adding inventory units:', error);
    throw error;
  }
}

// Run the migration
addInventoryUnits().then(() => {
  console.log('🎉 Migration completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});
