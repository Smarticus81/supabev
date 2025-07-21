import { NextRequest, NextResponse } from 'next/server';
import { voiceAgentService } from '../../../lib/voice-agent-service';

export async function GET() {
  try {
    // Get the raw cart data directly from voice agent service
    const { voiceAgentService } = await import('../../../lib/voice-agent-service');
    const rawCart = voiceAgentService.getCart();
    
    // Convert the voice cart format to UI cart format
    const uiCartItems = rawCart.map((item: any) => ({
      id: item.drink_id.toString(),
      name: item.name,
      price: item.price / 100, // Convert cents to dollars
      quantity: item.quantity
    }));

    const total = rawCart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) / 100;

    return NextResponse.json({
      success: true,
      items: uiCartItems,
      total: total
    });
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
    await voiceAgentService.clearCart();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing voice cart:', error);
    return NextResponse.json({ success: false });
  }
}
