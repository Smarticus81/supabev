const { getDb } = require('../../../lib/db');

export async function GET() {
  try {
    const db = getDb();
    const drinks = db.prepare("SELECT * FROM drinks").all();
    
    const stmt = db.prepare('SELECT * FROM serving_options WHERE drink_id = ?');

    const drinksWithServings = drinks.map((drink: { id: string }) => {
      const serving_options = stmt.all(drink.id);
      return { ...drink, serving_options };
    });

    return new Response(JSON.stringify(drinksWithServings), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Failed to fetch drinks:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch drinks' }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
