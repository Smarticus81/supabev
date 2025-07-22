// Test script to verify cart functionality
const { invoke } = require('./lib/tools');

async function testCartFunctionality() {
  console.log('🧪 Testing cart functionality...\n');

  try {
    // Test 1: Clear cart first
    console.log('1. Clearing cart...');
    const clearResult = await invoke('cart_clear', { clientId: 'default' });
    console.log('Clear result:', clearResult);

    // Test 2: View empty cart
    console.log('\n2. Viewing empty cart...');
    const emptyCartResult = await invoke('cart_view', { clientId: 'default' });
    console.log('Empty cart result:', emptyCartResult);

    // Test 3: Add a drink to cart
    console.log('\n3. Adding beer to cart...');
    const addResult = await invoke('cart_add', { 
      drink_name: 'Bud Light', 
      quantity: 2, 
      clientId: 'default' 
    });
    console.log('Add result:', addResult);

    // Test 4: View cart with items
    console.log('\n4. Viewing cart with items...');
    const cartWithItemsResult = await invoke('cart_view', { clientId: 'default' });
    console.log('Cart with items result:', cartWithItemsResult);

    // Test 5: Add another drink
    console.log('\n5. Adding wine to cart...');
    const addWineResult = await invoke('cart_add', { 
      drink_name: 'Kendall Jackson Chardonnay', 
      quantity: 1, 
      clientId: 'default' 
    });
    console.log('Add wine result:', addWineResult);

    // Test 6: View final cart
    console.log('\n6. Viewing final cart...');
    const finalCartResult = await invoke('cart_view', { clientId: 'default' });
    console.log('Final cart result:', finalCartResult);

    console.log('\n✅ Cart functionality test completed successfully!');

  } catch (error) {
    console.error('❌ Cart functionality test failed:', error);
  }
}

// Run the test
testCartFunctionality(); 