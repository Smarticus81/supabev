const { invoke } = require('./lib/tools.js');

console.log('🧪 Testing inventory update functionality...');

async function testInventoryUpdates() {
  try {
    console.log('\n1. Testing update_drink_inventory (single update)...');
    const singleResult = await invoke('update_drink_inventory', {
      drink_name: 'Corona',
      quantity_change: -2,
      unit: 'bottle'
    });
    console.log('✅ Single update result:', singleResult);

    console.log('\n2. Testing bulk_update_inventory (multiple updates)...');
    const bulkResult = await invoke('bulk_update_inventory', {
      updates: [
        { drink_name: 'Heineken', quantity_change: 5, unit: 'bottle' },
        { drink_name: 'Stella Artois', quantity_change: -1, unit: 'bottle' },
        { drink_name: 'Bud Light', quantity_change: 3, unit: 'bottle' }
      ]
    });
    console.log('✅ Bulk update result:', bulkResult);

    console.log('\n✅ All inventory update tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testInventoryUpdates();
