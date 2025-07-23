import { relations } from "drizzle-orm/relations";
import { taxCategories, drinks, customers, orders, staff, eventBookings, inventory, transactions, venues, pours } from "./schema";

export const drinksRelations = relations(drinks, ({one, many}) => ({
	taxCategory: one(taxCategories, {
		fields: [drinks.taxCategoryId],
		references: [taxCategories.id]
	}),
	inventories: many(inventory),
}));

export const taxCategoriesRelations = relations(taxCategories, ({many}) => ({
	drinks: many(drinks),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	customer: one(customers, {
		fields: [orders.customerId],
		references: [customers.id]
	}),
	staff: one(staff, {
		fields: [orders.staffId],
		references: [staff.id]
	}),
	eventBooking: one(eventBookings, {
		fields: [orders.eventBookingId],
		references: [eventBookings.id]
	}),
	transactions: many(transactions),
	pours: many(pours),
}));

export const customersRelations = relations(customers, ({many}) => ({
	orders: many(orders),
	eventBookings: many(eventBookings),
}));

export const staffRelations = relations(staff, ({many}) => ({
	orders: many(orders),
}));

export const eventBookingsRelations = relations(eventBookings, ({one, many}) => ({
	orders: many(orders),
	customer: one(customers, {
		fields: [eventBookings.customerId],
		references: [customers.id]
	}),
	venue: one(venues, {
		fields: [eventBookings.venueId],
		references: [venues.id]
	}),
}));

export const inventoryRelations = relations(inventory, ({one, many}) => ({
	drink: one(drinks, {
		fields: [inventory.drinkId],
		references: [drinks.id]
	}),
	pours: many(pours),
}));

export const transactionsRelations = relations(transactions, ({one}) => ({
	order: one(orders, {
		fields: [transactions.orderId],
		references: [orders.id]
	}),
}));

export const venuesRelations = relations(venues, ({many}) => ({
	eventBookings: many(eventBookings),
}));

export const poursRelations = relations(pours, ({one}) => ({
	inventory: one(inventory, {
		fields: [pours.inventoryId],
		references: [inventory.id]
	}),
	order: one(orders, {
		fields: [pours.orderId],
		references: [orders.id]
	}),
}));