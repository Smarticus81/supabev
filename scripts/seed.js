const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function main() {
  const dbPath = path.join(__dirname, '..', 'db', 'beverage-pos.sqlite');
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const drinksJsonPath = path.join(__dirname, '..', 'data', 'drinks.json');

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  const drinksData = JSON.parse(fs.readFileSync(drinksJsonPath, 'utf-8'));

  const insertDrink = db.prepare(
    `INSERT INTO drinks (id, name, category, subcategory, inventory_oz, unit_volume_oz, image_url, description, sales_servings) 
     VALUES (@id, @name, @category, @subcategory, @inventory_oz, @unit_volume_oz, @image_url, @description, @sales_servings)`
  );
  const insertServing = db.prepare(
    `INSERT INTO serving_options (drink_id, name, volume_oz, price) 
     VALUES (@drink_id, @name, @volume_oz, @price)`
  );

  const mixedCategories = ["Signature", "Cocktails", "Classics", "Signature Drinks"];

  drinksData.forEach((drink, index) => {
    const drinkId = `drink-${index}`;
    const categoryLower = drink.category.toLowerCase();
    
    let inventory_oz = null;
    let unit_volume_oz = null;

    if (!mixedCategories.includes(drink.category)) {
      switch (categoryLower) {
        case "spirits":
        case "wine":
          unit_volume_oz = 25.36;
          inventory_oz = drink.inventory * unit_volume_oz;
          break;
        case "beer":
        case "non-alcoholic":
          unit_volume_oz = 12; 
          inventory_oz = drink.inventory * unit_volume_oz;
          break;
      }
    }
    
    insertDrink.run({
      id: drinkId,
      name: drink.name,
      category: drink.category,
      subcategory: drink.subcategory || null,
      inventory_oz: inventory_oz,
      unit_volume_oz: unit_volume_oz,
      image_url: drink.image_url || null,
      description: drink.description || null,
      sales_servings: drink.sales || 0,
    });

    // Add serving options based on the drink category. The price from drinks.json is used as the base for the most common serving.
    if (categoryLower === "spirits") {
      // Base price is for a standard 1.5oz shot.
      insertServing.run({ drink_id: drinkId, name: 'Shot', volume_oz: 1.5, price: drink.price });
      insertServing.run({ drink_id: drinkId, name: 'Double', volume_oz: 3.0, price: drink.price * 1.8 }); // A double is typically priced at a slight discount.
    } else if (categoryLower === 'wine') {
      // Base price is for a standard 6oz glass. A bottle typically serves ~4 glasses.
      insertServing.run({ drink_id: drinkId, name: 'Glass', volume_oz: 6, price: drink.price });
      insertServing.run({ drink_id: drinkId, name: 'Bottle', volume_oz: 25.36, price: drink.price * 3.5 }); // Bottle price is usually cheaper than 4 individual glasses.
    } else if (mixedCategories.includes(drink.category)) {
      // Cocktails are made-to-order and have a single serving option.
      insertServing.run({ drink_id: drinkId, name: 'Cocktail', volume_oz: 8, price: drink.price }); // Assume a standard 8oz cocktail volume.
    } else {
      // Beer and other non-alcoholic drinks are sold by the unit (bottle/can).
      insertServing.run({ drink_id: drinkId, name: 'Unit', volume_oz: unit_volume_oz, price: drink.price });
    }
  });

  db.close();
  console.log('Database seeded with enhanced schema at', dbPath);
}

try {
  main();
} catch (err) {
  console.error('Seeding failed:', err);
  process.exit(1);
} 