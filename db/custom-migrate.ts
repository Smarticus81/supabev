import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function customMigrate() {
  console.log("Starting custom migration...");
  
  try {
    // First, let's handle the constraints that need default values
    
    // For venues table - add required columns with defaults first
    await sql`
      ALTER TABLE venues 
      ADD COLUMN IF NOT EXISTS city text DEFAULT 'Unknown',
      ADD COLUMN IF NOT EXISTS state text DEFAULT 'TX'
    `;
    
    // Update existing venues with proper city/state if they don't have them
    await sql`
      UPDATE venues 
      SET city = COALESCE(city, 'Unknown'), 
          state = COALESCE(state, 'TX')
      WHERE city IS NULL OR state IS NULL
    `;
    
    // Now make them NOT NULL
    await sql`
      ALTER TABLE venues 
      ALTER COLUMN city SET NOT NULL,
      ALTER COLUMN state SET NOT NULL
    `;
    
    // For inventory table - add size_oz with default first
    await sql`
      ALTER TABLE inventory 
      ADD COLUMN IF NOT EXISTS size_oz real DEFAULT 750.0
    `;
    
    // Update existing inventory with proper size_oz
    await sql`
      UPDATE inventory 
      SET size_oz = COALESCE(size_oz, 750.0)
      WHERE size_oz IS NULL
    `;
    
    // Now make it NOT NULL
    await sql`
      ALTER TABLE inventory 
      ALTER COLUMN size_oz SET NOT NULL
    `;
    
    // For orders table - add required columns with defaults
    await sql`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS subtotal integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount integer DEFAULT 0
    `;
    
    // Calculate subtotal and tax for existing orders based on total
    await sql`
      UPDATE orders 
      SET 
        subtotal = CASE 
          WHEN subtotal IS NULL OR subtotal = 0 
          THEN FLOOR(total * 0.926)::integer 
          ELSE subtotal 
        END,
        tax_amount = CASE 
          WHEN tax_amount IS NULL OR tax_amount = 0 
          THEN (total - FLOOR(total * 0.926)::integer)::integer 
          ELSE tax_amount 
        END
      WHERE subtotal IS NULL OR tax_amount IS NULL OR subtotal = 0 OR tax_amount = 0
    `;
    
    // Now make them NOT NULL
    await sql`
      ALTER TABLE orders 
      ALTER COLUMN subtotal SET NOT NULL,
      ALTER COLUMN tax_amount SET NOT NULL
    `;
    
    // For transactions - add required columns with defaults
    await sql`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'sale',
      ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash'
    `;
    
    // Update existing transactions
    await sql`
      UPDATE transactions 
      SET 
        transaction_type = COALESCE(transaction_type, 'sale'),
        payment_method = COALESCE(payment_method, 'cash')
      WHERE transaction_type IS NULL OR payment_method IS NULL
    `;
    
    // Now make them NOT NULL
    await sql`
      ALTER TABLE transactions 
      ALTER COLUMN transaction_type SET NOT NULL,
      ALTER COLUMN payment_method SET NOT NULL
    `;
    
    console.log("Custom migrations completed successfully!");
    
    // Now run the standard migration
    console.log("Running standard drizzle migration...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    
    console.log("All migrations completed successfully!");
    
  } catch (error) {
    console.error("Error during custom migration:", error);
    throw error;
  }
}

customMigrate()
  .then(() => {
    console.log("Migration process completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  }); 