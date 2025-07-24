const { processToolCall } = require('./lib/tools.js');

async function testInventoryUpdates() {
    console.log('Testing inventory update tooling...\n');
    
    try {
        // Test single inventory update
        console.log('Testing update_drink_inventory...');
        const singleUpdate = await processToolCall('update_drink_inventory', {
            drink_name: 'Coca-Cola',
            quantity_change: 10,
            unit: 'bottle'
        });
        console.log('Single update result:', JSON.stringify(singleUpdate, null, 2));
        
        // Test bulk inventory update
        console.log('\nTesting bulk_update_inventory...');
        const bulkUpdate = await processToolCall('bulk_update_inventory', {
            updates: [
                { drink_name: 'Pepsi', quantity_change: 5, unit: 'bottle' },
                { drink_name: 'Sprite', quantity_change: -2, unit: 'bottle' },
                { drink_name: 'Orange Juice', quantity_change: 3, unit: 'bottle' }
            ]
        });
        console.log('Bulk update result:', JSON.stringify(bulkUpdate, null, 2));
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testInventoryUpdates();
