/**
 * Latency Testing Script
 * Tests various operations to measure performance improvements
 */

const { performance } = require('perf_hooks');

class LatencyTester {
  constructor() {
    this.results = [];
  }

  async timeOperation(name, operation, iterations = 10) {
    const times = [];
    
    console.log(`🧪 Testing ${name} (${iterations} iterations)...`);
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await operation();
        const end = performance.now();
        times.push(end - start);
      } catch (error) {
        console.error(`❌ Error in ${name}:`, error.message);
        times.push(null);
      }
    }
    
    const validTimes = times.filter(t => t !== null);
    const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const min = Math.min(...validTimes);
    const max = Math.max(...validTimes);
    
    const result = {
      name,
      iterations: validTimes.length,
      avgMs: avg,
      minMs: min,
      maxMs: max,
      successRate: (validTimes.length / iterations) * 100
    };
    
    this.results.push(result);
    
    console.log(`✅ ${name}:`);
    console.log(`   Average: ${avg.toFixed(2)}ms`);
    console.log(`   Min: ${min.toFixed(2)}ms`);
    console.log(`   Max: ${max.toFixed(2)}ms`);
    console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`);
    console.log('');
    
    return result;
  }

  async testVoiceOperations() {
    console.log('🚀 Starting Voice Operations Latency Tests\n');
    
    // Test drink search
    await this.timeOperation(
      'Drink Search',
      async () => {
        const response = await fetch('http://localhost:3000/api/drinks', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        return response.json();
      }
    );
    
    // Test add to cart
    await this.timeOperation(
      'Add to Cart',
      async () => {
        const response = await fetch('http://localhost:3000/api/voice-advanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_drink',
            drink_name: 'Hendricks Gin',
            quantity: 1
          })
        });
        return response.json();
      }
    );
    
    // Test cart operations
    await this.timeOperation(
      'Show Cart',
      async () => {
        const response = await fetch('http://localhost:3000/api/voice-advanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'show_cart'
          })
        });
        return response.json();
      }
    );
    
    // Test inventory check
    await this.timeOperation(
      'Inventory Status',
      async () => {
        const response = await fetch('http://localhost:3000/api/voice-advanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'inventory_status'
          })
        });
        return response.json();
      }
    );
  }

  async testDatabaseOperations() {
    console.log('💾 Starting Database Operations Latency Tests\n');
    
    // Test drink management operations
    await this.timeOperation(
      'Create Drink',
      async () => {
        const response = await fetch('http://localhost:3000/api/voice/drink-management', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_drink',
            name: `Test Drink ${Date.now()}`,
            category: 'Test',
            price: 10.99
          })
        });
        return response.json();
      }
    );
  }

  generateReport() {
    console.log('📊 LATENCY TEST REPORT');
    console.log('====================\n');
    
    const sortedResults = this.results.sort((a, b) => a.avgMs - b.avgMs);
    
    console.log('🏆 Fastest Operations:');
    sortedResults.slice(0, 3).forEach((result, index) => {
      console.log(`${index + 1}. ${result.name}: ${result.avgMs.toFixed(2)}ms avg`);
    });
    
    console.log('\n🐌 Slowest Operations:');
    sortedResults.slice(-3).reverse().forEach((result, index) => {
      console.log(`${index + 1}. ${result.name}: ${result.avgMs.toFixed(2)}ms avg`);
    });
    
    console.log('\n📈 All Results:');
    console.table(this.results.map(r => ({
      Operation: r.name,
      'Avg (ms)': r.avgMs.toFixed(2),
      'Min (ms)': r.minMs.toFixed(2),
      'Max (ms)': r.maxMs.toFixed(2),
      'Success %': r.successRate.toFixed(1)
    })));
    
    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    this.results.forEach(result => {
      if (result.avgMs > 500) {
        console.log(`⚠️  ${result.name} is slow (${result.avgMs.toFixed(2)}ms) - consider optimization`);
      }
    });
    
    const overallAvg = this.results.reduce((sum, r) => sum + r.avgMs, 0) / this.results.length;
    console.log(`\n🎯 Overall Average Latency: ${overallAvg.toFixed(2)}ms`);
  }
}

// Run tests
async function runTests() {
  const tester = new LatencyTester();
  
  try {
    await tester.testVoiceOperations();
    await tester.testDatabaseOperations();
    tester.generateReport();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Check if we're running this script directly
if (require.main === module) {
  runTests();
}

module.exports = { LatencyTester };