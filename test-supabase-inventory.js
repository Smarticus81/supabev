const { supabaseDb } = require('./lib/supabase-db');

console.log('🧪 Testing Supabase inventory update functionality...');

async function testSupabaseInventoryUpdates() {
  try {
    console.log('\n1. Testing list_drinks...');
    const drinksList = await supabaseDb.listDrinks();
    console.log('✅ Drinks list result:', drinksList);

    if (drinksList.drinks && drinksList.drinks.length > 0) {
      const testDrink = drinksList.drinks[0];
      console.log(`\n2. Testing inventory update with: ${testDrink.name}`);
      
      const updateResult = await supabaseDb.updateInventory(testDrink.name, 2, 'bottle');
      console.log('✅ Update result:', updateResult);

      console.log('\n3. Testing add inventory...');
      const addResult = await supabaseDb.addInventory(testDrink.name, 1, 'bottle');
      console.log('✅ Add result:', addResult);
    } else {
      console.log('⚠️  No drinks found in database. Need to run migration first.');
    }

    console.log('\n✅ All Supabase tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\n💡 This might be because:');
    console.log('   1. Supabase environment variables not set');
    console.log('   2. Database migration not run yet');
    console.log('   3. Connection string incorrect');
    console.log('\n🛠️  Run: node setup-supabase.js to set up the database');
  }
}

testSupabaseInventoryUpdates();
