import db from '../../../db/index';
import { eventPackages } from '../../../db/schema';
import { desc, eq, asc } from 'drizzle-orm';

export async function GET() {
  try {
    const allPackages = await db
      .select({
        id: eventPackages.id,
        name: eventPackages.name,
        description: eventPackages.description,
        price_per_person: eventPackages.price_per_person,
        min_guests: eventPackages.min_guests,
        max_guests: eventPackages.max_guests,
        duration_hours: eventPackages.duration_hours,
        included_drinks: eventPackages.included_drinks,
        bar_service_included: eventPackages.bar_service_included,
        setup_included: eventPackages.setup_included,
        cleanup_included: eventPackages.cleanup_included,
        catering_included: eventPackages.catering_included,
        package_items: eventPackages.package_items,
        add_ons_available: eventPackages.add_ons_available,
        is_active: eventPackages.is_active,
        created_at: eventPackages.created_at,
        updated_at: eventPackages.updated_at,
      })
      .from(eventPackages)
      .where(eq(eventPackages.is_active, true))
      .orderBy(asc(eventPackages.price_per_person));

    // Format packages for display
    const formattedPackages = allPackages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price_per_person: pkg.price_per_person / 100, // Convert from cents
      min_guests: pkg.min_guests,
      max_guests: pkg.max_guests,
      duration_hours: pkg.duration_hours,
      included_drinks: pkg.included_drinks,
      services: {
        bar_service: pkg.bar_service_included,
        setup: pkg.setup_included,
        cleanup: pkg.cleanup_included,
        catering: pkg.catering_included,
      },
      package_items: pkg.package_items || [],
      add_ons_available: pkg.add_ons_available || [],
      is_active: pkg.is_active,
      created_at: pkg.created_at,
      updated_at: pkg.updated_at,
    }));

    return new Response(JSON.stringify(formattedPackages), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to fetch event packages:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch event packages' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      price_per_person,
      min_guests,
      max_guests,
      duration_hours,
      included_drinks,
      bar_service_included,
      setup_included,
      cleanup_included,
      catering_included,
      package_items,
      add_ons_available
    } = body;

    const newPackage = await db.insert(eventPackages).values({
      name,
      description,
      price_per_person: Math.round(price_per_person * 100), // Convert to cents
      min_guests,
      max_guests,
      duration_hours: duration_hours || 4,
      included_drinks: included_drinks || 0,
      bar_service_included: bar_service_included !== false,
      setup_included: setup_included !== false,
      cleanup_included: cleanup_included !== false,
      catering_included: catering_included || false,
      package_items: package_items || [],
      add_ons_available: add_ons_available || [],
      is_active: true,
    }).returning();

    return new Response(JSON.stringify(newPackage[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to create event package:', error);
    return new Response(JSON.stringify({ error: 'Failed to create event package' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 