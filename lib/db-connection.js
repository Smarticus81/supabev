// Production-level PostgreSQL database connection for Node.js MCP integration
const { neon } = require('@neondatabase/serverless');

// Load environment variables
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

// PostgreSQL database manager for MCP-connected NeonDB
class DatabaseManager {
  constructor() {
    this.sql = sql;
  }

  // MCP Interface Methods - Match what tools.js expects

  // Get all drinks with serving options (for list_drinks)
  async getDrinks() {
    try {
      const drinks = await this.sql`
        SELECT 
          d.id, d.name, d.category, d.subcategory, d.price, d.inventory_oz,
          d.unit_type, d.serving_size_oz, d.servings_per_container,
          d.cost_per_unit, d.profit_margin, d.popularity_score, 
          d.is_active, d.description, d.image_url
        FROM drinks d
        WHERE d.is_active = true 
        ORDER BY d.category, d.name
      `;

      // Get serving options for each drink
      for (const drink of drinks) {
        const servingOptions = await this.sql`
          SELECT so.id, so.name, so.volume_oz, so.price
          FROM serving_options so
          WHERE so.drink_id = ${drink.id}
          ORDER BY so.volume_oz
        `;
        drink.serving_options = servingOptions;
      }

      return drinks;
    } catch (error) {
      console.error('Error fetching drinks with serving options:', error);
      throw error;
    }
  }

  // Get single drink with serving options (for get_drink)
  async getDrink(id, name) {
    try {
      let drink;
      
      if (id) {
        const result = await this.sql`
          SELECT 
            d.id, d.name, d.category, d.subcategory, d.price, d.inventory_oz,
            d.unit_type, d.serving_size_oz, d.servings_per_container,
            d.cost_per_unit, d.profit_margin, d.popularity_score, 
            d.is_active, d.description, d.image_url
          FROM drinks d
          WHERE d.id = ${id} AND d.is_active = true
        `;
        drink = result[0];
      } else if (name) {
        const result = await this.sql`
          SELECT 
            d.id, d.name, d.category, d.subcategory, d.price, d.inventory_oz,
            d.unit_type, d.serving_size_oz, d.servings_per_container,
            d.cost_per_unit, d.profit_margin, d.popularity_score, 
            d.is_active, d.description, d.image_url
          FROM drinks d
          WHERE d.name = ${name} AND d.is_active = true
        `;
        drink = result[0];
      }

      if (!drink) return null;

      // Since we're using the consolidated drinks table, we don't need separate serving options
      // The serving information is part of the drinks table
      drink.serving_options = [{
        id: drink.id,
        name: drink.unit_type || 'serving',
        volume_oz: drink.serving_size_oz || 1,
        price: drink.price
      }];
      
      return drink;
    } catch (error) {
      console.error('Error fetching single drink:', error);
      throw error;
    }
  }

  // Get drink and serving option with fuzzy matching (for create_order)
  async getServingOption(drinkName, servingName) {
    try {
      // Since we don't have a separate serving_options table, 
      // we'll use the drinks table directly with standard serving information
      const result = await this.sql`
        SELECT 
          d.id, 
          d.price, 
          d.serving_size_oz as volume_oz, 
          d.inventory as inventory_oz, 
          d.id as drink_id, 
          d.category,
          d.name,
          d.unit_type
        FROM drinks d
        WHERE LOWER(d.name) = LOWER(${drinkName}) AND d.is_active = true
        LIMIT 1
      `;
      
      if (result.length > 0) {
        return result[0];
      }

      // If exact match fails, try fuzzy matching
      const fuzzyResult = await this.sql`
        SELECT 
          d.id, 
          d.price, 
          d.serving_size_oz as volume_oz, 
          d.inventory as inventory_oz, 
          d.id as drink_id, 
          d.category,
          d.name,
          d.unit_type
        FROM drinks d
        WHERE LOWER(d.name) LIKE LOWER(${`%${drinkName}%`}) AND d.is_active = true
        LIMIT 1
      `;
      
      return fuzzyResult.length > 0 ? fuzzyResult[0] : null;
    } catch (error) {
      console.error('Error fetching serving option:', error);
      throw error;
    }
  }

  // Update inventory for order processing
  async updateInventoryForOrder(drinkId, quantity) {
    try {
      await this.sql`
        UPDATE drinks 
        SET inventory = inventory - ${quantity}
        WHERE id = ${drinkId} AND inventory >= ${quantity}
      `;
      return true;
    } catch (error) {
      console.error('Error updating inventory for order:', error);
      return false;
    }
  }

  // Create order with items
  async createOrder(orderData) {
    try {
      // Create the order
      const orderResult = await this.sql`
        INSERT INTO orders (items, subtotal, tax_amount, total, created_at)
        VALUES (${JSON.stringify(orderData.items)}, ${orderData.subtotal}, ${orderData.tax}, ${orderData.total}, NOW())
        RETURNING id
      `;
      
      const orderId = orderResult[0].id;
      return orderId;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Get order with items
  async getOrder(orderId) {
    try {
      const orderResult = await this.sql`
        SELECT * FROM orders WHERE id = ${orderId}
      `;
      
      if (orderResult.length === 0) {
        return null;
      }
      
      const order = orderResult[0];
      
      const items = await this.sql`
        SELECT oi.id, d.name as drink_name, so.name as serving_name, oi.quantity, oi.price
        FROM order_items oi
        JOIN serving_options so ON oi.serving_option_id = so.id
        JOIN drinks d ON so.drink_id = d.id
        WHERE oi.order_id = ${orderId}
      `;
      
      order.items = items;
      return order;
    } catch (error) {
      console.error('Error getting order:', error);
      return null;
    }
  }

  // Cancel order and restore inventory
  async cancelOrder(orderId) {
    try {
      // Get order items to restore inventory
      const items = await this.sql`
        SELECT oi.quantity, so.volume_oz, d.id as drink_id
        FROM order_items oi
        JOIN serving_options so ON oi.serving_option_id = so.id
        JOIN drinks d ON so.drink_id = d.id
        WHERE oi.order_id = ${orderId} AND d.inventory_oz IS NOT NULL
      `;
      
      // Restore inventory
      for (const item of items) {
        const totalVolumeRestored = item.volume_oz * item.quantity;
        await this.sql`
          UPDATE drinks 
          SET inventory_oz = inventory_oz + ${totalVolumeRestored} 
          WHERE id = ${item.drink_id}
        `;
      }
      
      // Delete the order (cascades to order_items)
      await this.sql`DELETE FROM orders WHERE id = ${orderId}`;
      
      return true;
    } catch (error) {
      console.error('Error cancelling order:', error);
      return false;
    }
  }

  // Check inventory with fuzzy matching
  async checkInventory(drinkName) {
    try {
      // Try exact match first
      let result = await this.sql`
        SELECT name, inventory_oz, category, subcategory, serving_size_oz, unit_type
        FROM drinks 
        WHERE name = ${drinkName} AND is_active = true
      `;
      
      if (result.length > 0) {
        return result[0];
      }
      
      // Try fuzzy matching with common speech recognition corrections
      const corrections = {
        'cores': 'coors',
        'course': 'coors', 
        'cors': 'coors',
        'heiniken': 'heineken',
        'budwiser': 'budweiser',
        'bud lite': 'bud light',
        'miller light': 'miller lite',
        'corona': 'corona extra'
      };
      
      let searchTerms = [drinkName];
      const normalized = drinkName.toLowerCase();
      
      for (const [wrong, correct] of Object.entries(corrections)) {
        if (normalized.includes(wrong)) {
          searchTerms.push(drinkName.toLowerCase().replace(wrong, correct));
        }
      }
      
      for (const term of searchTerms) {
        const fuzzyResult = await this.sql`
          SELECT name, inventory_oz, category, subcategory, serving_size_oz, unit_type,
          CASE 
            WHEN LOWER(name) = LOWER(${term}) THEN 100
            WHEN LOWER(name) LIKE LOWER(${term + '%'}) THEN 90
            WHEN LOWER(name) LIKE LOWER(${'%' + term + '%'}) THEN 80
            WHEN LOWER(name) LIKE LOWER(${'%' + term.replace(/\s+/g, '%') + '%'}) THEN 70
            ELSE 0
          END as score
          FROM drinks
          WHERE is_active = true
          ORDER BY score DESC, LENGTH(name)
          LIMIT 1
        `;
        
        if (fuzzyResult.length > 0 && fuzzyResult[0].score >= 70) {
          return fuzzyResult[0];
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error checking inventory:', error);
      return null;
    }
  }

  // Update inventory directly
  async updateInventory(drinkName, inventoryOz) {
    try {
      const result = await this.sql`
        UPDATE drinks 
        SET inventory_oz = ${inventoryOz} 
        WHERE name = ${drinkName} AND is_active = true
      `;
      return result.count > 0;
    } catch (error) {
      console.error('Error updating inventory:', error);
      return false;
    }
  }

  // Add inventory with unit conversion
  async addInventory(drinkName, quantity, unit = 'bottles') {
    try {
      // Get drink info
      let result = await this.sql`
        SELECT id, inventory_oz, serving_size_oz, unit_type, category, subcategory
        FROM drinks 
        WHERE name = ${drinkName} AND is_active = true
      `;
      
      if (result.length === 0) {
        // Try fuzzy matching
        const drinkInfo = await this.checkInventory(drinkName);
        if (!drinkInfo) {
          return { success: false, error: `Drink '${drinkName}' not found.` };
        }
        
        result = await this.sql`
          SELECT id, inventory_oz, serving_size_oz, unit_type, category, subcategory
          FROM drinks 
          WHERE name = ${drinkInfo.name} AND is_active = true
        `;
        
        if (result.length === 0) {
          return { success: false, error: `Drink '${drinkName}' not found.` };
        }
      }
      
      const drink = result[0];
      
      // Calculate ounces to add based on unit type and serving size
      let addedOz;
      const servingSize = drink.serving_size_oz || (drink.category === 'Beer' ? 12 : 25.36);
      
      if (unit === 'bottles' || unit === 'units') {
        addedOz = quantity * servingSize;
      } else if (unit === 'ounces') {
        addedOz = quantity;
      } else {
        addedOz = quantity; // Default to ounces
      }
      
      const newInventoryOz = (drink.inventory_oz || 0) + addedOz;
      
      await this.sql`
        UPDATE drinks 
        SET inventory_oz = ${newInventoryOz} 
        WHERE id = ${drink.id}
      `;
      
      // Calculate units for display
      const totalUnits = Math.floor(newInventoryOz / servingSize);
      const unitsAdded = Math.round(addedOz / servingSize);
      
      let unitName = drink.unit_type || 'bottles';
      if (drink.category === 'Beer' && drink.subcategory === 'Hard Seltzer') {
        unitName = 'cans';
      }
      
      return {
        success: true,
        drink_name: drinkName,
        inventory_oz: newInventoryOz,
        units_added: unitsAdded,
        total_units: totalUnits,
        added_oz: addedOz,
        unit_name: unitName
      };
      
    } catch (error) {
      console.error('Error adding inventory:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance for MCP integration
const dbManager = new DatabaseManager();
module.exports = dbManager;
