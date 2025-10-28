import { db } from './init.js';

console.log('Running migration: Add approval system tables and columns...');

// Add columns to contract_versions if they don't exist
db.run(`
  ALTER TABLE contract_versions 
  ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','merged'))
`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding approval_status column:', err);
  } else {
    console.log('✓ Added approval_status column');
  }
});

db.run(`
  ALTER TABLE contract_versions 
  ADD COLUMN approval_score DECIMAL(4,2) DEFAULT 0.0
`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding approval_score column:', err);
  } else {
    console.log('✓ Added approval_score column');
  }
});

// Create contract_approvals table
db.run(`
  CREATE TABLE IF NOT EXISTS contract_approvals (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote TEXT CHECK (vote IN ('approve','reject')) NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(version_id, user_id),
    FOREIGN KEY (version_id) REFERENCES contract_versions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating contract_approvals table:', err);
  } else {
    console.log('✓ Created contract_approvals table');
  }
});

// Create contract_comments table
db.run(`
  CREATE TABLE IF NOT EXISTS contract_comments (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    parent_comment_id TEXT,
    FOREIGN KEY (version_id) REFERENCES contract_versions(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_comment_id) REFERENCES contract_comments(id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating contract_comments table:', err);
  } else {
    console.log('✓ Created contract_comments table');
  }
});

console.log('Migration completed!');

export default db;

