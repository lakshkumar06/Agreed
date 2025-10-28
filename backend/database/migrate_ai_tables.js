import { db } from './init.js';

const migrateAITables = () => {
  db.serialize(() => {
    // Contract clauses table
    db.run(`CREATE TABLE IF NOT EXISTS contract_clauses (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    )`);

    // Contract deadlines table
    db.run(`CREATE TABLE IF NOT EXISTS contract_deadlines (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      description TEXT NOT NULL,
      date TEXT,
      clause_reference TEXT,
      completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    )`);

    console.log('AI tables migrated successfully');
  });
};

export { migrateAITables };

