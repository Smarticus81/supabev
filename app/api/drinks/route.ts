import db from '../../../db/index';
import { drinks, inventory } from '../../../db/schema';
import { asc, sql, eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    // Subquery to calculate total remaining volume for each drink_id from inventory
    const inventorySubQuery = db
      .select({
        drink_id: inventory.drink_id,
        total_remaining_ml: sql<number>`sum(CAST(${inventory.remaining_ml} AS numeric))`.as('total_remaining_ml'),
      })
      .from(inventory)
      .groupBy(inventory.drink_id)
      .as('inventory_summary');

    const allDrinks = await db
      .select({
        id: drinks.id,
        name: drinks.name,
        category: drinks.category,
        subcategory: drinks.subcategory,
        price: drinks.price,
        static_inventory: drinks.inventory,
        total_remaining_ml: inventorySubQuery.total_remaining_ml,
        unit_volume_oz: drinks.unit_volume_oz,
        cost_per_unit: drinks.cost_per_unit,
        profit_margin: drinks.profit_margin,
        popularity_score: drinks.popularity_score,
        tax_category_id: drinks.tax_category_id,
        image_url: drinks.image_url,
        description: drinks.description,
        is_active: drinks.is_active,
        created_at: drinks.created_at,
        updated_at: drinks.updated_at,
      })
      .from(drinks)
      .leftJoin(inventorySubQuery, eq(drinks.id, inventorySubQuery.drink_id))
      .where(eq(drinks.is_active, true))
      .orderBy(asc(drinks.category), asc(drinks.name));

    // Group drinks by name and consolidate duplicates
    const drinkGroups = new Map<string, any>();
    
    allDrinks.forEach(drink => {
      const key = `${drink.name}-${drink.category}`;
      
      if (drinkGroups.has(key)) {
        const existing = drinkGroups.get(key);
        // Sum inventory and remaining volumes
        existing.static_inventory += drink.static_inventory || 0;
        existing.total_remaining_ml += drink.total_remaining_ml || 0;
        // Use the lowest price (better for customers)
        existing.price = Math.min(existing.price, drink.price);
        // Update other fields with latest values
        existing.unit_volume_oz = drink.unit_volume_oz || existing.unit_volume_oz;
        existing.cost_per_unit = drink.cost_per_unit || existing.cost_per_unit;
        existing.profit_margin = drink.profit_margin || existing.profit_margin;
        existing.popularity_score = Math.max(existing.popularity_score, drink.popularity_score || 0);
        existing.updated_at = drink.updated_at > existing.updated_at ? drink.updated_at : existing.updated_at;
      } else {
        drinkGroups.set(key, {
          id: drink.id,
          name: drink.name,
          category: drink.category,
          subcategory: drink.subcategory,
          price: drink.price,
          static_inventory: drink.static_inventory || 0,
          total_remaining_ml: drink.total_remaining_ml || 0,
          unit_volume_oz: drink.unit_volume_oz,
          cost_per_unit: drink.cost_per_unit,
          profit_margin: drink.profit_margin,
          popularity_score: drink.popularity_score || 0,
          tax_category_id: drink.tax_category_id,
          image_url: drink.image_url,
          description: drink.description,
          is_active: drink.is_active,
          created_at: drink.created_at,
          updated_at: drink.updated_at,
        });
      }
    });

    // Format consolidated drinks for UI compatibility
    const formattedDrinks = Array.from(drinkGroups.values()).map(drink => {
      // Default to static inventory from the drinks table
      let calculatedInventory = drink.static_inventory;
      let totalRemainingOz = 0;

      // If there's detailed inventory data, calculate servings from remaining volume
      if (drink.total_remaining_ml > 0) {
        const unit_volume_ml = (drink.category === 'Beer' || drink.category === 'Wine') ? 355 : 44.3; // ~12oz for beer/wine, 1.5oz for spirits
        calculatedInventory = Math.floor(drink.total_remaining_ml / unit_volume_ml);
        // Convert ml to oz for UI display (1 ml = 0.033814 oz)
        totalRemainingOz = drink.total_remaining_ml * 0.033814;
      } else {
        // If no detailed inventory, estimate oz based on static inventory and unit volumes
        const unit_volume_oz = (drink.category === 'Beer' || drink.category === 'Wine') ? 12 : 1.5;
        totalRemainingOz = calculatedInventory * unit_volume_oz;
      }

      return {
        id: drink.id.toString(),
        name: drink.name,
        category: drink.category,
        subcategory: drink.category,
        price: drink.price / 100, // Convert from cents to dollars
        inventory: calculatedInventory,
        inventory_units: calculatedInventory,
        inventory_oz: totalRemainingOz, // Raw volume in ounces for inventory page
        unit_volume_oz: (drink.category === 'Beer' || drink.category === 'Wine') ? 12 : 1.5, // Unit size
        serving_options: [{
          id: 1,
          name: 'bottle',
          price: drink.price / 100,
          volume_oz: (drink.category === 'Beer' || drink.category === 'Wine') ? 12 : 1.5
        }]
      };
    });

    return new Response(JSON.stringify(formattedDrinks), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to fetch drinks:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch drinks' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
