#!/usr/bin/env node

/**
 * Supabase Setup Script for Beverage POS
 * 
 * This script helps set up the Supabase database and verify the connection
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('🚀 Supabase Setup for Beverage POS\n');

async function checkEnvironment() {
  console.log('📋 Checking environment variables...');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.log('\n📝 Please copy .env.supabase.example to .env.local and fill in your Supabase credentials');
    process.exit(1);
  }
  
  console.log('✅ Environment variables found');
}

async function testConnection() {
  console.log('\n🔌 Testing Supabase connection...');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // Test basic connection
    const { data, error } = await supabase.from('drinks').select('count').limit(1);
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('⚠️  Tables not found - need to run migration first');
        return false;
      }
      throw error;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function runMigration() {
  console.log('\n📊 Running database migration...');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error && !error.message.includes('already exists')) {
          console.warn('⚠️  Migration warning:', error.message);
        }
      }
    }
    
    console.log('✅ Migration completed');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying setup...');
  
  try {
    const { supabaseDb } = require('./lib/supabase-db');
    
    // Test listing drinks
    const result = await supabaseDb.listDrinks();
    
    if (result.success && result.drinks.length > 0) {
      console.log(`✅ Found ${result.drinks.length} drinks in database`);
      console.log('🍺 Sample drinks:');
      result.drinks.slice(0, 3).forEach(drink => {
        console.log(`   - ${drink.name} (${drink.category}): $${(drink.price / 100).toFixed(2)}`);
      });
    } else {
      console.log('⚠️  No drinks found in database');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

async function main() {
  try {
    await checkEnvironment();
    
    const connected = await testConnection();
    
    if (!connected) {
      console.log('\n🛠️  Setting up database...');
      await runMigration();
    }
    
    await verifySetup();
    
    console.log('\n🎉 Supabase setup complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Start your application: npm run dev');
    console.log('   2. Test voice commands with inventory updates');
    console.log('   3. Monitor your Supabase dashboard for real-time data');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkEnvironment, testConnection, runMigration, verifySetup };
