import 'dotenv/config';
import db from './db/index.ts';
import { eventPackages } from './db/schema.ts';

async function addEventPackages() {
  try {
    console.log('Adding test event packages...');
    
    // Add test packages
    await db.insert(eventPackages).values([
      {
        name: 'Gold Package',
        description: 'Premium event package with full bar service',
        price_per_person: 7500, // 75 dollars in cents
        min_guests: 20,
        max_guests: 100,
        duration_hours: 4
      },
      {
        name: 'Silver Package', 
        description: 'Standard event package with limited bar',
        price_per_person: 5500, // 55 dollars in cents
        min_guests: 10,
        max_guests: 50,
        duration_hours: 3
      },
      {
        name: 'Platinum Package',
        description: 'Luxury event package with premium drinks',
        price_per_person: 12000, // 120 dollars in cents
        min_guests: 50,
        max_guests: 200,
        duration_hours: 6
      }
    ]).onConflictDoNothing();
    
    console.log('Event packages added successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error adding packages:', error);
    process.exit(1);
  }
}

addEventPackages();
