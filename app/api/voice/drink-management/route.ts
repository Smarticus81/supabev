import db, { drinkCache, getCachedData, setCachedData, clearCache } from '../../../../db/index';
import { drinks } from '../../../../db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    console.log('🎤 Voice drink management request:', { action, params });

    switch (action) {
      case 'create_drink':
        return await createDrink(params);
      case 'remove_drink':
        return await removeDrink(params);
      case 'update_drink_details':
        return await updateDrinkDetails(params);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }), 
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error('❌ Voice drink management error:', error);
    return new Response(JSON.stringify({ 
      error: 'Voice command failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function createDrink(params: any) {
  const { 
    name, 
    category, 
    subcategory, 
    price, 
    inventory = 0, 
    unit_volume_oz, 
    cost_per_unit, 
    description,
    image_url 
  } = params;

  // Validate required fields
  if (!name || !category || !price) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing required information. I need at least a name, category, and price to create a drink.',
        missing_fields: [
          !name && 'name',
          !category && 'category', 
          !price && 'price'
        ].filter(Boolean)
      }), 
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Convert price to cents
    const priceInCents = Math.round(price * 100);
    const costInCents = cost_per_unit ? Math.round(cost_per_unit * 100) : null;

    // Calculate profit margin if cost is provided
    const profitMargin = costInCents ? ((priceInCents - costInCents) / priceInCents) * 100 : null;

    // Determine default unit volume based on category
    const defaultVolume = category.toLowerCase() === 'beer' || category.toLowerCase() === 'wine' ? 12 : 
                         category.toLowerCase() === 'spirits' || category.toLowerCase() === 'cocktails' ? 1.5 : 
                         8; // Default for other categories

    // Insert new drink
    const [newDrink] = await db.insert(drinks).values({
      name: name.trim(),
      category: category.trim(),
      subcategory: subcategory?.trim(),
      price: priceInCents,
      inventory: inventory || 0,
      unit_volume_oz: unit_volume_oz || defaultVolume,
      cost_per_unit: costInCents,
      profit_margin: profitMargin,
      description: description?.trim(),
      image_url: image_url?.trim(),
      is_active: true,
      updated_at: sql`NOW()`
    }).returning();

    // Clear relevant cache entries
    clearCache(`drink:${name.trim().toLowerCase()}`);
    clearCache(`search:${category.trim().toLowerCase()}`);

    console.log('✅ Voice-created new drink:', newDrink);

    return new Response(JSON.stringify({
      success: true,
      message: `Perfect! I've successfully created "${name}" and added it to our ${category} menu at $${price.toFixed(2)}.`,
      drink: {
        id: newDrink.id.toString(),
        name: newDrink.name,
        category: newDrink.category,
        subcategory: newDrink.subcategory,
        price: newDrink.price / 100,
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
    console.error('❌ Failed to create drink via voice:', error);
    return new Response(JSON.stringify({ 
      error: 'I encountered an issue creating that drink. Please try again.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function removeDrink(params: any) {
  const { drink_name, drink_id } = params;

  if (!drink_id && !drink_name) {
    return new Response(
      JSON.stringify({ error: 'I need either a drink name or ID to remove it from the menu.' }), 
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
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
      return new Response(
        JSON.stringify({ 
          error: `I couldn't find "${drink_name || drink_id}" in our menu. Could you double-check the name?`,
          suggestion: 'Try asking me to search for drinks if you\'re not sure of the exact name.'
        }), 
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('✅ Voice-removed drink(s):', deletedDrinks);

    const drinkNames = deletedDrinks.map(d => d.name).join(', ');
    return new Response(JSON.stringify({
      success: true,
      message: `Done! I've successfully removed "${drinkNames}" from our menu.`,
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
    console.error('❌ Failed to remove drink via voice:', error);
    return new Response(JSON.stringify({ 
      error: 'I encountered an issue removing that drink. Please try again.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function updateDrinkDetails(params: any) {
  const { drink_name, updates } = params;

  if (!drink_name || !updates) {
    return new Response(
      JSON.stringify({ error: 'I need both a drink name and the details to update.' }), 
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
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
      return new Response(
        JSON.stringify({ 
          error: `I couldn't find "${drink_name}" in our menu to update. Could you check the name?`
        }), 
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('✅ Voice-updated drink:', updatedDrink);

    const updatesList = Object.keys(updates).map(key => {
      if (key === 'price') return `price to $${updates.price.toFixed(2)}`;
      return `${key} to "${updates[key]}"`;
    }).join(', ');

    return new Response(JSON.stringify({
      success: true,
      message: `Perfect! I've updated "${drink_name}" with the new ${updatesList}.`,
      drink: {
        id: updatedDrink.id.toString(),
        name: updatedDrink.name,
        category: updatedDrink.category,
        subcategory: updatedDrink.subcategory,
        price: updatedDrink.price / 100,
        description: updatedDrink.description,
        updated_at: updatedDrink.updated_at
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('❌ Failed to update drink via voice:', error);
    return new Response(JSON.stringify({ 
      error: 'I encountered an issue updating that drink. Please try again.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
