import { db } from './init.js';

// Add Solana contract fields to contracts table
export function migrateAddSolanaContractFields() {
    db.run(
    `ALTER TABLE contracts ADD COLUMN solana_contract_pda TEXT`,
      (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding solana_contract_pda column:', err);
      } else if (!err) {
        console.log('Added solana_contract_pda column to contracts table');
        }
      }
    );

  db.run(
    `ALTER TABLE contracts ADD COLUMN solana_init_signature TEXT`,
    (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding solana_init_signature column:', err);
      } else if (!err) {
        console.log('Added solana_init_signature column to contracts table');
      }
    }
  );

  db.run(
    `ALTER TABLE contracts ADD COLUMN ipfs_hash TEXT`,
    (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding ipfs_hash column to contracts:', err);
      } else if (!err) {
        console.log('Added ipfs_hash column to contracts table');
  }
}
  );

  console.log('Add Solana contract fields migration completed');
}

