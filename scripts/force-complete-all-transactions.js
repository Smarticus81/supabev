/**
 * Force Complete All Transactions - JavaScript Version
 * Immediately completes all pending transactions using raw SQL
 */

async function forceCompleteAllTransactions() {
  console.log('🔥 FORCE COMPLETING ALL TRANSACTIONS - JavaScript Version\n');

  try {
    // Import the database connection
    const dbModule = require('../db/index.ts');
    const db = dbModule.default;

    console.log('📋 Step 1: Analyzing current transaction status...');
    
    // Get current status
    const currentStatus = await db.execute(`
      SELECT 
        payment_status,
        COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY payment_status
    `);

    console.log('   Current Order Status:');
    currentStatus.rows.forEach(row => {
      console.log(`     ${row.payment_status}: ${row.count} orders`);
    });

    console.log('\n🔧 Step 2: Creating missing transactions for all orders...');
    
    // Create transactions for orders that don't have them
    const createTransactionsQuery = `
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
        'force_complete',
        'FORCE_' || EXTRACT(EPOCH FROM NOW()) || '_' || o.id,
        'completed',
        o.total,
        NOW(),
        NOW()
      FROM orders o
      LEFT JOIN transactions t ON t.order_id = o.id
      WHERE t.id IS NULL
      AND o.total > 0
    `;
    
    const transactionsResult = await db.execute(createTransactionsQuery);
    console.log(`   ✅ Created ${transactionsResult.rowCount || 0} missing transactions`);

    console.log('\n📈 Step 3: Updating ALL orders to completed status...');
    
    // Force complete all orders
    const updateOrdersQuery = `
      UPDATE orders 
      SET 
        payment_status = 'completed',
        status = 'completed',
        payment_method = COALESCE(payment_method, 'cash'),
        updated_at = NOW()
      WHERE (
        payment_status = 'pending' 
        OR status = 'pending'
        OR payment_status IS NULL
        OR status IS NULL
      )
      AND total > 0
    `;
    
    const ordersResult = await db.execute(updateOrdersQuery);
    console.log(`   ✅ Updated ${ordersResult.rowCount || 0} orders to completed`);

    console.log('\n⚡ Step 4: Ensuring all transactions are completed...');
    
    // Update any pending transactions
    const updateTransactionsQuery = `
      UPDATE transactions 
      SET 
        status = 'completed',
        processed_at = COALESCE(processed_at, NOW())
      WHERE status = 'pending' OR status IS NULL
    `;
    
    const txnUpdateResult = await db.execute(updateTransactionsQuery);
    console.log(`   ✅ Updated ${txnUpdateResult.rowCount || 0} transactions to completed`);

    console.log('\n📊 Step 5: Final verification...');
    
    // Get final status
    const finalStatus = await db.execute(`
      SELECT 
        payment_status,
        COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY payment_status
    `);

    console.log('   FINAL Order Status:');
    finalStatus.rows.forEach(row => {
      console.log(`     ${row.payment_status}: ${row.count} orders`);
    });

    // Count total transactions
    const transactionCount = await db.execute(`
      SELECT COUNT(*) as count FROM transactions
    `);
    
    console.log(`   Total Transactions: ${transactionCount.rows[0].count}`);

    // Check for any remaining pending
    const remainingPending = await db.execute(`
      SELECT COUNT(*) as count 
      FROM orders 
      WHERE payment_status = 'pending' OR status = 'pending'
    `);

    const pendingCount = remainingPending.rows[0].count;

    console.log('\n🎯 COMPLETION SUMMARY');
    console.log('====================');
    console.log(`⏳ Remaining Pending: ${pendingCount}`);
    console.log(`📊 Total Transactions: ${transactionCount.rows[0].count}`);
    
    if (pendingCount === 0) {
      console.log('\n🎉 SUCCESS! ALL TRANSACTIONS COMPLETED!');
      console.log('✅ No more pending transactions');
      console.log('✅ All orders have proper transaction records');
      console.log('✅ Payment statuses updated');
    } else {
      console.log('\n⚠️  Some transactions may still be pending');
      console.log('   This could be due to orders with zero amounts or data issues');
    }

    return {
      success: true,
      pendingRemaining: parseInt(pendingCount),
      totalTransactions: parseInt(transactionCount.rows[0].count)
    };

  } catch (error) {
    console.error('💥 FORCE COMPLETION FAILED:', error);
    console.error('Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Additional helper: Verify completion
async function verifyCompletion() {
  console.log('\n🔍 VERIFICATION CHECK');
  console.log('===================');

  try {
    const dbModule = require('../db/index.ts');
    const db = dbModule.default;

    // Detailed verification
    const checks = [
      {
        name: 'Orders without transactions',
        query: `
          SELECT COUNT(*) as count
          FROM orders o
          LEFT JOIN transactions t ON t.order_id = o.id
          WHERE t.id IS NULL AND o.total > 0
        `
      },
      {
        name: 'Pending orders',
        query: `
          SELECT COUNT(*) as count
          FROM orders
          WHERE payment_status = 'pending' OR status = 'pending'
        `
      },
      {
        name: 'Pending transactions',
        query: `
          SELECT COUNT(*) as count
          FROM transactions
          WHERE status = 'pending'
        `
      }
    ];

    for (const check of checks) {
      const result = await db.execute(check.query);
      const count = result.rows[0].count;
      const status = count === 0 ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${count}`);
    }

    console.log('\n📈 Status Distribution:');
    const statusDist = await db.execute(`
      SELECT payment_status, COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY count DESC
    `);

    statusDist.rows.forEach(row => {
      console.log(`   ${row.payment_status}: ${row.count} orders`);
    });

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

async function main() {
  console.log('🚀 EMERGENCY TRANSACTION COMPLETION');
  console.log('===================================\n');
  
  const result = await forceCompleteAllTransactions();
  
  if (result.success) {
    await verifyCompletion();
    
    if (result.pendingRemaining === 0) {
      console.log('\n🎉 MISSION ACCOMPLISHED!');
      console.log('All transactions have been successfully completed.');
    } else {
      console.log('\n⚠️  Some work remaining, but major issues resolved.');
    }
  } else {
    console.log('\n💥 MISSION FAILED');
    console.log('Could not complete all transactions. Check error details above.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed completely:', error);
    process.exit(1);
  });
}

module.exports = { forceCompleteAllTransactions, verifyCompletion };