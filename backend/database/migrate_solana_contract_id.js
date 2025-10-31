import { db } from './init.js';

const migrateSolanaContractId = () => {
  db.serialize(() => {
    // Add solana_contract_id column to contracts table
    db.run(`ALTER TABLE contracts ADD COLUMN solana_contract_id INTEGER`, (err) => {
      if (err) {
        // Column might already exist
        if (err.message.includes('duplicate column name')) {
          console.log('✓ solana_contract_id column already exists');
        } else {
          console.error('Error adding solana_contract_id column:', err);
        }
      } else {
        console.log('✓ Added solana_contract_id column to contracts table');
      }
    });

    console.log('Solana contract ID migration completed');
  });
};

export { migrateSolanaContractId };

