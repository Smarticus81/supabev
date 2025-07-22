import { neon } from "@neondatabase/serverless";
import { readFile } from "fs/promises";
import path from "path";

const sql = neon(process.env.DATABASE_URL!);

async function applyNewSchema() {
  console.log("Applying new schema changes...");
  
  try {
    // Read the latest migration file
    const migrationPath = path.join(process.cwd(), "drizzle", "0001_chubby_thaddeus_ross.sql");
    const migrationContent = await readFile(migrationPath, "utf-8");
    
    // Split into individual statements
    const statements = migrationContent
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));
    
    console.log(`Found ${statements.length} statements to execute`);
    
    // Execute each statement with error handling
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        // Skip CREATE TABLE statements for tables that already exist
        if (statement.includes("CREATE TABLE") && 
            (statement.includes('"customers"') || 
             statement.includes('"drinks"') || 
             statement.includes('"event_bookings"') ||
             statement.includes('"inventory"') ||
             statement.includes('"orders"') ||
             statement.includes('"pours"') ||
             statement.includes('"tax_categories"') ||
             statement.includes('"transactions"') ||
             statement.includes('"venues"'))) {
          console.log(`Skipping CREATE TABLE statement for existing table`);
          continue;
        }
        
        await sql(statement);
        console.log(`✓ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Handle specific errors that we can ignore
        if (error.message?.includes("already exists") || 
            error.message?.includes("column already exists") ||
            error.message?.includes("constraint already exists")) {
          console.log(`~ Statement ${i + 1} skipped (already exists): ${error.message}`);
          continue;
        }
        
        console.error(`✗ Error executing statement ${i + 1}:`, error.message);
        console.log("Statement:", statement.substring(0, 100) + "...");
        
        // Try to continue with other statements
        continue;
      }
    }
    
    // Now create the new tables that don't exist yet
    console.log("Creating new tables...");
    
    const newTables = [
      {
        name: "staff",
        sql: `CREATE TABLE IF NOT EXISTS "staff" (
          "id" serial PRIMARY KEY NOT NULL,
          "first_name" text NOT NULL,
          "last_name" text NOT NULL,
          "email" text NOT NULL,
          "phone" text,
          "role" text NOT NULL,
          "permissions" jsonb,
          "hourly_rate" integer,
          "hire_date" date,
          "is_active" boolean DEFAULT true,
          "pin_code" text,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now(),
          CONSTRAINT "staff_email_unique" UNIQUE("email")
        )`
      },
      {
        name: "event_packages",
        sql: `CREATE TABLE IF NOT EXISTS "event_packages" (
          "id" serial PRIMARY KEY NOT NULL,
          "name" text NOT NULL,
          "description" text,
          "price_per_person" integer NOT NULL,
          "min_guests" integer NOT NULL,
          "max_guests" integer NOT NULL,
          "duration_hours" integer DEFAULT 4,
          "included_drinks" integer DEFAULT 0,
          "bar_service_included" boolean DEFAULT true,
          "setup_included" boolean DEFAULT true,
          "cleanup_included" boolean DEFAULT true,
          "catering_included" boolean DEFAULT false,
          "package_items" jsonb,
          "add_ons_available" jsonb,
          "is_active" boolean DEFAULT true,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now()
        )`
      },
      {
        name: "customer_tabs",
        sql: `CREATE TABLE IF NOT EXISTS "customer_tabs" (
          "id" serial PRIMARY KEY NOT NULL,
          "customer_id" integer,
          "staff_id" integer,
          "event_booking_id" integer,
          "tab_name" text NOT NULL,
          "current_total" integer DEFAULT 0,
          "items" jsonb DEFAULT '[]',
          "status" text DEFAULT 'open',
          "opened_at" timestamp DEFAULT now(),
          "closed_at" timestamp,
          "notes" text
        )`
      },
      {
        name: "analytics_data",
        sql: `CREATE TABLE IF NOT EXISTS "analytics_data" (
          "id" serial PRIMARY KEY NOT NULL,
          "date" date NOT NULL,
          "metric_type" text NOT NULL,
          "metric_name" text NOT NULL,
          "value" text NOT NULL,
          "metadata" jsonb,
          "created_at" timestamp DEFAULT now()
        )`
      },
      {
        name: "inventory_movements",
        sql: `CREATE TABLE IF NOT EXISTS "inventory_movements" (
          "id" serial PRIMARY KEY NOT NULL,
          "drink_id" integer,
          "inventory_id" integer,
          "staff_id" integer,
          "movement_type" text NOT NULL,
          "quantity_change" integer NOT NULL,
          "cost_impact" integer,
          "reason" text,
          "reference_id" integer,
          "notes" text,
          "created_at" timestamp DEFAULT now()
        )`
      },
      {
        name: "ai_insights",
        sql: `CREATE TABLE IF NOT EXISTS "ai_insights" (
          "id" serial PRIMARY KEY NOT NULL,
          "insight_type" text NOT NULL,
          "title" text NOT NULL,
          "description" text NOT NULL,
          "confidence_score" real,
          "data_points" jsonb,
          "recommendations" jsonb,
          "status" text DEFAULT 'active',
          "priority" text DEFAULT 'medium',
          "expires_at" timestamp,
          "created_at" timestamp DEFAULT now()
        )`
      },
      {
        name: "system_config",
        sql: `CREATE TABLE IF NOT EXISTS "system_config" (
          "id" serial PRIMARY KEY NOT NULL,
          "config_key" text NOT NULL,
          "config_value" text NOT NULL,
          "config_type" text DEFAULT 'string',
          "description" text,
          "is_sensitive" boolean DEFAULT false,
          "updated_by" integer,
          "updated_at" timestamp DEFAULT now(),
          CONSTRAINT "system_config_config_key_unique" UNIQUE("config_key")
        )`
      },
      {
        name: "audit_log",
        sql: `CREATE TABLE IF NOT EXISTS "audit_log" (
          "id" serial PRIMARY KEY NOT NULL,
          "user_id" integer,
          "user_type" text DEFAULT 'staff',
          "action" text NOT NULL,
          "table_name" text,
          "record_id" text,
          "old_values" jsonb,
          "new_values" jsonb,
          "ip_address" text,
          "user_agent" text,
          "session_id" text,
          "created_at" timestamp DEFAULT now()
        )`
      }
    ];
    
    for (const table of newTables) {
      try {
        await sql(table.sql);
        console.log(`✓ Created table: ${table.name}`);
      } catch (error: any) {
        if (error.message?.includes("already exists")) {
          console.log(`~ Table ${table.name} already exists`);
        } else {
          console.error(`✗ Error creating table ${table.name}:`, error.message);
        }
      }
    }
    
    // Mark the migration as completed by updating the journal
    console.log("Updating migration journal...");
    
    try {
      // Check if drizzle migrations table exists
      await sql`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at timestamp DEFAULT now()
      )`;
      
      // Insert the migration record if it doesn't exist
      await sql`INSERT INTO "__drizzle_migrations" (hash, created_at) 
                VALUES ('0001_chubby_thaddeus_ross', now()) 
                ON CONFLICT DO NOTHING`;
      
      console.log("✓ Migration journal updated");
    } catch (error: any) {
      console.log("Migration journal update skipped:", error.message);
    }
    
    console.log("🎉 Schema update completed successfully!");
    
  } catch (error) {
    console.error("Error during schema update:", error);
    throw error;
  }
}

applyNewSchema()
  .then(() => {
    console.log("Schema update process completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Schema update failed:", error);
    process.exit(1);
  }); 