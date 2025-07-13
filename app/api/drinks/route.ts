const Database = require('better-sqlite3');
const path = require('path');

export async function GET() {
  let db;
  try {
    // Use the same database as MCP server
    const dbPath = path.join(process.cwd(), 'data', 'bar.db');
    db = new Database(dbPath, { readonly: true });
    
    // Get drinks with current inventory from MCP database
    const drinks = db.prepare(`
      SELECT 
        id,
        name,
        category,
        subcategory,
        price,
        inventory_oz,
        unit_volume_oz,
        created_at,
        updated_at
      FROM drinks 
      ORDER BY category, name
    `).all();

    // Calculate inventory in units (bottles/cans) for display
    const drinksWithUnits = drinks.map(drink => {
      const units = drink.unit_volume_oz > 0 ? Math.floor(drink.inventory_oz / drink.unit_volume_oz) : 0;
      return {
        ...drink,
        inventory: units, // For backwards compatibility with UI
        inventory_units: units,
        serving_options: [{ // Mock serving options for UI compatibility
          id: 1,
          name: 'bottle',
          price: drink.price,
          volume_oz: drink.unit_volume_oz
        }]
      };
    });

    return new Response(JSON.stringify(drinksWithUnits), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to fetch drinks:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch drinks' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (db) {
      db.close();
    }
  }
}
