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
        unit_type: drinks.unit_type,
        unit_volume_oz: drinks.unit_volume_oz,
        serving_size_oz: drinks.serving_size_oz,
        servings_per_container: drinks.servings_per_container,
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
        existing.unit_type = drink.unit_type || existing.unit_type;
        existing.unit_volume_oz = drink.unit_volume_oz || existing.unit_volume_oz;
        existing.serving_size_oz = drink.serving_size_oz || existing.serving_size_oz;
        existing.servings_per_container = drink.servings_per_container || existing.servings_per_container;
        existing.cost_per_unit = drink.cost_per_unit || existing.cost_per_unit;
        existing.profit_margin = drink.profit_margin || existing.profit_margin;
        existing.popularity_score = Math.max(existing.popularity_score, drink.popularity_score || 0);
        existing.updated_at = (drink.updated_at && existing.updated_at && drink.updated_at > existing.updated_at) ? drink.updated_at : existing.updated_at;
      } else {
        drinkGroups.set(key, {
          id: drink.id,
          name: drink.name,
          category: drink.category,
          subcategory: drink.subcategory,
          price: drink.price,
          static_inventory: drink.static_inventory || 0,
          total_remaining_ml: drink.total_remaining_ml || 0,
          unit_type: drink.unit_type,
          unit_volume_oz: drink.unit_volume_oz,
          serving_size_oz: drink.serving_size_oz,
          servings_per_container: drink.servings_per_container,
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
        // Use serving_size_oz if available, otherwise fall back to defaults
        const serving_size_ml = drink.serving_size_oz ? drink.serving_size_oz * 29.5735 : 
          (drink.category === 'Beer' || drink.category === 'Wine') ? 355 : 44.3; // ~12oz for beer/wine, 1.5oz for spirits
        calculatedInventory = Math.floor(drink.total_remaining_ml / serving_size_ml);
        // Convert ml to oz for UI display (1 ml = 0.033814 oz)
        totalRemainingOz = drink.total_remaining_ml * 0.033814;
      } else {
        // If no detailed inventory, use serving_size_oz if available
        const serving_size_oz = drink.serving_size_oz || 
          (drink.category === 'Beer' || drink.category === 'Wine') ? 12 : 1.5;
        totalRemainingOz = calculatedInventory * serving_size_oz;
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
        unit_type: drink.unit_type,
        unit_volume_oz: drink.unit_volume_oz, // Keep for backward compatibility
        serving_size_oz: drink.serving_size_oz || 
          (drink.category === 'Beer' || drink.category === 'Wine') ? 12 : 1.5, // Unit size
        servings_per_container: drink.servings_per_container,
        serving_options: [{
          id: 1,
          name: drink.unit_type || 'serving',
          price: drink.price / 100,
          volume_oz: drink.serving_size_oz || 
            (drink.category === 'Beer' || drink.category === 'Wine') ? 12 : 1.5
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      name, 
      category, 
      subcategory, 
      price, 
      inventory = 0, 
      unit_type = 'serving',
      unit_volume_oz, 
      serving_size_oz,
      servings_per_container,
      cost_per_unit, 
      description,
      image_url 
    } = body;

    // Validate required fields
    if (!name || !category || !price) {
      return new Response(
        JSON.stringify({ error: 'Name, category, and price are required' }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert price to cents if it's in dollars
    const priceInCents = typeof price === 'number' ? Math.round(price * 100) : price;
    const costInCents = cost_per_unit ? Math.round(cost_per_unit * 100) : null;

    // Calculate profit margin if cost is provided
    const profitMargin = costInCents ? ((priceInCents - costInCents) / priceInCents) * 100 : null;

    // Insert new drink
    const [newDrink] = await db.insert(drinks).values({
      name: name.trim(),
      category: category.trim(),
      subcategory: subcategory?.trim(),
      price: priceInCents,
      inventory: inventory || 0,
      unit_type: unit_type,
      unit_volume_oz: unit_volume_oz,
      serving_size_oz: serving_size_oz || (category === 'Beer' || category === 'Wine' ? 12 : 1.5),
      servings_per_container: servings_per_container,
      cost_per_unit: costInCents,
      profit_margin: profitMargin,
      description: description?.trim(),
      image_url: image_url?.trim(),
      is_active: true,
      updated_at: sql`NOW()`
    }).returning();

    console.log('✅ Created new drink:', newDrink);

    return new Response(JSON.stringify({
      success: true,
      drink: {
        id: newDrink.id.toString(),
        name: newDrink.name,
        category: newDrink.category,
        subcategory: newDrink.subcategory,
        price: newDrink.price / 100, // Convert back to dollars
        inventory: newDrink.inventory,
        unit_volume_oz: newDrink.unit_volume_oz,
        cost_per_unit: newDrink.cost_per_unit ? newDrink.cost_per_unit / 100 : null,
        profit_margin: newDrink.profit_margin,
        description: newDrink.description,
        image_url: newDrink.image_url,
        created_at: newDrink.created_at
      }
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('❌ Failed to create drink:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create drink',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const drinkId = url.searchParams.get('id');
    const drinkName = url.searchParams.get('name');

    if (!drinkId && !drinkName) {
      return new Response(
        JSON.stringify({ error: 'Either drink ID or name is required' }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find and soft-delete the drink(s)
    let deletedDrinks;
    if (drinkId) {
      deletedDrinks = await db
        .update(drinks)
        .set({ 
          is_active: false,
          updated_at: sql`NOW()`
        })
        .where(eq(drinks.id, parseInt(drinkId)))
        .returning();
    } else if (drinkName) {
      deletedDrinks = await db
        .update(drinks)
        .set({ 
          is_active: false,
          updated_at: sql`NOW()`
        })
        .where(eq(drinks.name, drinkName.trim()))
        .returning();
    }

    if (!deletedDrinks || deletedDrinks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Drink not found' }), 
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('✅ Soft-deleted drink(s):', deletedDrinks);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully removed ${deletedDrinks.length} drink(s)`,
      deletedDrinks: deletedDrinks.map(drink => ({
        id: drink.id,
        name: drink.name,
        category: drink.category
      }))
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('❌ Failed to delete drink:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete drink',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
