import { NextResponse } from 'next/server';
import db from '../../../db/index';
import { orders } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { items } = await request.json();
    
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
    }

    // Calculate using the standardized pattern
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08; // Example 8% tax
    const total = subtotal + tax;

    // Test order creation
    const [testOrder] = await db.insert(orders).values({
      items: JSON.stringify(items),
      subtotal,
      tax_amount: tax,
      total,
      payment_method: 'test',
      payment_status: 'pending',
      status: 'test'
    }).returning();

    return NextResponse.json({
      success: true,
      calculation: {
        subtotal,
        tax,
        total,
        taxRate: '8%'
      },
      testOrder: {
        id: testOrder.id,
        subtotal: testOrder.subtotal,
        tax_amount: testOrder.tax_amount,
        total: testOrder.total
      },
      message: 'Tax calculation and order insertion working correctly'
    });

  } catch (error) {
    console.error('Tax test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Clean up test orders
    const result = await db.delete(orders).where(eq(orders.status, 'test'));
    
    return NextResponse.json({
      success: true,
      message: 'Test orders cleaned up'
    });
  } catch (error) {
    console.error('Error cleaning up test orders:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 