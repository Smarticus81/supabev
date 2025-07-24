import { NextRequest, NextResponse } from 'next/server';
import { transactionManager } from '../../../../lib/transaction-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    console.log('🔄 Transaction management request:', { action, params });

    switch (action) {
      case 'process_pending':
        const processResult = await transactionManager.processPendingTransactions();
        return NextResponse.json({
          success: true,
          message: `Processed ${processResult.processed} transactions, ${processResult.failed} failed`,
          result: processResult
        });

      case 'fix_missing_transactions':
        const fixResult = await transactionManager.fixMissingTransactions();
        return NextResponse.json({
          success: true,
          message: `Fixed ${fixResult.fixed} missing transactions`,
          result: fixResult
        });

      case 'update_status':
        const updateResult = await transactionManager.updateTransactionStatus(
          params.transactionId,
          params.newStatus
        );
        return NextResponse.json(updateResult);

      case 'get_summary':
        const summary = await transactionManager.getTransactionSummary();
        return NextResponse.json({
          success: true,
          result: summary
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Transaction management error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Transaction management failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const summary = await transactionManager.getTransactionSummary();
    return NextResponse.json({
      success: true,
      result: summary
    });

  } catch (error) {
    console.error('❌ Transaction summary error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get transaction summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}