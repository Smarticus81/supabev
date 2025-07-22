import { NextRequest, NextResponse } from 'next/server';
import { invoke } from '../../../lib/tools';

export async function GET() {
  try {
    // Get the cart data from the same system as MCP server
    const result = await invoke('cart_view', { clientId: 'default' });
    
    if (result.cart && result.cart.length > 0) {
      // Convert the MCP cart format to UI cart format
      const uiCartItems = [];
      let total = 0;
      
      for (const item of result.cart) {
        // We need to get the drink price from the database
        const db = (await import('../../../db/index')).default;
        const { drinks } = await import('../../../db/schema');
        const { eq, sql } = await import('drizzle-orm');
        
        try {
          // Get drink price using consolidated inventory approach
          const drinkResult = await db.execute(
            sql`
              SELECT 
                MIN(id) as id,
                name,
                MIN(price) as price
              FROM drinks 
              WHERE LOWER(name) = LOWER(${item.drink_name})
              AND is_active = true
              GROUP BY name
              LIMIT 1
            `
          );
          
          if (drinkResult.rows.length > 0) {
            const drink = drinkResult.rows[0];
            const itemTotal = (drink.price * item.quantity) / 100; // Convert cents to dollars
            
            uiCartItems.push({
              id: drink.id.toString(),
              name: item.drink_name,
              price: drink.price / 100, // Convert cents to dollars
              quantity: item.quantity
            });
            
            total += itemTotal;
          } else {
            // Add item without price as fallback - using a default price of $5.00
            uiCartItems.push({
              id: item.drink_name,
              name: item.drink_name,
              price: 5.00,
              quantity: item.quantity
            });
            total += 5.00 * item.quantity;
          }
        } catch (error) {
          console.error('Error getting drink price for', item.drink_name, error);
          // Add item without price as fallback - using a default price of $5.00
          uiCartItems.push({
            id: item.drink_name,
            name: item.drink_name,
            price: 5.00,
            quantity: item.quantity
          });
          total += 5.00 * item.quantity;
        }
      }
      
      return NextResponse.json({
        success: true,
        items: uiCartItems,
        total: total
      });
    } else {
      return NextResponse.json({
        success: true,
        items: [],
        total: 0
      });
    }
  } catch (error) {
    console.error('Error getting voice cart:', error);
    return NextResponse.json({ 
      success: false, 
      items: [], 
      total: 0 
    });
  }
}

// Endpoint to clear the voice cart (when UI completes an order)
export async function DELETE() {
  try {
    await invoke('cart_clear', { clientId: 'default' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing voice cart:', error);
    return NextResponse.json({ success: false });
  }
}
