/**
 * Fix Pending Transactions Script
 * Processes all pending transactions and creates missing transaction records
 */

const { performance } = require('perf_hooks');

class TransactionFixer {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.results = [];
  }

  async runFix(fixName, fixFunction) {
    console.log(`🔧 Running ${fixName}...`);
    const start = performance.now();
    
    try {
      const result = await fixFunction();
      const duration = performance.now() - start;
      
      console.log(`✅ ${fixName} completed (${duration.toFixed(2)}ms)`);
      this.results.push({
        fix: fixName,
        status: 'SUCCESS',
        duration: duration.toFixed(2),
        result
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ ${fixName} failed (${duration.toFixed(2)}ms):`, error.message);
      this.results.push({
        fix: fixName,
        status: 'FAILED',
        duration: duration.toFixed(2),
        error: error.message
      });
      
      throw error;
    }
  }

  async processPendingTransactions() {
    return this.runFix('Process Pending Transactions', async () => {
      const response = await fetch(`${this.baseUrl}/api/transactions/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_pending'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      
      console.log(`   📊 Processed: ${data.result.processed}`);
      console.log(`   ❌ Failed: ${data.result.failed}`);
      
      if (data.result.errors.length > 0) {
        console.log('   🚨 Errors:');
        data.result.errors.forEach(error => {
          console.log(`      • ${error}`);
        });
      }
      
      return data.result;
    });
  }

  async fixMissingTransactions() {
    return this.runFix('Fix Missing Transactions', async () => {
      const response = await fetch(`${this.baseUrl}/api/transactions/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fix_missing_transactions'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      
      console.log(`   🔧 Fixed: ${data.result.fixed}`);
      
      if (data.result.errors.length > 0) {
        console.log('   🚨 Errors:');
        data.result.errors.forEach(error => {
          console.log(`      • ${error}`);
        });
      }
      
      return data.result;
    });
  }

  async getTransactionSummary() {
    return this.runFix('Get Transaction Summary', async () => {
      const response = await fetch(`${this.baseUrl}/api/transactions/manage`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      
      const summary = data.result;
      
      console.log('   📈 Transaction Summary:');
      console.log(`      Pending Orders: ${summary.pendingOrders}`);
      console.log(`      Completed Orders: ${summary.completedOrders}`);
      console.log(`      Failed Orders: ${summary.failedOrders}`);
      console.log(`      Total Transactions: ${summary.totalTransactions}`);
      
      return summary;
    });
  }

  async testTransactionFlow() {
    return this.runFix('Test Transaction Flow', async () => {
      // Add a test drink to cart
      const addResponse = await fetch(`${this.baseUrl}/api/voice-advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'add_drink_to_cart',
          parameters: {
            drink_name: 'Test Beer',
            quantity: 1
          }
        })
      });

      const addData = await addResponse.json();
      if (!addData.success) {
        throw new Error(`Failed to add drink to cart: ${addData.error}`);
      }

      // Process the order
      const processResponse = await fetch(`${this.baseUrl}/api/voice-advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'process_order',
          parameters: {}
        })
      });

      const processData = await processResponse.json();
      if (!processData.success) {
        throw new Error(`Failed to process order: ${processData.error}`);
      }

      // Verify transaction was created
      if (!processData.result.transaction_id) {
        throw new Error('Order processed but no transaction ID returned');
      }

      console.log(`   ✅ Test order ${processData.result.order_id} processed with transaction ${processData.result.transaction_id}`);
      console.log(`   💰 Amount: $${processData.result.total}`);
      console.log(`   💳 Payment Method: ${processData.result.payment_method}`);

      return {
        orderId: processData.result.order_id,
        transactionId: processData.result.transaction_id,
        total: processData.result.total,
        paymentMethod: processData.result.payment_method
      };
    });
  }

  async generateReport() {
    console.log('\n📊 TRANSACTION FIX REPORT');
    console.log('=========================\n');
    
    const successful = this.results.filter(r => r.status === 'SUCCESS').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    
    console.log(`✅ Successful Fixes: ${successful}`);
    console.log(`❌ Failed Fixes: ${failed}`);
    console.log(`🎯 Success Rate: ${((successful / this.results.length) * 100).toFixed(1)}%\n`);
    
    console.log('📋 Detailed Results:');
    console.table(this.results.map(r => ({
      Fix: r.fix,
      Status: r.status,
      'Duration (ms)': r.duration,
      Error: r.error || 'N/A'
    })));
    
    if (failed > 0) {
      console.log('\n🚨 Failed Fixes:');
      this.results.filter(r => r.status === 'FAILED').forEach(r => {
        console.log(`   • ${r.fix}: ${r.error}`);
      });
    }
    
    console.log('\n💡 Recommendations:');
    if (failed === 0) {
      console.log('   🎉 All transaction fixes completed successfully!');
      console.log('   📈 Your transaction processing should now be working properly.');
    } else {
      console.log('   🔧 Some fixes failed - check error messages above.');
      console.log('   🔄 Try running the script again after fixing underlying issues.');
    }
  }
}

async function fixTransactions() {
  const fixer = new TransactionFixer();
  
  console.log('🚀 Starting Transaction Fix Process\n');
  
  try {
    // Get initial summary
    await fixer.getTransactionSummary();
    
    // Fix missing transactions first
    await fixer.fixMissingTransactions();
    
    // Process any remaining pending transactions
    await fixer.processPendingTransactions();
    
    // Test the transaction flow
    try {
      await fixer.testTransactionFlow();
    } catch (error) {
      console.warn('⚠️ Transaction flow test failed (this might be expected if no test data exists):', error.message);
    }
    
    // Get final summary
    await fixer.getTransactionSummary();
    
    await fixer.generateReport();
    
  } catch (error) {
    console.error('💥 Transaction fix process failed:', error);
    await fixer.generateReport();
  }
}

// Run the fix if this file is executed directly
if (require.main === module) {
  fixTransactions();
}

module.exports = { TransactionFixer };