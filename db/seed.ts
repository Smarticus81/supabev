import 'dotenv/config';
import db from '../db/index';
import { drinks, taxCategories, customers, venues, inventory } from '../db/schema';

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Create tax categories
    console.log('Creating tax categories...');
    await db.insert(taxCategories).values([
      {
        name: 'Beer',
        rate: '0.05',
        type: 'percentage',
        description: 'Standard beer tax rate'
      },
      {
        name: 'Wine', 
        rate: '0.08',
        type: 'percentage',
        description: 'Standard wine tax rate'
      },
      {
        name: 'Spirits',
        rate: '0.12',
        type: 'percentage', 
        description: 'Standard spirits tax rate'
      }
    ]).onConflictDoNothing();

    // Get tax category IDs
    const taxCats = await db.select().from(taxCategories);
    const beerTaxId = taxCats.find(t => t.name === 'Beer')?.id;
    const wineTaxId = taxCats.find(t => t.name === 'Wine')?.id;
    const spiritsTaxId = taxCats.find(t => t.name === 'Spirits')?.id;

    // Create drinks
    console.log('Creating drinks...');
    await db.insert(drinks).values([
      // Beers
      { name: 'Bud Light', category: 'Beer', price: 550, inventory: 24, tax_category_id: beerTaxId },
      { name: 'Miller Lite', category: 'Beer', price: 550, inventory: 18, tax_category_id: beerTaxId },
      { name: 'Coors Light', category: 'Beer', price: 550, inventory: 20, tax_category_id: beerTaxId },
      { name: 'Corona Extra', category: 'Beer', price: 650, inventory: 15, tax_category_id: beerTaxId },
      { name: 'Heineken', category: 'Beer', price: 700, inventory: 12, tax_category_id: beerTaxId },
      { name: 'Stella Artois', category: 'Beer', price: 750, inventory: 10, tax_category_id: beerTaxId },

      // Wines
      { name: 'Chardonnay', category: 'Wine', price: 1200, inventory: 8, tax_category_id: wineTaxId },
      { name: 'Cabernet Sauvignon', category: 'Wine', price: 1400, inventory: 6, tax_category_id: wineTaxId },
      { name: 'Pinot Grigio', category: 'Wine', price: 1100, inventory: 7, tax_category_id: wineTaxId },
      { name: 'Merlot', category: 'Wine', price: 1300, inventory: 5, tax_category_id: wineTaxId },

      // Spirits
      { name: 'Hendricks Gin', category: 'Gin', price: 1800, inventory: 4, tax_category_id: spiritsTaxId },
      { name: 'G.Goose Vodka', category: 'Vodka', price: 1600, inventory: 6, tax_category_id: spiritsTaxId },
      { name: "Tito's Vodka", category: 'Vodka', price: 1400, inventory: 8, tax_category_id: spiritsTaxId },
      { name: 'Jim Beam', category: 'Whiskey', price: 1500, inventory: 5, tax_category_id: spiritsTaxId },
      { name: "JD's Whiskey", category: 'Whiskey', price: 1700, inventory: 4, tax_category_id: spiritsTaxId },
      { name: 'Jameson Whiskey', category: 'Whiskey', price: 1900, inventory: 3, tax_category_id: spiritsTaxId },
      { name: 'Crown Royal', category: 'Whiskey', price: 2000, inventory: 2, tax_category_id: spiritsTaxId },
      { name: 'Bombay Sapphire', category: 'Gin', price: 1750, inventory: 3, tax_category_id: spiritsTaxId },
      { name: 'Captain Morgan', category: 'Rum', price: 1350, inventory: 6, tax_category_id: spiritsTaxId },
      { name: 'Malibu', category: 'Rum', price: 1200, inventory: 8, tax_category_id: spiritsTaxId }
    ]).onConflictDoNothing();

    console.log('Creating sample inventory tracking...');
    // Import eq for database queries
    const { eq } = await import('drizzle-orm');
    
    // Get drink IDs for spirits that need bottle tracking
    const spiritDrinks = await db.select().from(drinks).where(eq(drinks.category, 'Gin'));
    const vodkaDrinks = await db.select().from(drinks).where(eq(drinks.category, 'Vodka'));
    const whiskeyDrinks = await db.select().from(drinks).where(eq(drinks.category, 'Whiskey'));
    const rumDrinks = await db.select().from(drinks).where(eq(drinks.category, 'Rum'));

    // Create sample bottles for spirits (750ml bottles)
    const inventoryEntries = [];
    
    // Hendricks Gin bottles
    const hendricks = spiritDrinks.find(d => d.name === 'Hendricks Gin');
    if (hendricks) {
      for (let i = 1; i <= 4; i++) {
        inventoryEntries.push({
          drink_id: hendricks.id,
          bottle_id: `HG-${Date.now()}-${i}`,
          remaining_ml: '750'
        });
      }
    }

    // G.Goose Vodka bottles
    const ggoose = vodkaDrinks.find(d => d.name === 'G.Goose Vodka');
    if (ggoose) {
      for (let i = 1; i <= 6; i++) {
        inventoryEntries.push({
          drink_id: ggoose.id,
          bottle_id: `GV-${Date.now()}-${i}`,
          remaining_ml: i <= 2 ? '450' : '750' // Some partially used bottles
        });
      }
    }

    // Tito's Vodka bottles
    const titos = vodkaDrinks.find(d => d.name === "Tito's Vodka");
    if (titos) {
      for (let i = 1; i <= 8; i++) {
        inventoryEntries.push({
          drink_id: titos.id,
          bottle_id: `TV-${Date.now()}-${i}`,
          remaining_ml: '750'
        });
      }
    }

    // Jim Beam bottles
    const jimBeam = whiskeyDrinks.find(d => d.name === 'Jim Beam');
    if (jimBeam) {
      for (let i = 1; i <= 5; i++) {
        inventoryEntries.push({
          drink_id: jimBeam.id,
          bottle_id: `JB-${Date.now()}-${i}`,
          remaining_ml: i === 1 ? '300' : '750' // One partially used bottle
        });
      }
    }

    if (inventoryEntries.length > 0) {
      await db.insert(inventory).values(inventoryEntries).onConflictDoNothing();
    }

    // Create sample customers
    console.log('Creating sample customers...');
    await db.insert(customers).values([
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0123'
      },
      {
        first_name: 'Jane',
        last_name: 'Smith', 
        email: 'jane.smith@example.com',
        phone: '555-0456'
      },
      {
        first_name: 'Mike',
        last_name: 'Johnson',
        email: 'mike.johnson@example.com', 
        phone: '555-0789'
      }
    ]).onConflictDoNothing();

    // Create sample venues
    console.log('Creating sample venues...');
    await db.insert(venues).values([
      {
        name: 'Main Bar',
        address: '123 Main St, Downtown',
        capacity: 50,
        description: 'Our main bar area with full service'
      },
      {
        name: 'Private Event Room',
        address: '123 Main St, Upper Level',
        capacity: 30,
        description: 'Private room for special events and parties'
      },
      {
        name: 'Outdoor Patio',
        address: '123 Main St, Patio',
        capacity: 40,
        description: 'Outdoor seating with full bar service'
      }
    ]).onConflictDoNothing();

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
