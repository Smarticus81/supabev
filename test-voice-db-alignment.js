#!/usr/bin/env node

// Test script to verify voice system and database alignment
const axios = require('axios').default;

async function testVoiceDBAlignment() {
    console.log('🎤 TESTING VOICE & DATABASE ALIGNMENT\n');
    
    const baseUrl = 'http://localhost:3000/api';
    
    try {
        // Test 1: Search for drinks that exist in DB
        console.log('📋 TEST 1: Voice Search Functions');
        const searchTests = [
            'Bud Light',
            'Heineken', 
            'Corona',
            'beer',
            'wine'
        ];
        
        for (const query of searchTests) {
            try {
                console.log(`  🔍 Searching for: "${query}"`);
                const response = await axios.post(`${baseUrl}/voice-advanced`, {
                    action: 'search_drinks',
                    params: { query, clientId: 'test' }
                });
                
                if (response.data.success && response.data.drinks) {
                    console.log(`    ✅ Found ${response.data.drinks.length} drinks`);
                    if (response.data.drinks.length > 0) {
                        console.log(`    📍 Example: ${response.data.drinks[0].name} - $${(response.data.drinks[0].price / 100).toFixed(2)}`);
                    }
                } else {
                    console.log(`    ❌ Search failed: ${response.data.error || 'No drinks found'}`);
                }
            } catch (error) {
                console.log(`    ❌ API Error: ${error.message}`);
            }
        }
        
        // Test 2: Cart operations
        console.log('\n🛒 TEST 2: Cart Operations');
        const cartTests = [
            { drink_name: 'Bud Light', quantity: 2 },
            { drink_name: 'Heineken', quantity: 1 },
            { drink_name: 'Corona Extra', quantity: 3 }
        ];
        
        for (const item of cartTests) {
            try {
                console.log(`  ➕ Adding to cart: ${item.quantity}x ${item.drink_name}`);
                const response = await axios.post(`${baseUrl}/voice-advanced`, {
                    action: 'add_drink_to_cart',
                    params: { ...item, clientId: 'test' }
                });
                
                if (response.data.success) {
                    console.log(`    ✅ Added successfully`);
                } else {
                    console.log(`    ❌ Failed: ${response.data.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.log(`    ❌ API Error: ${error.message}`);
            }
        }
        
        // Test 3: View cart
        console.log('\n📦 TEST 3: View Cart');
        try {
            const response = await axios.post(`${baseUrl}/voice-advanced`, {
                action: 'cart_view',
                params: { clientId: 'test' }
            });
            
            if (response.data.success && response.data.cart) {
                console.log(`  ✅ Cart contains ${response.data.cart.length} items:`);
                response.data.cart.forEach(item => {
                    console.log(`    🍺 ${item.quantity}x ${item.drink_name} - $${(item.price / 100).toFixed(2)} each`);
                });
            } else {
                console.log(`  ❌ Cart view failed: ${response.data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.log(`  ❌ API Error: ${error.message}`);
        }
        
        // Test 4: Check database directly
        console.log('\n💾 TEST 4: Database Health Check');
        try {
            const response = await axios.post(`${baseUrl}/voice-advanced`, {
                action: 'health_check',
                params: {}
            });
            
            if (response.data.success) {
                console.log(`  ✅ Database: ${response.data.database}`);
                console.log(`  ✅ Status: ${response.data.status}`);
                console.log(`  ✅ Active carts: ${response.data.carts}`);
            } else {
                console.log(`  ❌ Health check failed`);
            }
        } catch (error) {
            console.log(`  ❌ API Error: ${error.message}`);
        }
        
        // Test 5: Category filtering
        console.log('\n📂 TEST 5: Category Filtering');
        const categories = ['Beer', 'Wine', 'Spirits'];
        
        for (const category of categories) {
            try {
                console.log(`  📋 Getting ${category} drinks`);
                const response = await axios.post(`${baseUrl}/voice-advanced`, {
                    action: 'search_drinks',
                    params: { category, clientId: 'test' }
                });
                
                if (response.data.success && response.data.drinks) {
                    console.log(`    ✅ Found ${response.data.drinks.length} ${category.toLowerCase()} drinks`);
                } else {
                    console.log(`    ❌ Category search failed: ${response.data.error || 'No drinks found'}`);
                }
            } catch (error) {
                console.log(`    ❌ API Error: ${error.message}`);
            }
        }
        
        console.log('\n🎉 VOICE & DATABASE ALIGNMENT TEST COMPLETE');
        
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
    }
}

// Run the test
testVoiceDBAlignment(); 