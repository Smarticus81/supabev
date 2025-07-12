const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'db', 'beverage-pos.sqlite');
let db;

function getDb() {
  if (!db) {
    try {
      db = new Database(dbPath, { fileMustExist: true });
    } catch (error) {
      console.error('Database file not found at:', dbPath);
      console.error('Please ensure the database file exists and the path is correct.');
      console.error('You may need to run the seed script if the database has not been created.');
      throw new Error('Database connection failed: file not found.');
    }
  }
  return db;
}

function saveDb() {
  // better-sqlite3 handles file writes automatically
}

module.exports = { getDb, saveDb }; 