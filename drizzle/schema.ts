import { pgTable, serial, text, integer, timestamp, unique, jsonb, date, boolean, real, foreignKey, numeric, time, pgView, bigint, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const assetMovementType = pgEnum("asset_movement_type", ['use', 'clean', 'break', 'waste', 'lost'])
export const barTabStatus = pgEnum("bar_tab_status", ['open', 'closed', 'voided'])
export const eventBookingStatus = pgEnum("event_booking_status", ['pending', 'confirmed', 'cancelled', 'completed'])
export const orderStatus = pgEnum("order_status", ['pending_approval', 'approved', 'shipped', 'received', 'cancelled'])
export const transactionStatus = pgEnum("transaction_status", ['pending', 'completed', 'failed', 'refunded'])


export const eventPackages = pgTable("event_packages", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	price: integer().notNull(),
	durationHours: integer("duration_hours").notNull(),
	maxGuests: integer("max_guests"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const drizzleMigrations = pgTable("__drizzle_migrations", {
	id: serial().primaryKey().notNull(),
	hash: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const staff = pgTable("staff", {
	id: serial().primaryKey().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	email: text().notNull(),
	phone: text(),
	role: text().notNull(),
	permissions: jsonb(),
	hourlyRate: integer("hourly_rate"),
	hireDate: date("hire_date"),
	isActive: boolean("is_active").default(true),
	pinCode: text("pin_code"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("staff_email_unique").on(table.email),
]);

export const customerTabs = pgTable("customer_tabs", {
	id: serial().primaryKey().notNull(),
	customerId: integer("customer_id"),
	staffId: integer("staff_id"),
	eventBookingId: integer("event_booking_id"),
	tabName: text("tab_name").notNull(),
	currentTotal: integer("current_total").default(0),
	items: jsonb().default([]),
	status: text().default('open'),
	openedAt: timestamp("opened_at", { mode: 'string' }).defaultNow(),
	closedAt: timestamp("closed_at", { mode: 'string' }),
	notes: text(),
});

export const inventoryMovements = pgTable("inventory_movements", {
	id: serial().primaryKey().notNull(),
	drinkId: integer("drink_id"),
	inventoryId: integer("inventory_id"),
	staffId: integer("staff_id"),
	movementType: text("movement_type").notNull(),
	quantityChange: integer("quantity_change").notNull(),
	costImpact: integer("cost_impact"),
	reason: text(),
	referenceId: integer("reference_id"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const systemConfig = pgTable("system_config", {
	id: serial().primaryKey().notNull(),
	configKey: text("config_key").notNull(),
	configValue: text("config_value").notNull(),
	configType: text("config_type").default('string'),
	description: text(),
	isSensitive: boolean("is_sensitive").default(false),
	updatedBy: integer("updated_by"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("system_config_config_key_unique").on(table.configKey),
]);

export const analyticsData = pgTable("analytics_data", {
	id: serial().primaryKey().notNull(),
	date: date().notNull(),
	metricType: text("metric_type").notNull(),
	metricName: text("metric_name").notNull(),
	value: text().notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const aiInsights = pgTable("ai_insights", {
	id: serial().primaryKey().notNull(),
	insightType: text("insight_type").notNull(),
	title: text().notNull(),
	description: text().notNull(),
	confidenceScore: real("confidence_score"),
	dataPoints: jsonb("data_points"),
	recommendations: jsonb(),
	status: text().default('active'),
	priority: text().default('medium'),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const auditLog = pgTable("audit_log", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	userType: text("user_type").default('staff'),
	action: text().notNull(),
	tableName: text("table_name"),
	recordId: text("record_id"),
	oldValues: jsonb("old_values"),
	newValues: jsonb("new_values"),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	sessionId: text("session_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const drinks = pgTable("drinks", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	category: text().notNull(),
	price: integer().notNull(),
	inventory: integer().default(0).notNull(),
	taxCategoryId: integer("tax_category_id"),
	subcategory: text(),
	unitVolumeOz: real("unit_volume_oz"),
	costPerUnit: integer("cost_per_unit"),
	profitMargin: real("profit_margin"),
	popularityScore: integer("popularity_score").default(0),
	imageUrl: text("image_url"),
	description: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	unitType: text("unit_type").default('ounce').notNull(),
	servingSizeOz: real("serving_size_oz"),
	servingsPerContainer: integer("servings_per_container"),
}, (table) => [
	foreignKey({
			columns: [table.taxCategoryId],
			foreignColumns: [taxCategories.id],
			name: "drinks_tax_category_id_fkey"
		}),
]);

export const taxCategories = pgTable("tax_categories", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	rate: numeric().notNull(),
	type: text().notNull(),
	description: text(),
});

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	items: jsonb().notNull(),
	total: integer().notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	subtotal: integer().default(0).notNull(),
	taxAmount: integer("tax_amount").default(0).notNull(),
	customerId: integer("customer_id"),
	staffId: integer("staff_id"),
	eventBookingId: integer("event_booking_id"),
	orderNumber: text("order_number"),
	paymentMethod: text("payment_method"),
	paymentStatus: text("payment_status").default('pending'),
	tableNumber: text("table_number"),
	notes: text(),
	discountAmount: integer("discount_amount").default(0),
	tipAmount: integer("tip_amount").default(0),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "orders_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.staffId],
			foreignColumns: [staff.id],
			name: "orders_staff_id_staff_id_fk"
		}),
	foreignKey({
			columns: [table.eventBookingId],
			foreignColumns: [eventBookings.id],
			name: "orders_event_booking_id_event_bookings_id_fk"
		}),
	unique("orders_order_number_unique").on(table.orderNumber),
]);

export const inventory = pgTable("inventory", {
	id: serial().primaryKey().notNull(),
	drinkId: integer("drink_id").notNull(),
	bottleId: text("bottle_id").notNull(),
	remainingMl: numeric("remaining_ml").notNull(),
	openedAt: timestamp("opened_at", { mode: 'string' }).defaultNow(),
	sizeOz: real("size_oz").default(750).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.drinkId],
			foreignColumns: [drinks.id],
			name: "inventory_drink_id_fkey"
		}),
]);

export const customers = pgTable("customers", {
	id: serial().primaryKey().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	email: text(),
	phone: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	address: text(),
	city: text(),
	state: text(),
	zipCode: text("zip_code"),
	dateOfBirth: date("date_of_birth"),
	preferences: jsonb(),
	loyaltyPoints: integer("loyalty_points").default(0),
	totalSpent: integer("total_spent").default(0),
	visitCount: integer("visit_count").default(0),
	lastVisit: timestamp("last_visit", { mode: 'string' }),
	notes: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const transactions = pgTable("transactions", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id").notNull(),
	amount: integer().notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	transactionType: text("transaction_type").default('sale').notNull(),
	paymentMethod: text("payment_method").default('cash').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "transactions_order_id_fkey"
		}),
]);

export const venues = pgTable("venues", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	address: text().notNull(),
	capacity: integer().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	city: text().default('Unknown').notNull(),
	state: text().default('TX').notNull(),
	zipCode: text("zip_code"),
	indoorCapacity: integer("indoor_capacity"),
	outdoorCapacity: integer("outdoor_capacity"),
	amenities: jsonb(),
	hourlyRate: integer("hourly_rate"),
	dailyRate: integer("daily_rate"),
	setupTimeHours: integer("setup_time_hours").default(2),
	cleanupTimeHours: integer("cleanup_time_hours").default(1),
	isActive: boolean("is_active").default(true),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const eventBookings = pgTable("event_bookings", {
	id: serial().primaryKey().notNull(),
	customerId: integer("customer_id"),
	venueId: integer("venue_id"),
	guestCount: integer("guest_count").notNull(),
	eventDate: timestamp("event_date", { mode: 'string' }).notNull(),
	status: text().default('pending').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	packageId: integer("package_id"),
	eventName: text("event_name"),
	eventType: text("event_type"),
	startTime: time("start_time"),
	endTime: time("end_time"),
	basePrice: integer("base_price"),
	addOnsPrice: integer("add_ons_price").default(0),
	totalPrice: integer("total_price"),
	depositPaid: integer("deposit_paid").default(0),
	balanceDue: integer("balance_due"),
	specialRequests: text("special_requests"),
	contractSigned: boolean("contract_signed").default(false),
	paymentSchedule: jsonb("payment_schedule"),
	assignedStaff: jsonb("assigned_staff"),
	setupNotes: text("setup_notes"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "event_bookings_customer_id_fkey"
		}),
	foreignKey({
			columns: [table.venueId],
			foreignColumns: [venues.id],
			name: "event_bookings_venue_id_fkey"
		}),
]);

export const pours = pgTable("pours", {
	id: serial().primaryKey().notNull(),
	inventoryId: integer("inventory_id").notNull(),
	volumeMl: numeric("volume_ml").notNull(),
	taxAmount: numeric("tax_amount"),
	orderId: integer("order_id"),
}, (table) => [
	foreignKey({
			columns: [table.inventoryId],
			foreignColumns: [inventory.id],
			name: "pours_inventory_id_fkey"
		}),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "pours_order_id_fkey"
		}),
]);
export const drinksConsolidated = pgView("drinks_consolidated", {	id: integer(),
	name: text(),
	category: text(),
	subcategory: text(),
	price: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inventory: bigint({ mode: "number" }),
	unitVolumeOz: real("unit_volume_oz"),
	costPerUnit: integer("cost_per_unit"),
	profitMargin: real("profit_margin"),
	popularityScore: integer("popularity_score"),
	taxCategoryId: integer("tax_category_id"),
	imageUrl: text("image_url"),
	description: text(),
	isActive: boolean("is_active"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}).as(sql`SELECT min(id) AS id, name, category, subcategory, min(price) AS price, sum(inventory) AS inventory, max(unit_volume_oz) AS unit_volume_oz, max(cost_per_unit) AS cost_per_unit, max(profit_margin) AS profit_margin, max(popularity_score) AS popularity_score, max(tax_category_id) AS tax_category_id, max(image_url) AS image_url, max(description) AS description, bool_and(is_active) AS is_active, max(created_at) AS created_at, max(updated_at) AS updated_at FROM drinks GROUP BY name, category, subcategory ORDER BY category, name`);