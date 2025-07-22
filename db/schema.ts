import { pgTable, text, serial, integer, timestamp, decimal, boolean, date, time, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Tax categories for state liquor/beer/wine compliance
export const taxCategories = pgTable("tax_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "Beer", "Wine", "Spirits"
  rate: text("rate").notNull(), // Tax rate as string to match existing data
  type: text("type").notNull(), // "per_pour", "percentage"
  description: text("description"),
  applies_to: jsonb("applies_to"), // JSON array of what this applies to
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

// Core drinks catalog
export const drinks = pgTable("drinks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  price: integer("price").notNull(), // Price in cents
  inventory: integer("inventory").notNull(), // Inventory count
  unit_volume_oz: real("unit_volume_oz"), // Volume of standard unit
  cost_per_unit: integer("cost_per_unit"), // Cost in cents
  profit_margin: real("profit_margin"), // Calculated profit margin
  popularity_score: integer("popularity_score").default(0),
  tax_category_id: integer("tax_category_id").references(() => taxCategories.id),
  image_url: text("image_url"),
  description: text("description"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Staff management for access control and permissions
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email").unique().notNull(),
  phone: text("phone"),
  role: text("role").notNull(), // "bartender", "manager", "server", "admin"
  permissions: jsonb("permissions"), // JSON object of permissions
  hourly_rate: integer("hourly_rate"), // Rate in cents
  hire_date: date("hire_date"),
  is_active: boolean("is_active").default(true),
  pin_code: text("pin_code"), // For POS access
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Venues for event management
export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip_code: text("zip_code"),
  capacity: integer("capacity"),
  indoor_capacity: integer("indoor_capacity"),
  outdoor_capacity: integer("outdoor_capacity"),
  amenities: jsonb("amenities"), // JSON array of amenities
  hourly_rate: integer("hourly_rate"), // Rate in cents
  daily_rate: integer("daily_rate"), // Rate in cents
  setup_time_hours: integer("setup_time_hours").default(2),
  cleanup_time_hours: integer("cleanup_time_hours").default(1),
  description: text("description"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Event packages for comprehensive event management
export const eventPackages = pgTable("event_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price_per_person: integer("price_per_person").notNull(), // Price in cents
  min_guests: integer("min_guests").notNull(),
  max_guests: integer("max_guests").notNull(),
  duration_hours: integer("duration_hours").default(4),
  included_drinks: integer("included_drinks").default(0),
  bar_service_included: boolean("bar_service_included").default(true),
  setup_included: boolean("setup_included").default(true),
  cleanup_included: boolean("cleanup_included").default(true),
  catering_included: boolean("catering_included").default(false),
  package_items: jsonb("package_items"), // JSON array of included items/services
  add_ons_available: jsonb("add_ons_available"), // JSON array of available add-ons
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Customers for event bookings and orders
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip_code: text("zip_code"),
  date_of_birth: date("date_of_birth"),
  preferences: jsonb("preferences"), // JSON object for customer preferences
  loyalty_points: integer("loyalty_points").default(0),
  total_spent: integer("total_spent").default(0), // In cents
  visit_count: integer("visit_count").default(0),
  last_visit: timestamp("last_visit"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Event bookings with comprehensive tracking
export const eventBookings = pgTable("event_bookings", {
  id: serial("id").primaryKey(),
  customer_id: integer("customer_id").references(() => customers.id),
  venue_id: integer("venue_id").references(() => venues.id),
  package_id: integer("package_id").references(() => eventPackages.id),
  event_name: text("event_name"),
  event_type: text("event_type"), // "wedding", "corporate", "birthday", etc.
  event_date: date("event_date").notNull(),
  start_time: time("start_time"),
  end_time: time("end_time"),
  guest_count: integer("guest_count").notNull(),
  base_price: integer("base_price"), // In cents
  add_ons_price: integer("add_ons_price").default(0), // In cents
  total_price: integer("total_price"), // In cents
  deposit_paid: integer("deposit_paid").default(0), // In cents
  balance_due: integer("balance_due"), // In cents
  status: text("status").notNull().default("pending"), // pending, confirmed, cancelled, completed
  special_requests: text("special_requests"),
  contract_signed: boolean("contract_signed").default(false),
  payment_schedule: jsonb("payment_schedule"), // JSON array of payment milestones
  assigned_staff: jsonb("assigned_staff"), // JSON array of staff IDs
  setup_notes: text("setup_notes"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Customer orders (combines orders + orderItems)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customer_id: integer("customer_id").references(() => customers.id),
  staff_id: integer("staff_id").references(() => staff.id),
  event_booking_id: integer("event_booking_id").references(() => eventBookings.id),
  order_number: text("order_number").unique(), // Human-readable order number
  items: jsonb("items").notNull(), // JSON array of [{drink_id, quantity, price, name}]
  subtotal: integer("subtotal").notNull(), // Subtotal in cents
  tax_amount: integer("tax_amount").notNull(), // Tax in cents
  total: integer("total").notNull(), // Total in cents
  payment_method: text("payment_method"),
  payment_status: text("payment_status").default("pending"), // pending, completed, failed, refunded
  status: text("status").notNull().default("pending"), // pending, processing, completed, cancelled
  table_number: text("table_number"),
  notes: text("notes"),
  discount_amount: integer("discount_amount").default(0), // Discount in cents
  tip_amount: integer("tip_amount").default(0), // Tip in cents
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Payment transactions with detailed tracking
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").references(() => orders.id),
  booking_id: integer("booking_id").references(() => eventBookings.id),
  transaction_type: text("transaction_type").notNull(), // "sale", "refund", "deposit", "payment"
  amount: integer("amount").notNull(), // Amount in cents
  payment_method: text("payment_method").notNull(),
  payment_processor: text("payment_processor"), // "stripe", "square", "cash", etc.
  processor_transaction_id: text("processor_transaction_id"),
  payment_details: jsonb("payment_details"), // JSON for payment processor details
  status: text("status").notNull().default("pending"), // pending, completed, failed, cancelled
  refund_amount: integer("refund_amount").default(0), // Refund amount in cents
  fees: integer("fees").default(0), // Processing fees in cents
  net_amount: integer("net_amount"), // Amount after fees in cents
  processed_at: timestamp("processed_at"),
  created_at: timestamp("created_at").defaultNow(),
});

// Inventory tracking for spirits/bottles with detailed management
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  drink_id: integer("drink_id").notNull().references(() => drinks.id),
  bottle_id: text("bottle_id").notNull().unique(), // Unique bottle identifier
  size_oz: real("size_oz").notNull(), // Total bottle size
  remaining_ml: text("remaining_ml").notNull(), // Remaining volume as string
  cost: integer("cost"), // Cost in cents
  vendor: text("vendor"),
  batch_number: text("batch_number"),
  expiry_date: date("expiry_date"),
  received_date: date("received_date").defaultNow(),
  opened_at: timestamp("opened_at"),
  finished_at: timestamp("finished_at"),
  status: text("status").default("unopened"), // unopened, opened, finished, expired, damaged
  location: text("location"), // Bar section/shelf location
  reorder_level: integer("reorder_level").default(5), // Auto-reorder threshold
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Pour tracking for compliance and cost control
export const pours = pgTable("pours", {
  id: serial("id").primaryKey(),
  inventory_id: integer("inventory_id").notNull().references(() => inventory.id),
  order_id: integer("order_id").references(() => orders.id),
  staff_id: integer("staff_id").references(() => staff.id),
  volume_ml: text("volume_ml").notNull(), // Volume as string (decimal storage)
  volume_oz: real("volume_oz"), // Volume in ounces
  cost_per_pour: integer("cost_per_pour"), // Cost in cents
  tax_amount: text("tax_amount"), // Calculated tax for this pour as string
  compliance_verified: boolean("compliance_verified").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

// Customer tabs for ongoing service tracking
export const customerTabs = pgTable("customer_tabs", {
  id: serial("id").primaryKey(),
  customer_id: integer("customer_id").references(() => customers.id),
  staff_id: integer("staff_id").references(() => staff.id),
  event_booking_id: integer("event_booking_id").references(() => eventBookings.id),
  tab_name: text("tab_name").notNull(), // "Table 5", "Wedding Party", etc.
  current_total: integer("current_total").default(0), // Running total in cents
  items: jsonb("items").default('[]'), // JSON array of tab items
  status: text("status").default("open"), // open, closed, transferred
  opened_at: timestamp("opened_at").defaultNow(),
  closed_at: timestamp("closed_at"),
  notes: text("notes"),
});

// Business analytics and insights
export const analyticsData = pgTable("analytics_data", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  metric_type: text("metric_type").notNull(), // "sales", "inventory", "customer", "staff"
  metric_name: text("metric_name").notNull(), // "daily_revenue", "top_seller", etc.
  value: text("value").notNull(), // JSON string for complex data
  metadata: jsonb("metadata"), // Additional context data
  created_at: timestamp("created_at").defaultNow(),
});

// Inventory movements for detailed tracking
export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  drink_id: integer("drink_id").references(() => drinks.id),
  inventory_id: integer("inventory_id").references(() => inventory.id),
  staff_id: integer("staff_id").references(() => staff.id),
  movement_type: text("movement_type").notNull(), // "purchase", "sale", "waste", "restock", "adjustment"
  quantity_change: integer("quantity_change").notNull(), // Positive or negative
  cost_impact: integer("cost_impact"), // Cost impact in cents
  reason: text("reason"),
  reference_id: integer("reference_id"), // Reference to order, booking, etc.
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
});

// AI insights and recommendations
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  insight_type: text("insight_type").notNull(), // "sales_prediction", "inventory_optimization", "customer_behavior"
  title: text("title").notNull(),
  description: text("description").notNull(),
  confidence_score: real("confidence_score"), // 0-1 confidence rating
  data_points: jsonb("data_points"), // Supporting data
  recommendations: jsonb("recommendations"), // JSON array of recommended actions
  status: text("status").default("active"), // active, implemented, dismissed
  priority: text("priority").default("medium"), // low, medium, high, critical
  expires_at: timestamp("expires_at"),
  created_at: timestamp("created_at").defaultNow(),
});

// System configuration
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  config_key: text("config_key").unique().notNull(),
  config_value: text("config_value").notNull(),
  config_type: text("config_type").default("string"), // string, number, boolean, json
  description: text("description"),
  is_sensitive: boolean("is_sensitive").default(false), // For API keys, etc.
  updated_by: integer("updated_by").references(() => staff.id),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Audit log for comprehensive tracking
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => staff.id),
  user_type: text("user_type").default("staff"), // staff, customer, system, voice_assistant
  action: text("action").notNull(),
  table_name: text("table_name"),
  record_id: text("record_id"),
  old_values: jsonb("old_values"),
  new_values: jsonb("new_values"),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  session_id: text("session_id"),
  created_at: timestamp("created_at").defaultNow(),
});

// Relations
export const orderRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customer_id],
    references: [customers.id],
  }),
  staff: one(staff, {
    fields: [orders.staff_id],
    references: [staff.id],
  }),
  eventBooking: one(eventBookings, {
    fields: [orders.event_booking_id],
    references: [eventBookings.id],
  }),
  transactions: many(transactions),
  pours: many(pours),
}));

export const drinkRelations = relations(drinks, ({ one, many }) => ({
  taxCategory: one(taxCategories, {
    fields: [drinks.tax_category_id],
    references: [taxCategories.id],
  }),
  inventory: many(inventory),
  pours: many(pours),
  inventoryMovements: many(inventoryMovements),
}));

export const staffRelations = relations(staff, ({ many }) => ({
  orders: many(orders),
  pours: many(pours),
  customerTabs: many(customerTabs),
  inventoryMovements: many(inventoryMovements),
  auditLogs: many(auditLog),
}));

export const customerRelations = relations(customers, ({ many }) => ({
  eventBookings: many(eventBookings),
  orders: many(orders),
  customerTabs: many(customerTabs),
}));

export const venueRelations = relations(venues, ({ many }) => ({
  eventBookings: many(eventBookings),
}));

export const eventPackageRelations = relations(eventPackages, ({ many }) => ({
  eventBookings: many(eventBookings),
}));

export const eventBookingRelations = relations(eventBookings, ({ one, many }) => ({
  customer: one(customers, {
    fields: [eventBookings.customer_id],
    references: [customers.id],
  }),
  venue: one(venues, {
    fields: [eventBookings.venue_id],
    references: [venues.id],
  }),
  package: one(eventPackages, {
    fields: [eventBookings.package_id],
    references: [eventPackages.id],
  }),
  orders: many(orders),
  transactions: many(transactions),
  customerTabs: many(customerTabs),
}));

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  drink: one(drinks, {
    fields: [inventory.drink_id],
    references: [drinks.id],
  }),
  pours: many(pours),
  inventoryMovements: many(inventoryMovements),
}));

export const pourRelations = relations(pours, ({ one }) => ({
  inventory: one(inventory, {
    fields: [pours.inventory_id],
    references: [inventory.id],
  }),
  order: one(orders, {
    fields: [pours.order_id],
    references: [orders.id],
  }),
  staff: one(staff, {
    fields: [pours.staff_id],
    references: [staff.id],
  }),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  order: one(orders, {
    fields: [transactions.order_id],
    references: [orders.id],
  }),
  booking: one(eventBookings, {
    fields: [transactions.booking_id],
    references: [eventBookings.id],
  }),
}));

export const taxCategoryRelations = relations(taxCategories, ({ many }) => ({
  drinks: many(drinks),
}));

export const customerTabRelations = relations(customerTabs, ({ one }) => ({
  customer: one(customers, {
    fields: [customerTabs.customer_id],
    references: [customers.id],
  }),
  staff: one(staff, {
    fields: [customerTabs.staff_id],
    references: [staff.id],
  }),
  eventBooking: one(eventBookings, {
    fields: [customerTabs.event_booking_id],
    references: [eventBookings.id],
  }),
}));

export const inventoryMovementRelations = relations(inventoryMovements, ({ one }) => ({
  drink: one(drinks, {
    fields: [inventoryMovements.drink_id],
    references: [drinks.id],
  }),
  inventory: one(inventory, {
    fields: [inventoryMovements.inventory_id],
    references: [inventory.id],
  }),
  staff: one(staff, {
    fields: [inventoryMovements.staff_id],
    references: [staff.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(staff, {
    fields: [auditLog.user_id],
    references: [staff.id],
  }),
}));

export const systemConfigRelations = relations(systemConfig, ({ one }) => ({
  updatedBy: one(staff, {
    fields: [systemConfig.updated_by],
    references: [staff.id],
  }),
}));

// Types
export type Drink = typeof drinks.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type EventPackage = typeof eventPackages.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type EventBooking = typeof eventBookings.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Pour = typeof pours.$inferSelect;
export type TaxCategory = typeof taxCategories.$inferSelect;
export type CustomerTab = typeof customerTabs.$inferSelect;
export type AnalyticsData = typeof analyticsData.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type AiInsight = typeof aiInsights.$inferSelect;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;

// Insert types
export type NewDrink = typeof drinks.$inferInsert;
export type NewStaff = typeof staff.$inferInsert;
export type NewVenue = typeof venues.$inferInsert;
export type NewEventPackage = typeof eventPackages.$inferInsert;
export type NewCustomer = typeof customers.$inferInsert;
export type NewEventBooking = typeof eventBookings.$inferInsert;
export type NewOrder = typeof orders.$inferInsert;
export type NewTransaction = typeof transactions.$inferInsert;
export type NewInventory = typeof inventory.$inferInsert;
export type NewPour = typeof pours.$inferInsert;
export type NewTaxCategory = typeof taxCategories.$inferInsert;
export type NewCustomerTab = typeof customerTabs.$inferInsert;
export type NewAnalyticsData = typeof analyticsData.$inferInsert;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type NewAiInsight = typeof aiInsights.$inferInsert;
export type NewSystemConfig = typeof systemConfig.$inferInsert;
export type NewAuditLog = typeof auditLog.$inferInsert;

// Schemas
export const insertDrinkSchema = createInsertSchema(drinks);
export const selectDrinkSchema = createSelectSchema(drinks);
export const insertStaffSchema = createInsertSchema(staff);
export const selectStaffSchema = createSelectSchema(staff);
export const insertVenueSchema = createInsertSchema(venues);
export const selectVenueSchema = createSelectSchema(venues);
export const insertEventPackageSchema = createInsertSchema(eventPackages);
export const selectEventPackageSchema = createSelectSchema(eventPackages);
export const insertCustomerSchema = createInsertSchema(customers);
export const selectCustomerSchema = createSelectSchema(customers);
export const insertEventBookingSchema = createInsertSchema(eventBookings);
export const selectEventBookingSchema = createSelectSchema(eventBookings);
export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
export const insertTransactionSchema = createInsertSchema(transactions);
export const selectTransactionSchema = createSelectSchema(transactions);
export const insertInventorySchema = createInsertSchema(inventory);
export const selectInventorySchema = createSelectSchema(inventory);
export const insertPourSchema = createInsertSchema(pours);
export const selectPourSchema = createSelectSchema(pours);
export const insertTaxCategorySchema = createInsertSchema(taxCategories);
export const selectTaxCategorySchema = createSelectSchema(taxCategories);
export const insertCustomerTabSchema = createInsertSchema(customerTabs);
export const selectCustomerTabSchema = createSelectSchema(customerTabs);
export const insertAnalyticsDataSchema = createInsertSchema(analyticsData);
export const selectAnalyticsDataSchema = createSelectSchema(analyticsData);
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements);
export const selectInventoryMovementSchema = createSelectSchema(inventoryMovements);
export const insertAiInsightSchema = createInsertSchema(aiInsights);
export const selectAiInsightSchema = createSelectSchema(aiInsights);
export const insertSystemConfigSchema = createInsertSchema(systemConfig);
export const selectSystemConfigSchema = createSelectSchema(systemConfig);
export const insertAuditLogSchema = createInsertSchema(auditLog);
export const selectAuditLogSchema = createSelectSchema(auditLog);
