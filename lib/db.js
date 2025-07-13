const path = require('path');
const Database = require('better-sqlite3');

// Try multiple possible database locations
const possiblePaths = [
  path.join(__dirname, '..', 'db', 'beverage-pos.sqlite'),           // From lib/ directory
  path.join(process.cwd(), 'db', 'beverage-pos.sqlite'),            // From project root
  path.join(__dirname, '..', '..', 'db', 'beverage-pos.sqlite'),    // From nested contexts
];

let db;
let dbPath;

function getDb() {
  if (!db) {
    // Find the correct database path
    for (const testPath of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(testPath)) {
          dbPath = testPath;
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    if (!dbPath) {
      console.error('Database file not found. Tried paths:');
      possiblePaths.forEach(p => console.error('  -', p));
      console.error('Please ensure the database file exists and the path is correct.');
      console.error('You may need to run the seed script if the database has not been created.');
      throw new Error('Database connection failed: file not found.');
    }
    
    try {
      db = new Database(dbPath, { fileMustExist: true });
      console.log('Database connected at:', dbPath);
    } catch (error) {
      console.error('Database connection error:', error);
      throw new Error('Database connection failed: ' + error.message);
    }
  }
  return db;
}

function saveDb() {
  // better-sqlite3 handles file writes automatically
}

module.exports = { getDb, saveDb }; 