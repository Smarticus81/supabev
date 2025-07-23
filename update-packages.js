require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function updatePackages() {
  console.log('Updating event packages with Twisted Spirits data...');
  
  try {
    // Delete existing packages
    await sql`DELETE FROM event_packages`;
    console.log('Cleared existing packages');
    
    // Insert Twisted Spirits packages
    const packages = [
      {
        name: 'The Basics Bar',
        description: 'Essential bar service with top-shelf liquors, wine selection, and signature cocktails. Perfect for intimate gatherings.',
        price: 20, // Average of 17-23 per person
        duration_hours: 4,
        max_guests: 50
      },
      {
        name: 'The Bravo Bar', 
        description: 'Enhanced bar service with premium spirits, expanded wine selection, craft cocktails, and specialty drinks.',
        price: 21, // Average of 18-24 per person
        duration_hours: 5,
        max_guests: 100
      },
      {
        name: 'The Big Time Bar',
        description: 'Premium full-service bar with top-tier spirits, extensive wine collection, artisanal cocktails, and exclusive offerings.',
        price: 26, // Average of 22-30 per person
        duration_hours: 6,
        max_guests: 200
      }
    ];
    
    for (const pkg of packages) {
      await sql`
        INSERT INTO event_packages (name, description, price, duration_hours, max_guests, created_at)
        VALUES (${pkg.name}, ${pkg.description}, ${pkg.price}, ${pkg.duration_hours}, ${pkg.max_guests}, now())
      `;
    }
    
    console.log('Successfully updated packages with Twisted Spirits data');
    
    // Verify the data
    const result = await sql`SELECT * FROM event_packages ORDER BY price`;
    console.log('Current packages:');
    result.forEach(pkg => {
      console.log(`- ${pkg.name}: $${pkg.price}/person, ${pkg.duration_hours}hrs, max ${pkg.max_guests} guests`);
    });
    
  } catch (error) {
    console.error('Error updating packages:', error);
  }
}

updatePackages();
