/**
 * Manual Transaction Completion Script
 * Uses direct database connection to complete all pending transactions
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function manualCompleteTransactions() {
  console.log('🔥 MANUAL TRANSACTION COMPLETION');
  console.log('================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not found');
    console.log('Please ensure your .env file contains DATABASE_URL');
    process.exit(1);
  }

  try {
    // Create direct connection to Neon
    const sql = neon(process.env.DATABASE_URL);
    console.log('✅ Connected to database');

    console.log('\n📋 Step 1: Current transaction status...');
    
    // Get current status
    const currentStatus = await sql`
      SELECT 
        payment_status,
        COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY payment_status
    `;

    console.log('   Current Order Status:');
    currentStatus.forEach(row => {
      console.log(`     ${row.payment_status}: ${row.count} orders`);
    });

    const pendingCount = currentStatus.find(row => row.payment_status === 'pending')?.count || 0;
    console.log(`\n   🎯 Target: ${pendingCount} pending orders to complete`);

    if (pendingCount === 0) {
      console.log('\n🎉 No pending transactions found! All orders are already completed.');
      return { success: true, alreadyCompleted: true };
    }

    console.log('\n🔧 Step 2: Creating missing transactions...');
    
    // Create transactions for orders without them
    const createTransactions = await sql`
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
        'manual_completion',
        'MANUAL_' || EXTRACT(EPOCH FROM NOW()) || '_' || o.id,
        'completed',
        o.total,
        NOW(),
        NOW()
      FROM orders o
      LEFT JOIN transactions t ON t.order_id = o.id
      WHERE t.id IS NULL
      AND o.total > 0
      RETURNING order_id
    `;

    console.log(`   ✅ Created ${createTransactions.length} missing transactions`);

    console.log('\n📈 Step 3: Updating all orders to completed...');
    
    // Update all pending orders
    const updateOrders = await sql`
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
      RETURNING id
    `;
    
    console.log(`   ✅ Updated ${updateOrders.length} orders to completed`);

    console.log('\n⚡ Step 4: Finalizing all transactions...');
    
    // Ensure all transactions are completed
    const updateTransactions = await sql`
      UPDATE transactions 
      SET 
        status = 'completed',
        processed_at = COALESCE(processed_at, NOW())
      WHERE status = 'pending' OR status IS NULL
      RETURNING id
    `;
    
    console.log(`   ✅ Updated ${updateTransactions.length} transactions to completed`);

    console.log('\n📊 Step 5: Final verification...');
    
    // Get final status
    const finalStatus = await sql`
      SELECT 
        payment_status,
        COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY payment_status
    `;

    console.log('   FINAL Order Status:');
    finalStatus.forEach(row => {
      console.log(`     ${row.payment_status}: ${row.count} orders`);
    });

    // Verification checks
    const verificationChecks = await sql`
      SELECT 
        'Orders without transactions' as check_name,
        COUNT(*) as count
      FROM orders o
      LEFT JOIN transactions t ON t.order_id = o.id
      WHERE t.id IS NULL AND o.total > 0
      
      UNION ALL
      
      SELECT 
        'Pending orders' as check_name,
        COUNT(*) as count
      FROM orders
      WHERE payment_status = 'pending' OR status = 'pending'
      
      UNION ALL
      
      SELECT 
        'Pending transactions' as check_name,
        COUNT(*) as count
      FROM transactions
      WHERE status = 'pending'
      
      UNION ALL
      
      SELECT 
        'Total transactions' as check_name,
        COUNT(*) as count
      FROM transactions
    `;

    console.log('\n🔍 Verification Results:');
    verificationChecks.forEach(check => {
      const status = check.count === 0 || check.check_name === 'Total transactions' ? '✅' : '❌';
      console.log(`   ${status} ${check.check_name}: ${check.count}`);
    });

    const remainingPending = verificationChecks.find(c => c.check_name === 'Pending orders')?.count || 0;
    const totalTransactions = verificationChecks.find(c => c.check_name === 'Total transactions')?.count || 0;

    console.log('\n🎯 COMPLETION SUMMARY');
    console.log('====================');
    console.log(`📊 Total Transactions: ${totalTransactions}`);
    console.log(`🔧 Created: ${createTransactions.length} new transactions`);
    console.log(`📈 Updated: ${updateOrders.length} orders`);
    console.log(`⏳ Remaining Pending: ${remainingPending}`);
    
    if (remainingPending === 0) {
      console.log('\n🎉 MISSION ACCOMPLISHED!');
      console.log('🚀 ALL TRANSACTIONS SUCCESSFULLY COMPLETED!');
      console.log('✅ No pending orders remaining');
      console.log('✅ All orders have transaction records');
      console.log('✅ Payment statuses updated');
      console.log('\n💡 Your POS system is now fully operational!');
    } else {
      console.log('\n⚠️  Some transactions may still need attention');
      console.log('   Check for orders with zero amounts or data issues');
    }

    return {
      success: true,
      transactionsCreated: createTransactions.length,
      ordersUpdated: updateOrders.length,
      remainingPending: remainingPending,
      totalTransactions: totalTransactions
    };

  } catch (error) {
    console.error('\n💥 MANUAL COMPLETION FAILED:');
    console.error('Error:', error.message);
    
    if (error.message.includes('connect')) {
      console.error('\n🔌 Connection Issue:');
      console.error('- Check your DATABASE_URL in .env file');
      console.error('- Ensure your database is accessible');
      console.error('- Verify network connection');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the completion
if (require.main === module) {
  manualCompleteTransactions()
    .then(result => {
      if (result.success) {
        console.log('\n✨ Script completed successfully!');
        process.exit(0);
      } else {
        console.log('\n💥 Script failed. See error details above.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { manualCompleteTransactions };