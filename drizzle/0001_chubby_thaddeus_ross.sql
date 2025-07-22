CREATE TABLE "ai_insights" (
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
);
--> statement-breakpoint
CREATE TABLE "analytics_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"metric_type" text NOT NULL,
	"metric_name" text NOT NULL,
	"value" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
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
);
--> statement-breakpoint
CREATE TABLE "customer_tabs" (
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
);
--> statement-breakpoint
CREATE TABLE "event_packages" (
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
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
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
);
--> statement-breakpoint
CREATE TABLE "staff" (
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
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_key" text NOT NULL,
	"config_value" text NOT NULL,
	"config_type" text DEFAULT 'string',
	"description" text,
	"is_sensitive" boolean DEFAULT false,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_config_config_key_unique" UNIQUE("config_key")
);
--> statement-breakpoint
ALTER TABLE "event_bookings" ALTER COLUMN "event_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "opened_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "items" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "zip_code" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "preferences" jsonb;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "loyalty_points" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "total_spent" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "visit_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_visit" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "subcategory" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "unit_volume_oz" real;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "cost_per_unit" integer;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "profit_margin" real;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "popularity_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "package_id" integer;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "event_name" text;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "event_type" text;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "end_time" time;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "base_price" integer;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "add_ons_price" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "total_price" integer;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "deposit_paid" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "balance_due" integer;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "special_requests" text;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "contract_signed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "payment_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "assigned_staff" jsonb;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "setup_notes" text;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "size_oz" real NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "cost" integer;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "vendor" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "batch_number" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "received_date" date DEFAULT now();--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "finished_at" timestamp;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "status" text DEFAULT 'unopened';--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "reorder_level" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "staff_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "event_booking_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_amount" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tip_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "pours" ADD COLUMN "staff_id" integer;--> statement-breakpoint
ALTER TABLE "pours" ADD COLUMN "volume_oz" real;--> statement-breakpoint
ALTER TABLE "pours" ADD COLUMN "cost_per_pour" integer;--> statement-breakpoint
ALTER TABLE "pours" ADD COLUMN "compliance_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tax_categories" ADD COLUMN "applies_to" jsonb;--> statement-breakpoint
ALTER TABLE "tax_categories" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tax_categories" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "booking_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transaction_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payment_method" text NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payment_processor" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "processor_transaction_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "payment_details" jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refund_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fees" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "net_amount" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "processed_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "city" text NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "state" text NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "zip_code" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "indoor_capacity" integer;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "outdoor_capacity" integer;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "amenities" jsonb;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "hourly_rate" integer;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "daily_rate" integer;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "setup_time_hours" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "cleanup_time_hours" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_staff_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tabs" ADD CONSTRAINT "customer_tabs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tabs" ADD CONSTRAINT "customer_tabs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tabs" ADD CONSTRAINT "customer_tabs_event_booking_id_event_bookings_id_fk" FOREIGN KEY ("event_booking_id") REFERENCES "public"."event_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_drink_id_drinks_id_fk" FOREIGN KEY ("drink_id") REFERENCES "public"."drinks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_package_id_event_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."event_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_booking_id_event_bookings_id_fk" FOREIGN KEY ("event_booking_id") REFERENCES "public"."event_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pours" ADD CONSTRAINT "pours_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_event_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."event_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_unique" UNIQUE("order_number");