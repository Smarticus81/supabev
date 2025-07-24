-- Supabase Migration: Initial Schema Setup
-- This creates the beverage POS database schema with inventory_oz support

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tax categories for state liquor/beer/wine compliance
CREATE TABLE IF NOT EXISTS tax_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rate TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  applies_to JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Core drinks catalog with inventory_oz support
CREATE TABLE IF NOT EXISTS drinks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  price INTEGER NOT NULL, -- Price in cents
  inventory INTEGER NOT NULL DEFAULT 0, -- Inventory count (bottles/cans/units)
  inventory_oz REAL DEFAULT 0, -- Inventory in ounces for fluid tracking
  unit_type TEXT NOT NULL DEFAULT 'ounce', -- "bottle", "glass", "ounce", "shot", "can", "pint"
  unit_volume_oz REAL, -- Volume of standard unit in ounces
  serving_size_oz REAL, -- Standard serving size for this item
  servings_per_container INTEGER, -- For bottles/cans - how many servings per container
  cost_per_unit INTEGER, -- Cost in cents
  profit_margin REAL, -- Calculated profit margin
  popularity_score INTEGER DEFAULT 0,
  tax_category_id INTEGER REFERENCES tax_categories(id),
  image_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Staff management for access control and permissions
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL, -- "bartender", "manager", "server", "admin"
  permissions JSONB, -- JSON object of permissions
  hourly_rate INTEGER, -- Rate in cents
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  pin_code TEXT, -- For POS access
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_name TEXT,
  total_amount INTEGER NOT NULL DEFAULT 0, -- Total in cents
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  staff_id INTEGER REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  drink_id INTEGER NOT NULL REFERENCES drinks(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_per_unit INTEGER NOT NULL, -- Price in cents at time of order
  subtotal INTEGER NOT NULL, -- Subtotal in cents
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory movements for detailed tracking
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  drink_id INTEGER REFERENCES drinks(id),
  movement_type TEXT NOT NULL, -- 'sale', 'restock', 'waste', 'adjustment'
  quantity_change REAL NOT NULL, -- Can be positive or negative
  unit_type TEXT NOT NULL DEFAULT 'ounce',
  reason TEXT,
  staff_id INTEGER REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert some sample tax categories
INSERT INTO tax_categories (name, rate, type, description) VALUES
('Beer', '8.5', 'percentage', 'Standard beer tax rate'),
('Wine', '10.0', 'percentage', 'Standard wine tax rate'),
('Spirits', '15.0', 'percentage', 'Standard spirits tax rate')
ON CONFLICT DO NOTHING;

-- Insert sample drinks with inventory_oz
INSERT INTO drinks (name, category, subcategory, price, inventory, inventory_oz, unit_type, unit_volume_oz, serving_size_oz, cost_per_unit, description) VALUES
('Heineken', 'Beer', 'Lager', 650, 24, 288.0, 'bottle', 12.0, 12.0, 250, 'Premium Dutch lager'),
('Corona', 'Beer', 'Lager', 600, 36, 432.0, 'bottle', 12.0, 12.0, 230, 'Mexican beer with lime'),
('Stella Artois', 'Beer', 'Lager', 700, 18, 216.0, 'bottle', 12.0, 12.0, 280, 'Belgian premium lager'),
('Bud Light', 'Beer', 'Light', 550, 48, 576.0, 'bottle', 12.0, 12.0, 200, 'Light American beer'),
('IPA', 'Beer', 'IPA', 750, 12, 144.0, 'bottle', 12.0, 12.0, 320, 'India Pale Ale'),
('Chardonnay', 'Wine', 'White', 1200, 6, 144.0, 'bottle', 24.0, 6.0, 600, 'Crisp white wine'),
('Cabernet Sauvignon', 'Wine', 'Red', 1400, 8, 192.0, 'bottle', 24.0, 6.0, 700, 'Full-bodied red wine'),
('Vodka', 'Spirits', 'Vodka', 800, 2, 50.5, 'bottle', 25.3, 1.5, 400, 'Premium vodka'),
('Whiskey', 'Spirits', 'Whiskey', 900, 3, 75.9, 'bottle', 25.3, 1.5, 450, 'Aged whiskey'),
('Tequila', 'Spirits', 'Tequila', 850, 2, 50.6, 'bottle', 25.3, 1.5, 425, 'Premium tequila')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_drinks_name ON drinks(name);
CREATE INDEX IF NOT EXISTS idx_drinks_category ON drinks(category);
CREATE INDEX IF NOT EXISTS idx_drinks_active ON drinks(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_drink_id ON inventory_movements(drink_id);
