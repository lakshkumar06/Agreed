import sqlite3 from 'sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
export const dbPath = process.env.DB_PATH || join(directory, 'clausebase.db');
export const db = new sqlite3.Database(dbPath);

const exec = sql => new Promise((resolve, reject) =>
  db.exec(sql, error => error ? reject(error) : resolve()));
const all = sql => new Promise((resolve, reject) =>
  db.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));

// Existing installations have different subsets of these columns. Inspect the
// schema instead of swallowing every ALTER error as a presumed duplicate.
async function addColumns(table, columns) {
  const existing = new Set((await all(`PRAGMA table_info(${table})`)).map(row => row.name));
  for (const [name, definition] of columns) {
    if (!existing.has(name)) await exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

let initialization;
export function initDatabase() {
  initialization ??= (async () => {
    await exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    await exec(readFileSync(join(directory, 'schema.sql'), 'utf8'));
    await exec(`CREATE TABLE IF NOT EXISTS contract_clauses (
      id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, title TEXT NOT NULL,
      content TEXT NOT NULL, category TEXT, display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS contract_deadlines (
      id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, description TEXT NOT NULL,
      date TEXT, clause_reference TEXT, completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payment_milestone_suggestions (
      id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, description TEXT NOT NULL,
      estimated_amount TEXT, deadline TEXT, suggested_recipient TEXT,
      synced_to_chain BOOLEAN DEFAULT 0, escrow_pda TEXT, milestone_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );`);
    await addColumns('contracts', [
      ['solana_contract_id', 'INTEGER'], ['solana_contract_pda', 'TEXT'],
      ['solana_init_signature', 'TEXT'], ['ipfs_hash', 'TEXT'],
    ]);
    await addColumns('contract_versions', [
      ['contract_hash', 'TEXT'], ['onchain_tx_hash', 'TEXT'], ['ipfs_hash', 'TEXT'],
      ['approval_status', "TEXT DEFAULT 'pending'"],
      ['approval_score', 'DECIMAL(4,2) DEFAULT 0.0'],
    ]);
    console.log('Database initialized successfully');
  })().catch(error => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export function closeDatabase() {
  return new Promise((resolve, reject) =>
    db.close(error => error ? reject(error) : resolve()));
}
