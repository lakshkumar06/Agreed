-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password TEXT,
  wallet_address TEXT UNIQUE,
  org_id TEXT,
  role_title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,  -- Current contract content
  status TEXT CHECK (status IN ('draft','review','active','completed')) DEFAULT 'draft',
  current_version TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Contract members table (many-to-many)
CREATE TABLE IF NOT EXISTS contract_members (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_in_contract TEXT NOT NULL,
  weight DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  approval_status TEXT DEFAULT 'pending',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_weight DECIMAL(3,2) NOT NULL,
  description TEXT
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Contract invitations table
CREATE TABLE IF NOT EXISTS contract_invitations (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  email TEXT,
  wallet_address TEXT,
  role_in_contract TEXT NOT NULL,
  weight DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  invitation_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  invited_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  FOREIGN KEY (invited_by) REFERENCES users(id)
);

-- Contract versions table
CREATE TABLE IF NOT EXISTS contract_versions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  parent_version_id TEXT,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  diff_summary TEXT,
  commit_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  merged BOOLEAN DEFAULT 0,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','merged')),
  approval_score DECIMAL(4,2) DEFAULT 0.0,
  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  FOREIGN KEY (parent_version_id) REFERENCES contract_versions(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Contract diffs table
CREATE TABLE IF NOT EXISTS contract_diffs (
  id TEXT PRIMARY KEY,
  version_from_id TEXT NOT NULL,
  version_to_id TEXT NOT NULL,
  diff_json TEXT,  -- JSON string for diff data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_from_id) REFERENCES contract_versions(id),
  FOREIGN KEY (version_to_id) REFERENCES contract_versions(id)
);

-- Contract approvals table
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
);

-- Contract comments table
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
);

-- Insert default roles
INSERT OR IGNORE INTO roles (id, name, default_weight, description) VALUES 
('role_ceo', 'CEO', 1.0, 'Chief Executive Officer'),
('role_legal', 'Legal', 0.8, 'Legal Counsel'),
('role_finance', 'Finance', 0.7, 'Finance Director'),
('role_operations', 'Operations', 0.6, 'Operations Manager'),
('role_other', 'Other', 0.5, 'General Member');
