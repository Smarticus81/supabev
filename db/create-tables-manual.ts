import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function createTablesManually() {
  console.log('🔨 Creating tables manually...');

  try {
    // Create staff table
    console.log('Creating staff table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "staff" (
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
      )
    `;

    // Create event_packages table
    console.log('Creating event_packages table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "event_packages" (
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
      )
    `;

    // Create customer_tabs table
    console.log('Creating customer_tabs table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "customer_tabs" (
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
      )
    `;

    // Create analytics_data table
    console.log('Creating analytics_data table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "analytics_data" (
        "id" serial PRIMARY KEY NOT NULL,
        "date" date NOT NULL,
        "metric_type" text NOT NULL,
        "metric_name" text NOT NULL,
        "value" text NOT NULL,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
      )
    `;

    // Create inventory_movements table
    console.log('Creating inventory_movements table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "inventory_movements" (
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
      )
    `;

    // Create ai_insights table
    console.log('Creating ai_insights table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "ai_insights" (
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
      )
    `;

    // Create system_config table
    console.log('Creating system_config table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "system_config" (
        "id" serial PRIMARY KEY NOT NULL,
        "config_key" text NOT NULL,
        "config_value" text NOT NULL,
        "config_type" text DEFAULT 'string',
        "description" text,
        "is_sensitive" boolean DEFAULT false,
        "updated_by" integer,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "system_config_config_key_unique" UNIQUE("config_key")
      )
    `;

    // Create audit_log table
    console.log('Creating audit_log table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "audit_log" (
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
      )
    `;

    // Add missing columns to existing tables
    console.log('Adding missing columns to existing tables...');
    
    // Update customers table
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address" text`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "city" text`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "state" text`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "zip_code" text`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "date_of_birth" date`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferences" jsonb`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "loyalty_points" integer DEFAULT 0`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "total_spent" integer DEFAULT 0`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "visit_count" integer DEFAULT 0`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_visit" timestamp`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "notes" text`;
    await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now()`;

    // Update drinks table
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "subcategory" text`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "unit_volume_oz" real`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "cost_per_unit" integer`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "profit_margin" real`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "popularity_score" integer DEFAULT 0`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "image_url" text`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "description" text`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now()`;
    await sql`ALTER TABLE "drinks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now()`;

    // Update venues table
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "city" text DEFAULT 'Austin'`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "state" text DEFAULT 'TX'`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "zip_code" text`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "indoor_capacity" integer`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "outdoor_capacity" integer`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "amenities" jsonb`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "hourly_rate" integer`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "daily_rate" integer`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "setup_time_hours" integer DEFAULT 2`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "cleanup_time_hours" integer DEFAULT 1`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true`;
    await sql`ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now()`;

    // Update event_bookings table
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "package_id" integer`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "event_name" text`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "event_type" text`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "start_time" time`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "end_time" time`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "base_price" integer`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "add_ons_price" integer DEFAULT 0`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "total_price" integer`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "deposit_paid" integer DEFAULT 0`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "balance_due" integer`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "special_requests" text`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "contract_signed" boolean DEFAULT false`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "payment_schedule" jsonb`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "assigned_staff" jsonb`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "setup_notes" text`;
    await sql`ALTER TABLE "event_bookings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now()`;

    console.log('✅ All tables created and updated successfully!');

  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

createTablesManually()
  .then(() => {
    console.log('Tables creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Tables creation failed:', error);
    process.exit(1);
  }); 