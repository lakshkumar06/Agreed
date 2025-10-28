import { db } from './init.js';

// Add on-chain proof columns to contract_versions table
export function migrateOnchainProof() {
  db.run(`
    ALTER TABLE contract_versions 
    ADD COLUMN contract_hash TEXT;
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding contract_hash column:', err);
    } else if (!err) {
      console.log('Added contract_hash column to contract_versions table');
    }
  });

  db.run(`
    ALTER TABLE contract_versions 
    ADD COLUMN onchain_tx_hash TEXT;
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding onchain_tx_hash column:', err);
    } else if (!err) {
      console.log('Added onchain_tx_hash column to contract_versions table');
    }
  });

  console.log('On-chain proof migration completed');
}
