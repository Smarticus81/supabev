import { NextRequest, NextResponse } from 'next/server';
import { simpleInventoryService } from '../../../../lib/simple-inventory-service';
import db from '../../../../db/index';
import { drinks } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const drinkId = searchParams.get('drinkId');

    if (drinkId) {
      const result = await simpleInventoryService.getDrinkInventory(parseInt(drinkId));
      return NextResponse.json(result);
    }

    // Get all drinks with simple inventory information
    const allDrinks = await db.select().from(drinks).where(eq(drinks.is_active, true));
    const inventoryStatus = allDrinks.map(drink => ({
      id: drink.id,
      name: drink.name,
      category: drink.category,
      inventory: drink.inventory,
      price: drink.price / 100,
      status: drink.inventory > 10 ? 'good' : 
             drink.inventory > 0 ? 'low' : 'out_of_stock'
    }));

    return NextResponse.json({
      success: true,
      inventory: inventoryStatus
    });

  } catch (error) {
    console.error('Real-time inventory API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get real-time inventory status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'check_availability':
        const availability = await simpleInventoryService.checkInventoryAvailability(params.items);
        return NextResponse.json({
          success: true,
          result: availability
        });

      case 'update_inventory':
        const updateResult = await simpleInventoryService.updateDrinkInventory(
          params.drinkId,
          params.quantityToDeduct
        );
        return NextResponse.json(updateResult);

      case 'process_order_inventory':
        const orderResult = await simpleInventoryService.updateOrderInventory(
          params.orderId,
          params.items
        );
        return NextResponse.json(orderResult);

      case 'restore_inventory':
        const restoreResult = await simpleInventoryService.restoreInventory(params.items);
        return NextResponse.json(restoreResult);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Real-time inventory action error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process inventory action',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}