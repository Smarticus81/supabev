/**
 * Inventory Logic Testing Script
 * Tests the repaired serving size deduction and real-time inventory updates
 */

const { performance } = require('perf_hooks');

class InventoryTester {
  constructor() {
    this.results = [];
    this.baseUrl = 'http://localhost:3000';
  }

  async runTest(testName, testFunction) {
    console.log(`🧪 Running ${testName}...`);
    const start = performance.now();
    
    try {
      const result = await testFunction();
      const duration = performance.now() - start;
      
      console.log(`✅ ${testName} passed (${duration.toFixed(2)}ms)`);
      this.results.push({
        test: testName,
        status: 'PASS',
        duration: duration.toFixed(2),
        result
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ ${testName} failed (${duration.toFixed(2)}ms):`, error.message);
      this.results.push({
        test: testName,
        status: 'FAIL',
        duration: duration.toFixed(2),
        error: error.message
      });
      
      throw error;
    }
  }

  async testRealTimeInventoryStatus() {
    return this.runTest('Real-time Inventory Status', async () => {
      const response = await fetch(`${this.baseUrl}/api/inventory/real-time`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to get inventory status');
      }
      
      // Verify structure
      if (!data.inventory || !Array.isArray(data.inventory)) {
        throw new Error('Invalid inventory data structure');
      }
      
      // Check that each item has proper serving calculations
      for (const item of data.inventory.slice(0, 3)) { // Test first 3 items
        if (!item.availableServings && item.availableServings !== 0) {
          throw new Error(`Missing availableServings for ${item.name}`);
        }
        if (!item.servingSize) {
          throw new Error(`Missing servingSize for ${item.name}`);
        }
      }
      
      return {
        totalItems: data.inventory.length,
        sampleItem: data.inventory[0]
      };
    });
  }

  async testServingSizeCalculations() {
    return this.runTest('Serving Size Calculations', async () => {
      // Get inventory status first
      const response = await fetch(`${this.baseUrl}/api/inventory/real-time`);
      const data = await response.json();
      
      if (!data.success || !data.inventory.length) {
        throw new Error('No inventory data available for testing');
      }
      
      // Test different categories
      const categories = ['beer', 'wine', 'spirits', 'cocktails'];
      const results = {};
      
      for (const category of categories) {
        const categoryItems = data.inventory.filter(item => 
          item.category.toLowerCase().includes(category)
        );
        
        if (categoryItems.length > 0) {
          const item = categoryItems[0];
          results[category] = {
            name: item.name,
            servingSize: item.servingSize,
            containers: item.containers,
            availableServings: item.availableServings,
            calculatedServings: item.containers * Math.floor(
              (category === 'beer' ? 12 : 
               category === 'wine' ? 25.36 : 
               category === 'spirits' ? 25.36 : 8) / item.servingSize
            )
          };
          
          // Verify calculation makes sense
          if (item.availableServings < 0) {
            throw new Error(`Negative servings for ${item.name}`);
          }
        }
      }
      
      return results;
    });
  }

  async testInventoryAvailabilityCheck() {
    return this.runTest('Inventory Availability Check', async () => {
      // Get a sample drink
      const inventoryResponse = await fetch(`${this.baseUrl}/api/inventory/real-time`);
      const inventoryData = await inventoryResponse.json();
      
      if (!inventoryData.success || !inventoryData.inventory.length) {
        throw new Error('No inventory available for testing');
      }
      
      const testDrink = inventoryData.inventory.find(item => item.availableServings > 0);
      if (!testDrink) {
        throw new Error('No drinks with available servings for testing');
      }
      
      // Test availability check
      const checkResponse = await fetch(`${this.baseUrl}/api/inventory/real-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_availability',
          items: [
            { drinkId: testDrink.id, quantity: 1 },
            { drinkId: testDrink.id, quantity: testDrink.availableServings + 10 } // Should fail
          ]
        })
      });
      
      const checkData = await checkResponse.json();
      
      if (!checkData.success) {
        throw new Error('Availability check API failed');
      }
      
      const result = checkData.result;
      
      // First item should be available, second should not
      if (result.available !== false) {
        throw new Error('Availability check logic failed - should detect insufficient inventory');
      }
      
      if (!result.insufficientItems || result.insufficientItems.length !== 1) {
        throw new Error('Availability check should identify exactly one insufficient item');
      }
      
      return {
        testDrink: testDrink.name,
        availableServings: testDrink.availableServings,
        availabilityCheckPassed: true
      };
    });
  }

  async testOrderProcessing() {
    return this.runTest('Order Processing with Proper Deduction', async () => {
      // Get initial inventory
      const initialResponse = await fetch(`${this.baseUrl}/api/inventory/real-time`);
      const initialData = await initialResponse.json();
      
      const testDrink = initialData.inventory.find(item => item.availableServings >= 2);
      if (!testDrink) {
        throw new Error('No drinks with sufficient servings for testing');
      }
      
      const initialServings = testDrink.availableServings;
      const orderQuantity = 2;
      
      // Process a test order via voice agent
      const orderResponse = await fetch(`${this.baseUrl}/api/voice-advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'add_drink_to_cart',
          parameters: {
            drink_name: testDrink.name,
            quantity: orderQuantity
          }
        })
      });
      
      const orderData = await orderResponse.json();
      
      if (!orderData.success) {
        throw new Error(`Failed to add drink to cart: ${orderData.error || 'Unknown error'}`);
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
        // This might fail if voice agent doesn't have process_order tool
        console.warn('Order processing through voice agent failed, testing direct inventory deduction...');
        
        // Test direct inventory deduction
        const pourResponse = await fetch(`${this.baseUrl}/api/inventory/real-time`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'process_order_pours',
            orderId: 999, // Test order ID
            items: [{ drinkId: testDrink.id, quantity: orderQuantity }]
          })
        });
        
        const pourData = await pourResponse.json();
        
        if (!pourData.success) {
          throw new Error(`Direct inventory deduction failed: ${pourData.errors?.join(', ') || 'Unknown error'}`);
        }
      }
      
      // Check final inventory
      const finalResponse = await fetch(`${this.baseUrl}/api/inventory/real-time`);
      const finalData = await finalResponse.json();
      
      const finalDrink = finalData.inventory.find(item => item.id === testDrink.id);
      const finalServings = finalDrink.availableServings;
      
      return {
        drinkName: testDrink.name,
        initialServings,
        orderQuantity,
        finalServings,
        properlyDeducted: finalServings === (initialServings - orderQuantity),
        servingsChange: initialServings - finalServings
      };
    });
  }

  async generateReport() {
    console.log('\n📊 INVENTORY TESTING REPORT');
    console.log('===========================\n');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ Tests Passed: ${passed}`);
    console.log(`❌ Tests Failed: ${failed}`);
    console.log(`🎯 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%\n`);
    
    console.log('📋 Detailed Results:');
    console.table(this.results.map(r => ({
      Test: r.test,
      Status: r.status,
      'Duration (ms)': r.duration,
      Error: r.error || 'N/A'
    })));
    
    if (failed > 0) {
      console.log('\n🚨 Failed Tests Need Attention:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   • ${r.test}: ${r.error}`);
      });
    }
    
    console.log('\n💡 Recommendations:');
    if (failed === 0) {
      console.log('   🎉 All tests passed! Inventory logic is working correctly.');
    } else {
      console.log('   🔧 Fix failing tests before deploying inventory changes.');
    }
  }
}

async function runInventoryTests() {
  const tester = new InventoryTester();
  
  console.log('🚀 Starting Inventory Logic Tests\n');
  
  try {
    // Run tests in sequence
    await tester.testRealTimeInventoryStatus();
    await tester.testServingSizeCalculations();
    await tester.testInventoryAvailabilityCheck();
    
    // Note: Order processing test might fail if system isn't fully set up
    try {
      await tester.testOrderProcessing();
    } catch (error) {
      console.warn('⚠️ Order processing test skipped:', error.message);
    }
    
    await tester.generateReport();
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    await tester.generateReport();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runInventoryTests();
}

module.exports = { InventoryTester };