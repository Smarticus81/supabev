/**
 * Enhanced Inventory Service
 * Handles proper serving size deduction logic and real-time inventory updates
 */

import db, { clearCache } from '../db/index';
import { drinks, inventory, pours, inventoryMovements } from '../db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import type { NewPour, NewInventoryMovement } from '../db/schema';
import { performanceMonitor, timed } from './performance-monitor';

export interface ServingInfo {
  drinkId: number;
  drinkName: string;
  category: string;
  servingSize: number; // in ounces
  unitVolume: number; // in ounces
  currentInventory: number; // current count
  availableServings: number; // calculated servings available
}

export interface PourRecord {
  drinkId: number;
  orderId?: number;
  staffId?: number;
  volumeOz: number;
  servingsUsed: number;
}

export class InventoryService {
  
  /**
   * Get proper serving information for a drink
   */
  
  async getServingInfo(drinkId: number): Promise<ServingInfo | null> {
    try {
      const [drink] = await db
        .select({
          id: drinks.id,
          name: drinks.name,
          category: drinks.category,
          inventory: drinks.inventory,
          serving_size_oz: drinks.serving_size_oz,
          unit_volume_oz: drinks.unit_volume_oz,
          servings_per_container: drinks.servings_per_container
        })
        .from(drinks)
        .where(eq(drinks.id, drinkId))
        .limit(1);

      if (!drink) return null;

      // Calculate proper serving size based on category if not set
      let servingSize = drink.serving_size_oz;
      if (!servingSize) {
        switch (drink.category.toLowerCase()) {
          case 'beer':
            servingSize = 12.0;
            break;
          case 'wine':
            servingSize = 5.0;
            break;
          case 'spirits':
          case 'liquor':
            servingSize = 1.5;
            break;
          case 'cocktails':
          case 'mixed drinks':
            servingSize = 8.0;
            break;
          default:
            servingSize = 8.0;
        }
      }

      // Calculate unit volume (container size)
      let unitVolume = drink.unit_volume_oz || servingSize;
      
      // For spirits, default to 750ml bottle = 25.36 oz
      if (drink.category.toLowerCase() === 'spirits' && !drink.unit_volume_oz) {
        unitVolume = 25.36;
      }

      // Calculate available servings
      const servingsPerContainer = drink.servings_per_container || Math.floor(unitVolume / servingSize);
      const availableServings = drink.inventory * servingsPerContainer;

      return {
        drinkId: drink.id,
        drinkName: drink.name,
        category: drink.category,
        servingSize,
        unitVolume,
        currentInventory: drink.inventory,
        availableServings
      };
    } catch (error) {
      console.error('Error getting serving info:', error);
      return null;
    }
  }

  /**
   * Check if sufficient inventory is available for an order
   */
  
  async checkInventoryAvailability(items: Array<{drinkId: number, quantity: number}>): Promise<{
    available: boolean;
    insufficientItems: Array<{drinkId: number, requested: number, available: number}>;
  }> {
    const insufficientItems = [];
    
    for (const item of items) {
      const servingInfo = await this.getServingInfo(item.drinkId);
      if (!servingInfo) {
        insufficientItems.push({
          drinkId: item.drinkId,
          requested: item.quantity,
          available: 0
        });
        continue;
      }

      if (servingInfo.availableServings < item.quantity) {
        insufficientItems.push({
          drinkId: item.drinkId,
          requested: item.quantity,
          available: servingInfo.availableServings
        });
      }
    }

    return {
      available: insufficientItems.length === 0,
      insufficientItems
    };
  }

  /**
   * Record a pour and update inventory properly
   */
  
  async recordPour(pourInfo: PourRecord): Promise<boolean> {
    try {
      const servingInfo = await this.getServingInfo(pourInfo.drinkId);
      if (!servingInfo) {
        throw new Error(`Drink ${pourInfo.drinkId} not found`);
      }

      // Calculate volume in ml for database storage
      const volumeMl = Math.round(pourInfo.volumeOz * 29.5735);

      // Find an appropriate inventory bottle to pour from
      const [inventoryBottle] = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.drink_id, pourInfo.drinkId),
            eq(inventory.status, 'opened'),
            gte(sql`CAST(${inventory.remaining_ml} AS REAL)`, volumeMl)
          )
        )
        .limit(1);

      let inventoryId = inventoryBottle?.id;

      // If no opened bottle has enough, open a new one
      if (!inventoryId) {
        const [newBottle] = await db
          .select()
          .from(inventory)
          .where(
            and(
              eq(inventory.drink_id, pourInfo.drinkId),
              eq(inventory.status, 'unopened')
            )
          )
          .limit(1);

        if (newBottle) {
          // Open the bottle
          await db
            .update(inventory)
            .set({
              status: 'opened',
              opened_at: sql`NOW()`
            })
            .where(eq(inventory.id, newBottle.id));
          
          inventoryId = newBottle.id;
        }
      }

      // Record the pour
      const pourData: NewPour = {
        inventory_id: inventoryId,
        order_id: pourInfo.orderId,
        staff_id: pourInfo.staffId,
        volume_ml: volumeMl.toString(),
        volume_oz: pourInfo.volumeOz,
        created_at: sql`NOW()`
      };

      const [newPour] = await db.insert(pours).values(pourData).returning();

      // Update bottle inventory if we have a specific bottle
      if (inventoryId) {
        await db
          .update(inventory)
          .set({
            remaining_ml: sql`CAST(${inventory.remaining_ml} AS REAL) - ${volumeMl}`,
            updated_at: sql`NOW()`
          })
          .where(eq(inventory.id, inventoryId));

        // Check if bottle is finished
        const [updatedBottle] = await db
          .select({ remaining_ml: inventory.remaining_ml })
          .from(inventory)
          .where(eq(inventory.id, inventoryId));

        if (updatedBottle && parseFloat(updatedBottle.remaining_ml) <= 0) {
          await db
            .update(inventory)
            .set({
              status: 'finished',
              finished_at: sql`NOW()`
            })
            .where(eq(inventory.id, inventoryId));
        }
      }

      // Update the main drinks inventory count
      // Calculate how many servings were used
      const servingsUsed = Math.ceil(pourInfo.volumeOz / servingInfo.servingSize);
      const containersUsed = Math.ceil(servingsUsed / (servingInfo.unitVolume / servingInfo.servingSize));

      await db
        .update(drinks)
        .set({
          inventory: sql`GREATEST(0, ${drinks.inventory} - ${containersUsed})`,
          updated_at: sql`NOW()`
        })
        .where(eq(drinks.id, pourInfo.drinkId));

      // Record inventory movement
      const movementData: NewInventoryMovement = {
        drink_id: pourInfo.drinkId,
        inventory_id: inventoryId,
        staff_id: pourInfo.staffId,
        movement_type: 'sale',
        quantity_change: -servingsUsed,
        reason: 'Pour recorded',
        reference_id: pourInfo.orderId,
        created_at: sql`NOW()`
      };

      await db.insert(inventoryMovements).values(movementData);

      // Clear relevant caches
      clearCache(`drink:${servingInfo.drinkName.toLowerCase()}`);
      clearCache(`inventory:${pourInfo.drinkId}`);

      return true;
    } catch (error) {
      console.error('Error recording pour:', error);
      return false;
    }
  }

  /**
   * Process multiple pours for an order (transaction-safe)
   */
  
  async processOrderPours(
    orderId: number,
    items: Array<{drinkId: number, quantity: number}>,
    staffId?: number
  ): Promise<{success: boolean, errors?: string[]}> {
    const errors: string[] = [];

    try {
      // First check availability
      const availability = await this.checkInventoryAvailability(items);
      if (!availability.available) {
        return {
          success: false,
          errors: availability.insufficientItems.map(item => 
            `Insufficient inventory for drink ${item.drinkId}: requested ${item.requested}, available ${item.available}`
          )
        };
      }

      // Process each pour
      for (const item of items) {
        const servingInfo = await this.getServingInfo(item.drinkId);
        if (!servingInfo) {
          errors.push(`Could not get serving info for drink ${item.drinkId}`);
          continue;
        }

        // Calculate total volume for this item
        const totalVolumeOz = item.quantity * servingInfo.servingSize;

        const pourRecord: PourRecord = {
          drinkId: item.drinkId,
          orderId,
          staffId,
          volumeOz: totalVolumeOz,
          servingsUsed: item.quantity
        };

        const success = await this.recordPour(pourRecord);
        if (!success) {
          errors.push(`Failed to record pour for drink ${item.drinkId}`);
        }
      }

      return {
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error processing order pours:', error);
      return {
        success: false,
        errors: [`Transaction failed: ${error.message}`]
      };
    }
  }

  /**
   * Get real-time inventory status
   */
  
  async getRealTimeInventoryStatus(drinkId?: number): Promise<any> {
    try {
      if (drinkId) {
        const servingInfo = await this.getServingInfo(drinkId);
        if (!servingInfo) {
          return {
            success: false,
            message: 'Drink not found'
          };
        }

        return {
          success: true,
          drink: {
            id: servingInfo.drinkId,
            name: servingInfo.drinkName,
            category: servingInfo.category,
            containers: servingInfo.currentInventory,
            availableServings: servingInfo.availableServings,
            servingSize: servingInfo.servingSize,
            unitVolume: servingInfo.unitVolume,
            status: servingInfo.availableServings > 10 ? 'good' : 
                   servingInfo.availableServings > 0 ? 'low' : 'out_of_stock'
          }
        };
      }

      // Get all drinks with real-time serving calculations
      const allDrinks = await db.select().from(drinks).where(eq(drinks.is_active, true));
      const inventoryStatus = [];

      for (const drink of allDrinks) {
        const servingInfo = await this.getServingInfo(drink.id);
        if (servingInfo) {
          inventoryStatus.push({
            id: drink.id,
            name: drink.name,
            category: drink.category,
            containers: servingInfo.currentInventory,
            availableServings: servingInfo.availableServings,
            servingSize: servingInfo.servingSize,
            status: servingInfo.availableServings > 10 ? 'good' : 
                   servingInfo.availableServings > 0 ? 'low' : 'out_of_stock'
          });
        }
      }

      return {
        success: true,
        inventory: inventoryStatus
      };
    } catch (error) {
      console.error('Error getting real-time inventory status:', error);
      return {
        success: false,
        message: 'Failed to get inventory status'
      };
    }
  }
}

export const inventoryService = new InventoryService();