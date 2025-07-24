import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '../../../lib/payment-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    console.log('🏦 Payment API request:', { action, params });

    switch (action) {
      case 'process_payment':
        const paymentResult = await paymentService.processPayment({
          orderId: params.orderId,
          amount: params.amount,
          paymentMethod: params.paymentMethod,
          paymentProcessor: params.paymentProcessor,
          customerInfo: params.customerInfo,
          staffId: params.staffId
        });
        return NextResponse.json(paymentResult);

      case 'process_refund':
        const refundResult = await paymentService.processRefund(
          params.transactionId,
          params.refundAmount,
          params.reason
        );
        return NextResponse.json(refundResult);

      case 'auto_process_payment':
        const autoResult = await paymentService.autoProcessPayment(
          params.orderId,
          params.paymentMethod
        );
        return NextResponse.json(autoResult);

      case 'get_transaction_history':
        const historyResult = await paymentService.getTransactionHistory(params.orderId);
        return NextResponse.json(historyResult);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Payment API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Payment processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const historyResult = await paymentService.getTransactionHistory(parseInt(orderId));
    return NextResponse.json(historyResult);

  } catch (error) {
    console.error('❌ Payment history API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get payment history',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}