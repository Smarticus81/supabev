ALTER TABLE "drinks" ADD COLUMN "unit_type" text DEFAULT 'ounce' NOT NULL;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "serving_size_oz" real;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "servings_per_container" integer;