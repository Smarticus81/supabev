import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { drinks } from './schema';
import { eq } from 'drizzle-orm';

const sqlite = new Database('./data/bar.db');
const db = drizzle(sqlite);

async function addInventoryUnits() {
  console.log('Adding inventory unit tracking...');

  try {
    // Add new columns to drinks table
    console.log('Adding unit_type column...');
    sqlite.exec(`
      ALTER TABLE drinks ADD COLUMN unit_type TEXT DEFAULT 'ounce';
    `);

    console.log('Adding serving_size_oz column...');
    sqlite.exec(`
      ALTER TABLE drinks ADD COLUMN serving_size_oz REAL;
    `);

    console.log('Adding servings_per_container column...');
    sqlite.exec(`
      ALTER TABLE drinks ADD COLUMN servings_per_container INTEGER;
    `);

    // Update existing drinks with appropriate units based on category
    console.log('Setting unit types based on categories...');
    
    // Beer -> bottles
    sqlite.exec(`
      UPDATE drinks 
      SET unit_type = 'bottle', 
          serving_size_oz = 12.0,
          servings_per_container = 1,
          unit_volume_oz = 12.0
      WHERE LOWER(category) LIKE '%beer%' OR LOWER(category) LIKE '%lager%' OR LOWER(category) LIKE '%ale%';
    `);

    // Wine -> glasses  
    sqlite.exec(`
      UPDATE drinks 
      SET unit_type = 'glass',
          serving_size_oz = 5.0,
          servings_per_container = 5,
          unit_volume_oz = 5.0
      WHERE LOWER(category) LIKE '%wine%' OR LOWER(category) LIKE '%champagne%' OR LOWER(category) LIKE '%prosecco%';
    `);

    // Spirits -> shots/ounces
    sqlite.exec(`
      UPDATE drinks 
      SET unit_type = 'shot',
          serving_size_oz = 1.5,
          servings_per_container = 17,
          unit_volume_oz = 1.5
      WHERE LOWER(category) LIKE '%spirit%' OR LOWER(category) LIKE '%whiskey%' OR LOWER(category) LIKE '%vodka%' 
         OR LOWER(category) LIKE '%gin%' OR LOWER(category) LIKE '%rum%' OR LOWER(category) LIKE '%tequila%'
         OR LOWER(category) LIKE '%bourbon%' OR LOWER(category) LIKE '%scotch%' OR LOWER(category) LIKE '%liqueur%';
    `);

    // Mixed drinks -> ounces (for cocktails)
    sqlite.exec(`
      UPDATE drinks 
      SET unit_type = 'ounce',
          serving_size_oz = 8.0,
          servings_per_container = 1,
          unit_volume_oz = 8.0
      WHERE LOWER(category) LIKE '%cocktail%' OR LOWER(category) LIKE '%mixed%' OR LOWER(category) LIKE '%signature%';
    `);

    // Non-alcoholic -> various appropriate units
    sqlite.exec(`
      UPDATE drinks 
      SET unit_type = 'ounce',
          serving_size_oz = 12.0,
          servings_per_container = 1,
          unit_volume_oz = 12.0
      WHERE LOWER(category) LIKE '%soda%' OR LOWER(category) LIKE '%juice%' OR LOWER(category) LIKE '%water%' 
         OR LOWER(category) LIKE '%coffee%' OR LOWER(category) LIKE '%tea%';
    `);

    console.log('✅ Successfully updated drinks with unit tracking!');

    // Show sample of updated data
    console.log('\nSample updated drinks:');
    const sampleDrinks = sqlite.prepare(`
      SELECT name, category, unit_type, serving_size_oz, servings_per_container, inventory 
      FROM drinks 
      LIMIT 10
    `).all();
    
    console.table(sampleDrinks);

    // Show inventory summary by unit type
    console.log('\nInventory summary by unit type:');
    const summary = sqlite.prepare(`
      SELECT 
        unit_type,
        COUNT(*) as drink_count,
        SUM(inventory) as total_units,
        AVG(serving_size_oz) as avg_serving_size
      FROM drinks 
      WHERE is_active = true
      GROUP BY unit_type
      ORDER BY drink_count DESC
    `).all();
    
    console.table(summary);

  } catch (error) {
    console.error('❌ Error updating inventory units:', error);
  }
}

// Run the migration
addInventoryUnits().then(() => {
  console.log('Migration completed!');
  sqlite.close();
});
