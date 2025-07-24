/**
 * Simple Transaction Completion Script
 * Adapts to existing database schema and completes all pending transactions
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function simpleCompleteTransactions() {
  console.log('🎯 SIMPLE TRANSACTION COMPLETION');
  console.log('================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found. Please check your .env file.');
    process.exit(1);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    console.log('✅ Database connected');

    // Step 1: Check current status
    console.log('\n📊 Current Status:');
    const currentStatus = await sql`
      SELECT payment_status, COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY payment_status
    `;
    
    currentStatus.forEach(row => {
      console.log(`   ${row.payment_status}: ${row.count} orders`);
    });

    const pendingCount = currentStatus.find(row => row.payment_status === 'pending')?.count || 0;
    
    if (pendingCount === 0) {
      console.log('\n🎉 No pending transactions! All orders are already completed.');
      return;
    }

    console.log(`\n🎯 Processing ${pendingCount} pending orders...`);

    // Step 2: First, let's see what columns exist in transactions table
    console.log('\n🔍 Checking database schema...');
    try {
      const schemaCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transactions'
        ORDER BY column_name
      `;
      
      const columns = schemaCheck.map(row => row.column_name);
      console.log('   Transactions table columns:', columns.join(', '));
      
      // Check if we have the basic required columns
      const hasPaymentProcessor = columns.includes('payment_processor');
      const hasProcessorTransactionId = columns.includes('processor_transaction_id');
      
      console.log(`   Has payment_processor: ${hasPaymentProcessor}`);
      console.log(`   Has processor_transaction_id: ${hasProcessorTransactionId}`);

      // Step 3: Create simple transactions
      console.log('\n🔧 Creating transactions for orders without them...');
      
      if (hasPaymentProcessor && hasProcessorTransactionId) {
        // Full schema approach
        const createdTransactions = await sql`
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
            'simple_completion',
            'SIMPLE_' || EXTRACT(EPOCH FROM NOW()) || '_' || o.id,
            'completed',
            o.total,
            NOW(),
            NOW()
          FROM orders o
          LEFT JOIN transactions t ON t.order_id = o.id
          WHERE t.id IS NULL AND o.total > 0
          RETURNING order_id
        `;
        console.log(`   ✅ Created ${createdTransactions.length} transactions (full schema)`);
      } else {
        // Minimal schema approach
        const createdTransactions = await sql`
          INSERT INTO transactions (
            order_id, transaction_type, amount, payment_method, 
            status, net_amount, processed_at, created_at
          )
          SELECT 
            o.id,
            'sale',
            o.total,
            'cash',
            'completed',
            o.total,
            NOW(),
            NOW()
          FROM orders o
          LEFT JOIN transactions t ON t.order_id = o.id
          WHERE t.id IS NULL AND o.total > 0
          RETURNING order_id
        `;
        console.log(`   ✅ Created ${createdTransactions.length} transactions (minimal schema)`);
      }

    } catch (schemaError) {
      console.log('   ⚠️  Could not check schema, using minimal approach...');
      
      // Fallback: minimal transaction creation
      const createdTransactions = await sql`
        INSERT INTO transactions (order_id, transaction_type, amount, payment_method, status)
        SELECT o.id, 'sale', o.total, 'cash', 'completed'
        FROM orders o
        LEFT JOIN transactions t ON t.order_id = o.id
        WHERE t.id IS NULL AND o.total > 0
        RETURNING order_id
      `;
      console.log(`   ✅ Created ${createdTransactions.length} transactions (fallback)`);
    }

    // Step 4: Update all pending orders to completed
    console.log('\n📈 Updating pending orders to completed...');
    
    const updatedOrders = await sql`
      UPDATE orders 
      SET 
        payment_status = 'completed',
        status = 'completed',
        payment_method = 'cash',
        updated_at = NOW()
      WHERE payment_status = 'pending'
      RETURNING id
    `;
    
    console.log(`   ✅ Updated ${updatedOrders.length} orders to completed`);

    // Step 5: Ensure all transactions are completed
    console.log('\n⚡ Finalizing transaction statuses...');
    
    const updatedTransactions = await sql`
      UPDATE transactions 
      SET status = 'completed'
      WHERE status = 'pending'
      RETURNING id
    `;
    
    console.log(`   ✅ Updated ${updatedTransactions.length} transactions to completed`);

    // Step 6: Final verification
    console.log('\n📊 Final Status:');
    const finalStatus = await sql`
      SELECT payment_status, COUNT(*) as count
      FROM orders
      GROUP BY payment_status
      ORDER BY payment_status
    `;
    
    finalStatus.forEach(row => {
      console.log(`   ${row.payment_status}: ${row.count} orders`);
    });

    // Count remaining pending
    const remainingPending = finalStatus.find(row => row.payment_status === 'pending')?.count || 0;
    
    console.log('\n🎯 RESULTS:');
    console.log(`   📊 Orders updated: ${updatedOrders.length}`);
    console.log(`   ⚡ Transactions updated: ${updatedTransactions.length}`);
    console.log(`   ⏳ Remaining pending: ${remainingPending}`);
    
    if (remainingPending === 0) {
      console.log('\n🎉 SUCCESS! ALL TRANSACTIONS COMPLETED!');
      console.log('🚀 Your POS system is ready to go!');
    } else {
      console.log('\n⚠️  Some transactions may need manual attention');
    }

  } catch (error) {
    console.error('\n💥 ERROR:', error.message);
    console.error('\nPlease check:');
    console.error('- DATABASE_URL is correct in .env file');
    console.error('- Database is accessible');
    console.error('- Tables exist in database');
  }
}

if (require.main === module) {
  simpleCompleteTransactions();
}

module.exports = { simpleCompleteTransactions };