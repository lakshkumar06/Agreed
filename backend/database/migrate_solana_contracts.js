const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'clausebase.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting Solana contract migration...');

db.serialize(() => {
  // Add new columns for Solana tracking
  db.run(`
    ALTER TABLE contracts 
    ADD COLUMN solana_pda TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding solana_pda column:', err);
    } else {
      console.log('✓ Added solana_pda column');
    }
  });

  db.run(`
    ALTER TABLE contracts 
    ADD COLUMN solana_tx TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding solana_tx column:', err);
    } else {
      console.log('✓ Added solana_tx column');
    }
  });

  db.run(`
    ALTER TABLE contracts 
    ADD COLUMN on_chain INTEGER DEFAULT 0
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding on_chain column:', err);
    } else {
      console.log('✓ Added on_chain column');
    }
  });

  // Add column to track approval transactions
  db.run(`
    ALTER TABLE approvals 
    ADD COLUMN solana_tx TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding solana_tx to approvals:', err);
    } else {
      console.log('✓ Added solana_tx column to approvals');
    }
  });

  console.log('\nMigration complete!');
  console.log('New contracts will be created on-chain.');
  console.log('Existing contracts remain SQLite-only (on_chain = 0).');
  
  db.close();
});

