import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { migrateAITables } from './migrate_ai_tables.js';
import { migrateOnchainProof } from './migrate_onchain_proof.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'clausebase.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

export function initDatabase() {
  return new Promise((resolve, reject) => {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error initializing database:', err.message);
        reject(err);
      } else {
        console.log('Database initialized successfully');
        migrateAITables();
        migrateOnchainProof();
        resolve();
      }
    });
  });
}

export function closeDatabase() {
  return new Promise((resolve) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
      resolve();
    });
  });
}
