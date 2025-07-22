-- Beverage POS comprehensive business management database schema

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
  sales_servings  INTEGER DEFAULT 0,
  tax_category_id INTEGER REFERENCES tax_categories(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Serving options define the different ways a drink can be sold.
CREATE TABLE IF NOT EXISTS serving_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  drink_id    TEXT NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
  name        TEXT NOT NULL, -- e.g., 'Shot', 'Double', 'Glass', 'Bottle'
  volume_oz   REAL NOT NULL, -- The volume of this specific serving.
  price       REAL NOT NULL
);

-- Customers table for customer relationship management
CREATE TABLE IF NOT EXISTS customers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip_code        TEXT,
  date_of_birth   DATE,
  preferences     TEXT, -- JSON string for customer preferences
  loyalty_points  INTEGER DEFAULT 0,
  total_spent     REAL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Venues table for location management
CREATE TABLE IF NOT EXISTS venues (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  address         TEXT NOT NULL,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  zip_code        TEXT,
  capacity        INTEGER,
  indoor_capacity INTEGER,
  outdoor_capacity INTEGER,
  amenities       TEXT, -- JSON string for amenities list
  hourly_rate     REAL,
  daily_rate      REAL,
  is_active       BOOLEAN DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Event packages for event management
CREATE TABLE IF NOT EXISTS event_packages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  description     TEXT,
  base_price      REAL NOT NULL,
  duration_hours  INTEGER DEFAULT 4,
  max_guests      INTEGER,
  included_drinks INTEGER DEFAULT 0, -- Number of drinks included
  bar_service     BOOLEAN DEFAULT 1,
  setup_included  BOOLEAN DEFAULT 1,
  cleanup_included BOOLEAN DEFAULT 1,
  is_active       BOOLEAN DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Event bookings for reservation system
CREATE TABLE IF NOT EXISTS event_bookings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER REFERENCES customers(id),
  venue_id        INTEGER REFERENCES venues(id),
  package_id      INTEGER REFERENCES event_packages(id),
  event_name      TEXT,
  event_date      DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  guest_count     INTEGER,
  total_price     REAL,
  deposit_paid    REAL DEFAULT 0,
  balance_due     REAL,
  status          TEXT DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  special_requests TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tax categories for compliance management
CREATE TABLE IF NOT EXISTS tax_categories (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  rate            REAL NOT NULL, -- Tax rate as decimal (0.08 for 8%)
  description     TEXT,
  applies_to      TEXT, -- JSON string for what this tax applies to
  is_active       BOOLEAN DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders table represents each POS transaction.
CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER REFERENCES customers(id),
  customer_name   TEXT,
  package         TEXT,
  subtotal        REAL,
  tax             REAL,
  total           REAL,
  payment_method  TEXT DEFAULT 'cash',
  status          TEXT DEFAULT 'completed',
  server_name     TEXT DEFAULT 'Bev AI',
  table_number    TEXT,
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order items links a specific serving option to an order.
CREATE TABLE IF NOT EXISTS order_items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  serving_option_id  INTEGER NOT NULL REFERENCES serving_options(id),
  drink_name         TEXT NOT NULL,
  serving_name       TEXT DEFAULT 'bottle',
  quantity           INTEGER NOT NULL,
  price              REAL NOT NULL -- per-unit price at time of sale
);

-- Transactions table for detailed financial tracking
CREATE TABLE IF NOT EXISTS transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER REFERENCES orders(id),
  booking_id      INTEGER REFERENCES event_bookings(id),
  transaction_type TEXT NOT NULL, -- 'sale', 'refund', 'deposit', 'payment'
  amount          REAL NOT NULL,
  payment_method  TEXT NOT NULL,
  payment_details TEXT, -- JSON for payment processor details
  status          TEXT DEFAULT 'completed',
  processed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory tracking for bottle-level management
CREATE TABLE IF NOT EXISTS bottle_inventory (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  drink_id        TEXT REFERENCES drinks(id),
  bottle_number   TEXT UNIQUE,
  size_oz         REAL NOT NULL,
  cost            REAL,
  vendor          TEXT,
  batch_number    TEXT,
  expiry_date     DATE,
  received_date   DATE DEFAULT CURRENT_DATE,
  opened_date     DATE,
  finished_date   DATE,
  status          TEXT DEFAULT 'unopened', -- unopened, opened, finished, expired
  location        TEXT, -- Bar section/shelf location
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pour tracking for compliance (spirits regulation)
CREATE TABLE IF NOT EXISTS pour_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bottle_id       INTEGER REFERENCES bottle_inventory(id),
  drink_id        TEXT REFERENCES drinks(id),
  order_id        INTEGER REFERENCES orders(id),
  volume_oz       REAL NOT NULL,
  server_name     TEXT,
  timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
  compliance_note TEXT
);

-- Payment methods configuration
CREATE TABLE IF NOT EXISTS payment_methods (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL, -- 'cash', 'card', 'digital', 'check'
  is_active       BOOLEAN DEFAULT 1,
  processing_fee  REAL DEFAULT 0,
  configuration   TEXT, -- JSON for payment processor config
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System configuration for TTS and other settings
CREATE TABLE IF NOT EXISTS system_config (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key      TEXT UNIQUE NOT NULL,
  config_value    TEXT NOT NULL,
  config_type     TEXT DEFAULT 'string', -- string, number, boolean, json
  description     TEXT,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for tracking all system operations
CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT, -- System user or 'voice_assistant'
  action          TEXT NOT NULL,
  table_name      TEXT,
  record_id       TEXT,
  old_values      TEXT, -- JSON of old values
  new_values      TEXT, -- JSON of new values
  ip_address      TEXT,
  user_agent      TEXT,
  timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_drinks_category ON drinks(category);
CREATE INDEX IF NOT EXISTS idx_drinks_name ON drinks(name);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_event_bookings_date ON event_bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_bottle_inventory_status ON bottle_inventory(status);
CREATE INDEX IF NOT EXISTS idx_pour_records_timestamp ON pour_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Insert default tax categories
INSERT OR IGNORE INTO tax_categories (name, rate, description, applies_to) VALUES 
('Standard Sales Tax', 0.08, 'Standard Texas sales tax rate', '["all"]'),
('Alcohol Tax', 0.10, 'Additional tax for alcoholic beverages', '["alcohol"]'),
('Event Tax', 0.06, 'Reduced tax rate for event services', '["events"]');

-- Insert default payment methods
INSERT OR IGNORE INTO payment_methods (name, type, is_active) VALUES 
('Cash', 'cash', 1),
('Credit Card', 'card', 1),
('Debit Card', 'card', 1),
('Apple Pay', 'digital', 1),
('Google Pay', 'digital', 1),
('Venmo', 'digital', 1),
('Check', 'check', 1);

-- Insert default system configuration
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES 
('tts_provider', 'openai', 'string', 'Text-to-speech provider'),
('tts_voice_id', 'alloy', 'string', 'Default TTS voice ID'),
('tts_speed', '1.4', 'number', 'TTS playback speed (1.4x faster)'),
('default_tax_rate', '0.08', 'number', 'Default tax rate for orders'),
('low_inventory_threshold', '5', 'number', 'Alert threshold for low inventory'),
('business_hours_start', '10:00', 'string', 'Business opening time'),
('business_hours_end', '23:00', 'string', 'Business closing time'),
('currency_symbol', '$', 'string', 'Currency symbol for display'),
('max_cart_items', '50', 'number', 'Maximum items allowed in cart'); 