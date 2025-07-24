/**
 * Simple Inventory Service
 * Focuses on reliable, immediate inventory updates using the drinks.inventory column
 */

import db, { clearCache } from '../db/index';
import { drinks } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { performanceMonitor, timed } from './performance-monitor';

export interface SimpleInventoryUpdate {
  drinkId: number;
  drinkName: string;
  quantityUsed: number;
  previousInventory: number;
  newInventory: number;
}

export class SimpleInventoryService {
  
  /**
   * Update inventory for a single drink
   */
  async updateDrinkInventory(drinkId: number, quantityToDeduct: number): Promise<{
    success: boolean;
    update?: SimpleInventoryUpdate;
    message: string;
  }> {
    try {
      console.log(`📦 Updating inventory for drink ${drinkId}, deducting ${quantityToDeduct}`);

      // Get current drink info
      const [currentDrink] = await db
        .select({
          id: drinks.id,
          name: drinks.name,
          inventory: drinks.inventory
        })
        .from(drinks)
        .where(eq(drinks.id, drinkId))
        .limit(1);

      if (!currentDrink) {
        return {
          success: false,
          message: `Drink with ID ${drinkId} not found`
        };
      }

      const previousInventory = currentDrink.inventory;
      const newInventory = Math.max(0, previousInventory - quantityToDeduct);

      console.log(`   ${currentDrink.name}: ${previousInventory} → ${newInventory} (${quantityToDeduct} used)`);

      // Update inventory
      const [updatedDrink] = await db
        .update(drinks)
        .set({
          inventory: newInventory,
          updated_at: sql`NOW()`
        })
        .where(eq(drinks.id, drinkId))
        .returning({
          id: drinks.id,
          name: drinks.name,
          inventory: drinks.inventory
        });

      // Clear cache for this drink
      clearCache(`drink:${currentDrink.name.toLowerCase()}`);
      clearCache(`inventory:${drinkId}`);

      const update: SimpleInventoryUpdate = {
        drinkId,
        drinkName: currentDrink.name,
        quantityUsed: quantityToDeduct,
        previousInventory,
        newInventory: updatedDrink.inventory
      };

      return {
        success: true,
        update,
        message: `Updated ${currentDrink.name} inventory: ${previousInventory} → ${newInventory}`
      };

    } catch (error) {
      console.error('❌ Error updating drink inventory:', error);
      return {
        success: false,
        message: `Failed to update inventory: ${error.message}`
      };
    }
  }

  /**
   * Update inventory for multiple drinks (for orders)
   */
  async updateOrderInventory(
    orderId: number,
    items: Array<{drinkId: number, quantity: number, name?: string}>
  ): Promise<{
    success: boolean;
    updates: SimpleInventoryUpdate[];
    errors: string[];
    message: string;
  }> {
    console.log(`📦 Processing inventory updates for order ${orderId}...`);
    
    const updates: SimpleInventoryUpdate[] = [];
    const errors: string[] = [];

    try {
      // Process each item
      for (const item of items) {
        try {
          const result = await this.updateDrinkInventory(item.drinkId, item.quantity);
          
          if (result.success && result.update) {
            updates.push(result.update);
            console.log(`   ✅ ${result.update.drinkName}: -${item.quantity}`);
          } else {
            errors.push(`${item.name || `Drink ${item.drinkId}`}: ${result.message}`);
            console.log(`   ❌ ${item.name || `Drink ${item.drinkId}`}: ${result.message}`);
          }
        } catch (error) {
          const errorMsg = `${item.name || `Drink ${item.drinkId}`}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`   ❌ Error processing item:`, error);
        }
      }

      const success = errors.length === 0;
      
      return {
        success,
        updates,
        errors,
        message: success 
          ? `Successfully updated inventory for ${updates.length} items`
          : `Updated ${updates.length} items, ${errors.length} errors`
      };

    } catch (error) {
      console.error('❌ Error processing order inventory:', error);
      return {
        success: false,
        updates,
        errors: [...errors, `System error: ${error.message}`],
        message: 'Failed to process order inventory updates'
      };
    }
  }

  /**
   * Check if sufficient inventory is available for an order
   */
  async checkInventoryAvailability(
    items: Array<{drinkId: number, quantity: number, name?: string}>
  ): Promise<{
    available: boolean;
    insufficientItems: Array<{drinkId: number, name?: string, requested: number, available: number}>;
    message: string;
  }> {
    const insufficientItems = [];

    try {
      for (const item of items) {
        // Get current inventory
        const [drink] = await db
          .select({
            id: drinks.id,
            name: drinks.name,
            inventory: drinks.inventory
          })
          .from(drinks)
          .where(eq(drinks.id, item.drinkId))
          .limit(1);

        if (!drink) {
          insufficientItems.push({
            drinkId: item.drinkId,
            name: item.name,
            requested: item.quantity,
            available: 0
          });
          continue;
        }

        if (drink.inventory < item.quantity) {
          insufficientItems.push({
            drinkId: item.drinkId,
            name: drink.name,
            requested: item.quantity,
            available: drink.inventory
          });
        }
      }

      const available = insufficientItems.length === 0;
      
      return {
        available,
        insufficientItems,
        message: available 
          ? 'All items available'
          : `Insufficient inventory for ${insufficientItems.length} items`
      };

    } catch (error) {
      console.error('❌ Error checking inventory availability:', error);
      return {
        available: false,
        insufficientItems,
        message: `Error checking availability: ${error.message}`
      };
    }
  }

  /**
   * Get current inventory for a drink
   */
  async getDrinkInventory(drinkId: number): Promise<{
    success: boolean;
    drink?: {
      id: number;
      name: string;
      inventory: number;
      category: string;
      servingSize?: number;
    };
    message: string;
  }> {
    try {
      const [drink] = await db
        .select({
          id: drinks.id,
          name: drinks.name,
          inventory: drinks.inventory,
          category: drinks.category,
          serving_size_oz: drinks.serving_size_oz
        })
        .from(drinks)
        .where(eq(drinks.id, drinkId))
        .limit(1);

      if (!drink) {
        return {
          success: false,
          message: `Drink with ID ${drinkId} not found`
        };
      }

      return {
        success: true,
        drink: {
          id: drink.id,
          name: drink.name,
          inventory: drink.inventory,
          category: drink.category,
          servingSize: drink.serving_size_oz
        },
        message: `${drink.name}: ${drink.inventory} units available`
      };

    } catch (error) {
      console.error('❌ Error getting drink inventory:', error);
      return {
        success: false,
        message: `Error getting inventory: ${error.message}`
      };
    }
  }

  /**
   * Restore inventory (for order cancellations)
   */
  async restoreInventory(
    items: Array<{drinkId: number, quantity: number, name?: string}>
  ): Promise<{
    success: boolean;
    updates: SimpleInventoryUpdate[];
    message: string;
  }> {
    console.log('🔄 Restoring inventory for cancelled/refunded items...');
    
    const updates: SimpleInventoryUpdate[] = [];

    try {
      for (const item of items) {
        // Add back to inventory (negative deduction)
        const result = await this.updateDrinkInventory(item.drinkId, -item.quantity);
        
        if (result.success && result.update) {
          updates.push(result.update);
          console.log(`   ✅ Restored ${item.quantity} ${result.update.drinkName}`);
        }
      }

      return {
        success: true,
        updates,
        message: `Restored inventory for ${updates.length} items`
      };

    } catch (error) {
      console.error('❌ Error restoring inventory:', error);
      return {
        success: false,
        updates,
        message: `Failed to restore inventory: ${error.message}`
      };
    }
  }
}

export const simpleInventoryService = new SimpleInventoryService();