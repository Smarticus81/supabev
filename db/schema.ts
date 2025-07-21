import { pgTable, text, serial, integer, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Tax categories for state liquor/beer/wine compliance
export const taxCategories = pgTable("tax_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "Beer", "Wine", "Spirits"
  rate: text("rate").notNull(), // Tax rate as string to match existing data
  type: text("type").notNull(), // "per_pour", "percentage"
  description: text("description"),
});

// Core drinks catalog
export const drinks = pgTable("drinks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(), // Price in cents
  inventory: integer("inventory").notNull(), // Inventory count
  tax_category_id: integer("tax_category_id").references(() => taxCategories.id),
});

// Customer orders (combines orders + orderItems)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  items: text("items").notNull(), // JSON string of [{drink_id, quantity, price}]
  total: integer("total").notNull(), // Total in cents
  status: text("status").notNull().default("pending"), // pending, completed, cancelled
  created_at: timestamp("created_at").defaultNow(),
});

// Payment transactions 
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull().references(() => orders.id),
  amount: integer("amount").notNull(), // Amount in cents
  status: text("status").notNull().default("pending"), // pending, completed, failed
  created_at: timestamp("created_at").defaultNow(),
});

// Inventory tracking for spirits/bottles
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  drink_id: integer("drink_id").notNull().references(() => drinks.id),
  bottle_id: text("bottle_id").notNull().unique(), // Unique bottle identifier
  remaining_ml: text("remaining_ml").notNull(), // Remaining volume as string (decimal storage)
  opened_at: timestamp("opened_at").defaultNow(),
});

// Pour tracking for compliance
export const pours = pgTable("pours", {
  id: serial("id").primaryKey(),
  inventory_id: integer("inventory_id").notNull().references(() => inventory.id),
  volume_ml: text("volume_ml").notNull(), // Volume as string (decimal storage)
  tax_amount: text("tax_amount"), // Calculated tax for this pour as string
  order_id: integer("order_id").references(() => orders.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Customers for event bookings and orders
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email").unique(), // Make email unique
  phone: text("phone").unique(), // Make phone unique
  created_at: timestamp("created_at").defaultNow(),
});

// Venues for event management
export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  capacity: integer("capacity"), // Remove notNull() to make it optional
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
});

// Event bookings from customers - UPDATED to remove package references
export const eventBookings = pgTable("event_bookings", {
  id: serial("id").primaryKey(),
  customer_id: integer("customer_id").references(() => customers.id), // nullable customer reference
  venue_id: integer("venue_id").references(() => venues.id), // nullable venue reference
  guest_count: integer("guest_count").notNull(),
  event_date: timestamp("event_date").notNull(),
  status: text("status").notNull().default("pending"), // pending, confirmed, cancelled, completed
  notes: text("notes"), // Add notes field
  created_at: timestamp("created_at").defaultNow(),
});

// Relations
export const orderRelations = relations(orders, ({ many }) => ({
  transactions: many(transactions),
}));

export const drinkRelations = relations(drinks, ({ one, many }) => ({
  taxCategory: one(taxCategories, {
    fields: [drinks.tax_category_id],
    references: [taxCategories.id],
  }),
  inventory: many(inventory),
  pours: many(pours),
}));

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  drink: one(drinks, {
    fields: [inventory.drink_id],
    references: [drinks.id],
  }),
  pours: many(pours),
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
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  order: one(orders, {
    fields: [transactions.order_id],
    references: [orders.id],
  }),
}));

export const taxCategoryRelations = relations(taxCategories, ({ many }) => ({
  drinks: many(drinks),
}));

export const eventBookingRelations = relations(eventBookings, ({ one }) => ({
  customer: one(customers, {
    fields: [eventBookings.customer_id],
    references: [customers.id],
  }),
  venue: one(venues, {
    fields: [eventBookings.venue_id],
    references: [venues.id],
  }),
}));

export const customerRelations = relations(customers, ({ many }) => ({
  eventBookings: many(eventBookings),
}));

export const venueRelations = relations(venues, ({ many }) => ({
  eventBookings: many(eventBookings),
}));

// Types
export type Drink = typeof drinks.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Pour = typeof pours.$inferSelect;
export type TaxCategory = typeof taxCategories.$inferSelect;
export type EventBooking = typeof eventBookings.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Venue = typeof venues.$inferSelect;

// Insert types
export type NewDrink = typeof drinks.$inferInsert;
export type NewOrder = typeof orders.$inferInsert;
export type NewTransaction = typeof transactions.$inferInsert;
export type NewInventory = typeof inventory.$inferInsert;
export type NewPour = typeof pours.$inferInsert;
export type NewTaxCategory = typeof taxCategories.$inferInsert;
export type NewEventBooking = typeof eventBookings.$inferInsert;
export type NewCustomer = typeof customers.$inferInsert;
export type NewVenue = typeof venues.$inferInsert;

// Schemas
export const insertDrinkSchema = createInsertSchema(drinks);
export const selectDrinkSchema = createSelectSchema(drinks);
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
export const insertEventBookingSchema = createInsertSchema(eventBookings);
export const selectEventBookingSchema = createSelectSchema(eventBookings);
export const insertCustomerSchema = createInsertSchema(customers);
export const selectCustomerSchema = createSelectSchema(customers);
export const insertVenueSchema = createInsertSchema(venues);
export const selectVenueSchema = createSelectSchema(venues);
