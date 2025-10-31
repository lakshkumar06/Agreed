import { db } from './init.js';

// Add IPFS hash column to contract_versions table
export function migrateIpfsVersions() {
  db.run(`
    ALTER TABLE contract_versions 
    ADD COLUMN ipfs_hash TEXT;
  `, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding ipfs_hash column:', err);
    } else if (!err) {
      console.log('Added ipfs_hash column to contract_versions table');
    }
  });

  console.log('IPFS versions migration completed');
}

