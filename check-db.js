const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function checkSchema() {
  try {
    console.log('Checking existing event packages...');
    const result = await sql`SELECT * FROM event_packages LIMIT 3`;
    console.log('Existing packages:', result);
    
    if (result.length > 0) {
      console.log('Sample package structure:', Object.keys(result[0]));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

checkSchema();
