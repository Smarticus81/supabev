const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'db', 'beverage-pos.sqlite');
console.log('Trying to open:', dbPath);

try {
  const db = new Database(dbPath, { fileMustExist: true });
  const row = db.prepare('SELECT * FROM drinks LIMIT 1').get();
  if (row) {
    console.log('Successfully read from drinks table:', row);
  } else {
    console.log('No rows in drinks table.');
  }
} catch (e) {
  console.error('Error opening or reading database:', e);
  process.exit(1);
} 