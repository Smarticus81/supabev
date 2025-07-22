import db from '../../../db/index';
import { staff } from '../../../db/schema';
import { desc, eq, asc } from 'drizzle-orm';

export async function GET() {
  try {
    const allStaff = await db
      .select({
        id: staff.id,
        first_name: staff.first_name,
        last_name: staff.last_name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        permissions: staff.permissions,
        hourly_rate: staff.hourly_rate,
        hire_date: staff.hire_date,
        is_active: staff.is_active,
        pin_code: staff.pin_code,
        created_at: staff.created_at,
        updated_at: staff.updated_at,
      })
      .from(staff)
      .where(eq(staff.is_active, true))
      .orderBy(asc(staff.last_name), asc(staff.first_name));

    // Format staff data for display
    const formattedStaff = allStaff.map(member => ({
      id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      permissions: member.permissions,
      hourly_rate: member.hourly_rate ? member.hourly_rate / 100 : null, // Convert from cents
      hire_date: member.hire_date,
      is_active: member.is_active,
      has_pin: !!member.pin_code,
      created_at: member.created_at,
      updated_at: member.updated_at,
    }));

    return new Response(JSON.stringify(formattedStaff), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to fetch staff:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch staff' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      first_name,
      last_name,
      email,
      phone,
      role,
      permissions,
      hourly_rate,
      hire_date,
      pin_code
    } = body;

    const newStaff = await db.insert(staff).values({
      first_name,
      last_name,
      email,
      phone,
      role,
      permissions: permissions || {},
      hourly_rate: hourly_rate ? Math.round(hourly_rate * 100) : null, // Convert to cents
      hire_date: hire_date || new Date().toISOString().split('T')[0],
      pin_code,
      is_active: true,
    }).returning();

    return new Response(JSON.stringify(newStaff[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to create staff member:', error);
    return new Response(JSON.stringify({ error: 'Failed to create staff member' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 