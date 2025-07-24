/**
 * Payment Processing Service
 * Handles transaction creation, payment processing, and status updates
 */

import db, { clearCache } from '../db/index';
import { orders, transactions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import type { NewTransaction } from '../db/schema';
import { performanceMonitor, timed } from './performance-monitor';

export interface PaymentRequest {
  orderId: number;
  amount: number; // in cents
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'mobile_payment' | 'gift_card';
  paymentProcessor?: string;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  staffId?: number;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: number;
  processorTransactionId?: string;
  message: string;
  errorCode?: string;
}

export class PaymentService {
  
  /**
   * Process a payment for an order
   */
  
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    try {
      // Get the order first
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, paymentRequest.orderId))
        .limit(1);

      if (!order) {
        return {
          success: false,
          message: `Order ${paymentRequest.orderId} not found`
        };
      }

      // Verify amount matches order total
      if (paymentRequest.amount !== order.total) {
        return {
          success: false,
          message: `Payment amount ${paymentRequest.amount} does not match order total ${order.total}`,
          errorCode: 'AMOUNT_MISMATCH'
        };
      }

      // For now, simulate payment processing based on method
      const paymentResult = await this.simulatePaymentProcessing(paymentRequest);
      
      if (!paymentResult.success) {
        return paymentResult;
      }

      // Create transaction record
      const transactionData: NewTransaction = {
        order_id: paymentRequest.orderId,
        transaction_type: 'sale',
        amount: paymentRequest.amount,
        payment_method: paymentRequest.paymentMethod,
        payment_processor: paymentRequest.paymentProcessor || this.getDefaultProcessor(paymentRequest.paymentMethod),
        processor_transaction_id: paymentResult.processorTransactionId,
        status: 'completed',
        net_amount: paymentRequest.amount, // Simplified - no fees for now
        processed_at: sql`NOW()`,
        created_at: sql`NOW()`
      };

      const [newTransaction] = await db.insert(transactions).values(transactionData).returning();

      // Update order status
      await db
        .update(orders)
        .set({
          payment_status: 'completed',
          status: 'completed',
          payment_method: paymentRequest.paymentMethod,
          updated_at: sql`NOW()`
        })
        .where(eq(orders.id, paymentRequest.orderId));

      // Clear relevant caches
      clearCache(`order:${paymentRequest.orderId}`);

      return {
        success: true,
        transactionId: newTransaction.id,
        processorTransactionId: paymentResult.processorTransactionId,
        message: `Payment of $${(paymentRequest.amount / 100).toFixed(2)} processed successfully`
      };

    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        message: 'Payment processing failed due to system error',
        errorCode: 'SYSTEM_ERROR'
      };
    }
  }

  /**
   * Simulate payment processing for different methods
   */
  private async simulatePaymentProcessing(paymentRequest: PaymentRequest): Promise<{
    success: boolean;
    processorTransactionId?: string;
    message?: string;
    errorCode?: string;
  }> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const { paymentMethod, amount } = paymentRequest;

    // Generate a mock transaction ID
    const mockTransactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    switch (paymentMethod) {
      case 'cash':
        // Cash always succeeds (assuming correct change given)
        return {
          success: true,
          processorTransactionId: mockTransactionId
        };

      case 'credit_card':
      case 'debit_card':
        // Credit/debit cards always succeed for demo purposes
        return {
          success: true,
          processorTransactionId: mockTransactionId
        };

      case 'mobile_payment':
        // Mobile payments usually succeed (2% failure rate)
        if (Math.random() < 0.02) {
          return {
            success: false,
            message: 'Mobile payment failed - connection timeout',
            errorCode: 'CONNECTION_TIMEOUT'
          };
        }
        return {
          success: true,
          processorTransactionId: mockTransactionId
        };

      case 'gift_card':
        // Simulate gift card balance check (10% insufficient funds)
        if (Math.random() < 0.1) {
          return {
            success: false,
            message: 'Insufficient gift card balance',
            errorCode: 'INSUFFICIENT_BALANCE'
          };
        }
        return {
          success: true,
          processorTransactionId: mockTransactionId
        };

      default:
        return {
          success: false,
          message: 'Unsupported payment method',
          errorCode: 'UNSUPPORTED_METHOD'
        };
    }
  }

  /**
   * Get default payment processor for a payment method
   */
  private getDefaultProcessor(paymentMethod: string): string {
    switch (paymentMethod) {
      case 'cash':
        return 'cash_register';
      case 'credit_card':
      case 'debit_card':
        return 'square'; // Could be 'stripe', 'square', etc.
      case 'mobile_payment':
        return 'apple_pay'; // Could be 'apple_pay', 'google_pay', etc.
      case 'gift_card':
        return 'gift_card_system';
      default:
        return 'unknown';
    }
  }

  /**
   * Process refund for a transaction
   */
  
  async processRefund(transactionId: number, refundAmount?: number, reason?: string): Promise<PaymentResult> {
    try {
      // Get the original transaction
      const [originalTransaction] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .limit(1);

      if (!originalTransaction) {
        return {
          success: false,
          message: `Transaction ${transactionId} not found`
        };
      }

      if (originalTransaction.status !== 'completed') {
        return {
          success: false,
          message: 'Can only refund completed transactions',
          errorCode: 'INVALID_STATUS'
        };
      }

      const refundAmountCents = refundAmount || originalTransaction.amount;
      
      // Validate refund amount
      if (refundAmountCents > originalTransaction.amount) {
        return {
          success: false,
          message: 'Refund amount cannot exceed original transaction amount',
          errorCode: 'INVALID_AMOUNT'
        };
      }

      // Create refund transaction
      const refundTransactionData: NewTransaction = {
        order_id: originalTransaction.order_id,
        transaction_type: 'refund',
        amount: -refundAmountCents, // Negative amount for refund
        payment_method: originalTransaction.payment_method,
        payment_processor: originalTransaction.payment_processor,
        processor_transaction_id: `REFUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'completed',
        net_amount: -refundAmountCents,
        processed_at: sql`NOW()`,
        created_at: sql`NOW()`
      };

      const [refundTransaction] = await db.insert(transactions).values(refundTransactionData).returning();

      // Update original order if full refund
      if (refundAmountCents === originalTransaction.amount && originalTransaction.order_id) {
        await db
          .update(orders)
          .set({
            payment_status: 'refunded',
            status: 'cancelled',
            updated_at: sql`NOW()`
          })
          .where(eq(orders.id, originalTransaction.order_id));
      }

      return {
        success: true,
        transactionId: refundTransaction.id,
        message: `Refund of $${(refundAmountCents / 100).toFixed(2)} processed successfully`
      };

    } catch (error) {
      console.error('Refund processing error:', error);
      return {
        success: false,
        message: 'Refund processing failed due to system error',
        errorCode: 'SYSTEM_ERROR'
      };
    }
  }

  /**
   * Get transaction history for an order
   */
  
  async getTransactionHistory(orderId: number): Promise<{
    success: boolean;
    transactions?: any[];
    message?: string;
  }> {
    try {
      const orderTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.order_id, orderId))
        .orderBy(transactions.created_at);

      return {
        success: true,
        transactions: orderTransactions.map(txn => ({
          id: txn.id,
          type: txn.transaction_type,
          amount: txn.amount / 100, // Convert to dollars
          paymentMethod: txn.payment_method,
          processor: txn.payment_processor,
          processorTransactionId: txn.processor_transaction_id,
          status: txn.status,
          processedAt: txn.processed_at,
          createdAt: txn.created_at
        }))
      };

    } catch (error) {
      console.error('Error getting transaction history:', error);
      return {
        success: false,
        message: 'Failed to get transaction history'
      };
    }
  }

  /**
   * Auto-process payment for voice orders (defaults to credit card)
   */
  
  async autoProcessPayment(orderId: number, paymentMethod: string = 'credit_card'): Promise<PaymentResult> {
    try {
      // Get order total
      const [order] = await db
        .select({ total: orders.total })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        return {
          success: false,
          message: `Order ${orderId} not found`
        };
      }

      const paymentRequest: PaymentRequest = {
        orderId,
        amount: order.total,
        paymentMethod: paymentMethod as any,
        paymentProcessor: this.getDefaultProcessor(paymentMethod)
      };

      return await this.processPayment(paymentRequest);

    } catch (error) {
      console.error('Auto payment processing error:', error);
      return {
        success: false,
        message: 'Auto payment processing failed',
        errorCode: 'SYSTEM_ERROR'
      };
    }
  }
}

export const paymentService = new PaymentService();