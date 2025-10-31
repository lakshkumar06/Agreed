import { db } from './init.js';

const migratePaymentMilestones = () => {
  db.serialize(() => {
    // Payment milestone suggestions table (temporary until synced to blockchain)
    db.run(`CREATE TABLE IF NOT EXISTS payment_milestone_suggestions (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      description TEXT NOT NULL,
      estimated_amount TEXT,
      deadline TEXT,
      suggested_recipient TEXT,
      synced_to_chain BOOLEAN DEFAULT 0,
      escrow_pda TEXT,
      milestone_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating payment_milestone_suggestions table:', err);
      } else {
        console.log('✓ Created payment_milestone_suggestions table');
      }
    });

    console.log('Payment milestone tables migrated successfully');
  });
};

export { migratePaymentMilestones };

