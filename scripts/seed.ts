import fs from "fs"
import path from "path"
import Database from "better-sqlite3"

// Paths
const dbPath = path.join(__dirname, "..", "db", "beverage-pos.sqlite")
const schemaPath = path.join(__dirname, "..", "db", "schema.sql")
const drinksJsonPath = path.join(__dirname, "..", "data", "drinks.json")

// Ensure db directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

// Create database connection
const db = new Database(dbPath)

db.pragma("journal_mode = WAL")

// Load and run schema
const schema = fs.readFileSync(schemaPath, "utf-8")
db.exec(schema)

// Read drinks data
const drinksData = JSON.parse(fs.readFileSync(drinksJsonPath, "utf-8"))

db.transaction(() => {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO drinks (
      id, name, category, subcategory, price, inventory, image_url, description, sales, serving_size
    ) VALUES (
      @id, @name, @category, @subcategory, @price, @inventory, @image_url, @description, @sales, @serving_size
    )`,
  )

  const mixedCategories = ["Signature", "Cocktails", "Classics", "Signature Drinks"]

  drinksData.forEach((drink: any, index: number) => {
    const categoryLower = drink.category.toLowerCase()
    let servingSize: string | null = null
    if (categoryLower === "spirits") servingSize = "shot"
    else if (categoryLower === "beer") servingSize = "bottle"
    else if (categoryLower === "wine" || categoryLower === "non-alcoholic") servingSize = "glass"

    insert.run({
      id: `drink-${index}`,
      name: drink.name,
      category: drink.category,
      subcategory: drink.subcategory ?? null,
      price: drink.price,
      inventory: mixedCategories.includes(drink.category) ? null : drink.inventory,
      image_url: drink.image_url ?? null,
      description: drink.description ?? null,
      sales: drink.sales ?? 0,
      serving_size: servingSize,
    })
  })
})()

console.log("Database seeded at", dbPath) 