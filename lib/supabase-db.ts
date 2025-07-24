import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, ilike } from 'drizzle-orm';
import * as schema from '../db/schema';

// Use Supabase connection string
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL!;

// Create the postgres client
const client = postgres(connectionString, {
  prepare: false,
  ssl: 'require',
});

// Create Drizzle instance
export const db = drizzle(client, { schema });

export class SupabaseDatabaseManager {
  constructor() {}

  async listDrinks(filters = {}) {
    try {
      const drinks = await db.select().from(schema.drinks).where(
        eq(schema.drinks.is_active, true)
      );
      
      return {
        success: true,
        drinks: drinks.map(drink => ({
          id: drink.id,
          name: drink.name,
          category: drink.category,
          subcategory: drink.subcategory,
          price: drink.price,
          inventory: drink.inventory,
          inventory_oz: drink.inventory_oz || 0,
          unit_type: drink.unit_type,
          unit_volume_oz: drink.unit_volume_oz,
          serving_size_oz: drink.serving_size_oz,
          is_active: drink.is_active
        }))
      };
    } catch (error) {
      console.error('Error listing drinks:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        drinks: []
      };
    }
  }

  async updateInventory(drinkName: string, quantityChange: number, unit = 'bottle') {
    try {
      // Find the drink first
      const drink = await db.select()
        .from(schema.drinks)
        .where(ilike(schema.drinks.name, `%${drinkName}%`))
        .limit(1);

      if (!drink.length) {
        throw new Error(`Drink '${drinkName}' not found.`);
      }

      const currentDrink = drink[0];
      
      // Convert quantity change to ounces based on unit type
      let ozChange = 0;
      if (unit === 'bottle' && currentDrink.unit_volume_oz) {
        ozChange = quantityChange * currentDrink.unit_volume_oz;
      } else if (unit === 'ounce') {
        ozChange = quantityChange;
      } else {
        // Default conversion
        ozChange = quantityChange * 12; // Assume 12 oz default
      }

      const newInventoryOz = (currentDrink.inventory_oz || 0) + ozChange;

      // Update the inventory
      const updated = await db.update(schema.drinks)
        .set({ 
          inventory_oz: newInventoryOz,
          updated_at: new Date()
        })
        .where(eq(schema.drinks.id, currentDrink.id))
        .returning();

      return {
        success: true,
        message: `Updated ${drinkName} inventory by ${quantityChange} ${unit}(s)`,
        drink_name: drinkName,
        previous_inventory_oz: currentDrink.inventory_oz || 0,
        new_inventory_oz: newInventoryOz,
        change_oz: ozChange
      };

    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  }

  async addInventory(drinkName: string, quantity: number, unit = 'bottle') {
    return this.updateInventory(drinkName, quantity, unit);
  }

  async createDrink(drinkData: any) {
    try {
      const newDrink = await db.insert(schema.drinks)
        .values({
          name: drinkData.name,
          category: drinkData.category,
          subcategory: drinkData.subcategory,
          price: drinkData.price,
          inventory: drinkData.inventory || 0,
          inventory_oz: drinkData.inventory_oz || 0,
          unit_type: drinkData.unit_type || 'bottle',
          unit_volume_oz: drinkData.unit_volume_oz,
          serving_size_oz: drinkData.serving_size_oz,
          cost_per_unit: drinkData.cost_per_unit,
          description: drinkData.description,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning();

      return {
        success: true,
        message: `Created drink: ${drinkData.name}`,
        drink: newDrink[0]
      };
    } catch (error) {
      console.error('Error creating drink:', error);
      throw error;
    }
  }

  async getCart(clientId = 'default') {
    // This would integrate with your cart system
    // For now, return empty cart structure
    return {
      success: true,
      cart: [],
      total: 0,
      clientId
    };
  }
}

// Export singleton instance
export const supabaseDb = new SupabaseDatabaseManager();
