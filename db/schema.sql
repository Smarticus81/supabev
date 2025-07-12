-- Beverage POS local database schema

-- Drinks table stores all beverages and their inventory in fluid ounces.
CREATE TABLE IF NOT EXISTS drinks (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  subcategory     TEXT,
  inventory_oz    REAL, -- Total inventory in fluid ounces. NULL for made-to-order items.
  unit_volume_oz  REAL, -- Volume of a standard unit (e.g., a bottle).
  image_url       TEXT,
  description     TEXT,
  sales_servings  INTEGER DEFAULT 0
);

-- Serving options define the different ways a drink can be sold.
CREATE TABLE IF NOT EXISTS serving_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  drink_id    TEXT NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
  name        TEXT NOT NULL, -- e.g., 'Shot', 'Double', 'Glass', 'Bottle'
  volume_oz   REAL NOT NULL, -- The volume of this specific serving.
  price       REAL NOT NULL
);

-- Orders table represents each POS transaction.
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT,
  package       TEXT,
  subtotal      REAL,
  tax           REAL,
  total         REAL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order items links a specific serving option to an order.
CREATE TABLE IF NOT EXISTS order_items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  serving_option_id  INTEGER NOT NULL REFERENCES serving_options(id),
  quantity           INTEGER NOT NULL,
  price              REAL    NOT NULL -- per-unit price at time of sale
); 