/**
 * Direct Database Transaction Completion
 * Uses Drizzle ORM to force complete all pending transactions
 */

import db from './index';
import { orders, transactions } from './schema';
import { eq, or, isNull, sql } from 'drizzle-orm';
import type { NewTransaction } from './schema';

async function forceCompleteTransactions() {
  console.log('🔥 FORCE COMPLETING ALL PENDING TRANSACTIONS...\n');

  try {
    // Step 1: Find all pending orders
    console.log('📋 Step 1: Finding pending orders...');
    
    const pendingOrders = await db
      .select({
        id: orders.id,
        total: orders.total,
        payment_status: orders.payment_status,
        status: orders.status,
        created_at: orders.created_at
      })
      .from(orders)
      .where(
        or(
          eq(orders.payment_status, 'pending'),
          eq(orders.status, 'pending'),
          isNull(orders.payment_status)
        )
      );

    console.log(`   Found ${pendingOrders.length} pending orders`);

    if (pendingOrders.length === 0) {
      console.log('✅ No pending orders found!');
      return;
    }

    // Step 2: Process each order
    console.log('\n🔧 Step 2: Processing orders...');
    
    let ordersProcessed = 0;
    let transactionsCreated = 0;
    const errors: string[] = [];

    for (const order of pendingOrders) {
      try {
        console.log(`   Processing Order #${order.id} ($${(order.total / 100).toFixed(2)})...`);

        // Check if transaction exists
        const existingTransaction = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.order_id, order.id))
          .limit(1);

        if (existingTransaction.length === 0) {
          // Create transaction
          const transactionData: NewTransaction = {
            order_id: order.id,
            transaction_type: 'sale',
            amount: order.total,
            payment_method: 'cash',
            payment_processor: 'emergency_fix',
            processor_transaction_id: `EMERGENCY_${Date.now()}_${order.id}`,
            status: 'completed',
            net_amount: order.total,
            processed_at: sql`NOW()`,
            created_at: sql`NOW()`
          };

          const [newTransaction] = await db.insert(transactions).values(transactionData).returning();
          transactionsCreated++;
          console.log(`     ✅ Created transaction #${newTransaction.id}`);
        } else {
          console.log(`     ℹ️  Transaction already exists`);
        }

        // Update order status
        await db
          .update(orders)
          .set({
            payment_status: 'completed',
            status: 'completed',
            payment_method: 'cash',
            updated_at: sql`NOW()`
          })
          .where(eq(orders.id, order.id));

        ordersProcessed++;
        console.log(`     ✅ Order #${order.id} completed`);

      } catch (error) {
        const errorMsg = `Order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`     ❌ Error:`, error);
      }
    }

    // Step 3: Verification
    console.log('\n📊 Step 3: Final verification...');

    const remainingPending = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(
        or(
          eq(orders.payment_status, 'pending'),
          eq(orders.status, 'pending')
        )
      );

    const pendingCount = remainingPending[0].count;
    console.log(`   Remaining pending orders: ${pendingCount}`);

    // Get summary
    const statusSummary = await db.execute(sql`
      SELECT 
        payment_status,
        COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY payment_status
    `);

    console.log('\n📈 Order Status Summary:');
    statusSummary.rows.forEach((row: any) => {
      console.log(`   ${row.payment_status}: ${row.count} orders`);
    });

    // Report
    console.log('\n📊 COMPLETION REPORT');
    console.log('===================');
    console.log(`✅ Orders Processed: ${ordersProcessed}`);
    console.log(`🆕 Transactions Created: ${transactionsCreated}`);
    console.log(`❌ Errors: ${errors.length}`);
    console.log(`⏳ Remaining Pending: ${pendingCount}`);

    if (errors.length > 0) {
      console.log('\n🚨 Errors:');
      errors.forEach(error => console.log(`   • ${error}`));
    }

    if (pendingCount === 0) {
      console.log('\n🎉 ALL TRANSACTIONS COMPLETED SUCCESSFULLY!');
    } else {
      console.log('\n⚠️  Some transactions still pending - may need manual intervention');
    }

  } catch (error) {
    console.error('💥 Force completion failed:', error);
    throw error;
  }
}

// Alternative: Nuclear option - force complete everything
async function nuclearCompleteAll() {
  console.log('☢️  NUCLEAR COMPLETION: Completing ALL orders...\n');

  try {
    // Create missing transactions in bulk
    console.log('Step 1: Creating missing transactions...');
    
    await db.execute(sql`
      INSERT INTO transactions (
        order_id, transaction_type, amount, payment_method, 
        payment_processor, processor_transaction_id, status, 
        net_amount, processed_at, created_at
      )
      SELECT 
        o.id,
        'sale',
        o.total,
        'cash',
        'nuclear_completion',
        'NUCLEAR_' || EXTRACT(EPOCH FROM NOW()) || '_' || o.id,
        'completed',
        o.total,
        NOW(),
        NOW()
      FROM orders o
      LEFT JOIN transactions t ON t.order_id = o.id
      WHERE t.id IS NULL
      AND o.total > 0
    `);

    console.log('Step 2: Updating all orders to completed...');
    
    const updateResult = await db
      .update(orders)
      .set({
        payment_status: 'completed',
        status: 'completed',
        payment_method: 'cash',
        updated_at: sql`NOW()`
      })
      .where(
        or(
          eq(orders.payment_status, 'pending'),
          eq(orders.status, 'pending'),
          isNull(orders.payment_status)
        )
      );

    console.log('Step 3: Ensuring all transactions are completed...');
    
    await db
      .update(transactions)
      .set({
        status: 'completed',
        processed_at: sql`NOW()`
      })
      .where(eq(transactions.status, 'pending'));

    console.log('\n☢️  NUCLEAR COMPLETION FINISHED!');

    // Final check
    const finalSummary = await db.execute(sql`
      SELECT 
        payment_status,
        COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY payment_status
    `);

    console.log('\n📊 FINAL STATUS:');
    finalSummary.rows.forEach((row: any) => {
      console.log(`   ${row.payment_status}: ${row.count} orders`);
    });

  } catch (error) {
    console.error('💥 Nuclear completion failed:', error);
    throw error;
  }
}

// Run the appropriate function
async function main() {
  const args = process.argv.slice(2);
  const useNuclear = args.includes('--nuclear') || args.includes('--force');

  try {
    if (useNuclear) {
      await nuclearCompleteAll();
    } else {
      await forceCompleteTransactions();
    }
    
    console.log('\n🎯 Transaction completion finished!');
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Completion failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { forceCompleteTransactions, nuclearCompleteAll };