/**
 * Transaction Status Manager
 * Handles batch processing of pending transactions and status updates
 */

import db, { clearCache } from '../db/index';
import { orders, transactions } from '../db/schema';
import { eq, sql, and, isNull, or } from 'drizzle-orm';
import { paymentService } from './payment-service';
import { performanceMonitor, timed } from './performance-monitor';

export class TransactionManager {
  
  /**
   * Process all pending transactions
   */
  
  async processPendingTransactions(): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    try {
      // Get all orders with pending payment status
      const pendingOrders = await db
        .select({
          id: orders.id,
          total: orders.total,
          payment_status: orders.payment_status,
          status: orders.status,
          created_at: orders.created_at
        })
        .from(orders)
        .where(eq(orders.payment_status, 'pending'))
        .limit(50); // Process in batches

      console.log(`📋 Found ${pendingOrders.length} pending transactions to process`);

      for (const order of pendingOrders) {
        try {
          // Check if there's already a transaction for this order
          const existingTransaction = await db
            .select()
            .from(transactions)
            .where(eq(transactions.order_id, order.id))
            .limit(1);

          if (existingTransaction.length > 0) {
            // Transaction exists, just update order status
            await db
              .update(orders)
              .set({
                payment_status: 'completed',
                status: 'completed',
                updated_at: sql`NOW()`
              })
              .where(eq(orders.id, order.id));
            
            processed++;
            continue;
          }

          // Auto-process payment for orders without transactions
          const paymentResult = await paymentService.autoProcessPayment(order.id, 'cash');
          
          if (paymentResult.success) {
            processed++;
            console.log(`✅ Processed payment for order ${order.id}`);
          } else {
            failed++;
            errors.push(`Order ${order.id}: ${paymentResult.message}`);
            console.error(`❌ Failed to process payment for order ${order.id}:`, paymentResult.message);
          }

        } catch (error) {
          failed++;
          const errorMsg = `Order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ Error processing order ${order.id}:`, error);
        }
      }

      // Clear relevant caches
      clearCache();

      return { processed, failed, errors };

    } catch (error) {
      console.error('❌ Error in processPendingTransactions:', error);
      return {
        processed,
        failed: failed + 1,
        errors: [...errors, `System error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Fix orders that are completed but missing transactions
   */
  
  async fixMissingTransactions(): Promise<{
    fixed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let fixed = 0;

    try {
      // Find completed orders without transactions
      const ordersWithoutTransactions = await db
        .select({
          id: orders.id,
          total: orders.total,
          payment_status: orders.payment_status,
          status: orders.status
        })
        .from(orders)
        .leftJoin(transactions, eq(transactions.order_id, orders.id))
        .where(
          and(
            eq(orders.status, 'completed'),
            isNull(transactions.id)
          )
        )
        .limit(100);

      console.log(`🔧 Found ${ordersWithoutTransactions.length} completed orders missing transactions`);

      for (const order of ordersWithoutTransactions) {
        try {
          const paymentResult = await paymentService.autoProcessPayment(order.id, 'cash');
          
          if (paymentResult.success) {
            fixed++;
            console.log(`✅ Created transaction for order ${order.id}`);
          } else {
            errors.push(`Order ${order.id}: ${paymentResult.message}`);
          }

        } catch (error) {
          const errorMsg = `Order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ Error creating transaction for order ${order.id}:`, error);
        }
      }

      return { fixed, errors };

    } catch (error) {
      console.error('❌ Error in fixMissingTransactions:', error);
      return {
        fixed,
        errors: [...errors, `System error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get transaction status summary
   */
  
  async getTransactionSummary(): Promise<{
    pendingOrders: number;
    completedOrders: number;
    failedOrders: number;
    totalTransactions: number;
    recentActivity: any[];
  }> {
    try {
      // Count orders by status
      const pendingCount = await db
        .select({ count: sql`COUNT(*)` })
        .from(orders)
        .where(eq(orders.payment_status, 'pending'));

      const completedCount = await db
        .select({ count: sql`COUNT(*)` })
        .from(orders)
        .where(eq(orders.payment_status, 'completed'));

      const failedCount = await db
        .select({ count: sql`COUNT(*)` })
        .from(orders)
        .where(eq(orders.payment_status, 'failed'));

      // Count total transactions
      const transactionCount = await db
        .select({ count: sql`COUNT(*)` })
        .from(transactions);

      // Get recent activity
      const recentActivity = await db
        .select({
          orderId: orders.id,
          orderTotal: orders.total,
          transactionId: transactions.id,
          transactionType: transactions.transaction_type,
          transactionAmount: transactions.amount,
          paymentMethod: transactions.payment_method,
          status: transactions.status,
          createdAt: transactions.created_at
        })
        .from(transactions)
        .innerJoin(orders, eq(orders.id, transactions.order_id))
        .orderBy(sql`${transactions.created_at} DESC`)
        .limit(10);

      return {
        pendingOrders: parseInt(pendingCount[0].count as string),
        completedOrders: parseInt(completedCount[0].count as string),
        failedOrders: parseInt(failedCount[0].count as string),
        totalTransactions: parseInt(transactionCount[0].count as string),
        recentActivity: recentActivity.map(activity => ({
          orderId: activity.orderId,
          orderTotal: activity.orderTotal / 100,
          transactionId: activity.transactionId,
          type: activity.transactionType,
          amount: activity.transactionAmount / 100,
          paymentMethod: activity.paymentMethod,
          status: activity.status,
          createdAt: activity.createdAt
        }))
      };

    } catch (error) {
      console.error('❌ Error getting transaction summary:', error);
      throw error;
    }
  }

  /**
   * Update transaction status manually
   */
  
  async updateTransactionStatus(
    transactionId: number, 
    newStatus: 'pending' | 'completed' | 'failed' | 'cancelled'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const [updatedTransaction] = await db
        .update(transactions)
        .set({
          status: newStatus,
          processed_at: newStatus === 'completed' ? sql`NOW()` : null
        })
        .where(eq(transactions.id, transactionId))
        .returning();

      if (!updatedTransaction) {
        return {
          success: false,
          message: `Transaction ${transactionId} not found`
        };
      }

      // Update related order status if needed
      if (updatedTransaction.order_id) {
        let orderPaymentStatus = newStatus === 'completed' ? 'completed' : 
                               newStatus === 'failed' ? 'failed' : 'pending';
        
        let orderStatus = newStatus === 'completed' ? 'completed' :
                         newStatus === 'failed' ? 'cancelled' : 'processing';

        await db
          .update(orders)
          .set({
            payment_status: orderPaymentStatus,
            status: orderStatus,
            updated_at: sql`NOW()`
          })
          .where(eq(orders.id, updatedTransaction.order_id));
      }

      return {
        success: true,
        message: `Transaction ${transactionId} status updated to ${newStatus}`
      };

    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      return {
        success: false,
        message: 'Failed to update transaction status'
      };
    }
  }
}

export const transactionManager = new TransactionManager();