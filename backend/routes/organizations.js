import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/init.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Create organization
router.post('/', authenticateToken, (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Organization name required' });
  }

  const orgId = uuidv4();
  
  db.run(
    'INSERT INTO organizations (id, name, created_by) VALUES (?, ?, ?)',
    [orgId, name, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create organization' });
      }

      // Add creator as member
      db.run(
        'UPDATE users SET org_id = ? WHERE id = ?',
        [orgId, req.user.userId]
      );

      res.json({ 
        organization: { id: orgId, name, created_by: req.user.userId, created_at: new Date().toISOString() } 
      });
    }
  );
});

// Get user's organization
router.get('/my-org', authenticateToken, (req, res) => {
  db.get(
    `SELECT o.*, u.name as creator_name 
     FROM organizations o 
     JOIN users u ON o.created_by = u.id 
     WHERE o.id = (SELECT org_id FROM users WHERE id = ?)`,
    [req.user.userId],
    (err, org) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!org) {
        return res.status(404).json({ error: 'No organization found' });
      }
      res.json({ organization: org });
    }
  );
});

// Get organization members
router.get('/members', authenticateToken, (req, res) => {
  db.all(
    `SELECT u.id, u.name, u.email, u.wallet_address, u.role_title, u.created_at, u.last_login
     FROM users u 
     WHERE u.org_id = (SELECT org_id FROM users WHERE id = ?)`,
    [req.user.userId],
    (err, members) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ members });
    }
  );
});

// Add member to organization
router.post('/members', authenticateToken, (req, res) => {
  const { email, wallet_address, role_title } = req.body;
  
  if (!email && !wallet_address) {
    return res.status(400).json({ error: 'Email or wallet address required' });
  }

  // First get the org_id
  db.get('SELECT org_id FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'User not found' });
    }

    const orgId = user.org_id;
    if (!orgId) {
      return res.status(400).json({ error: 'User not in any organization' });
    }

    // Check if user already exists
    const query = email 
      ? 'SELECT * FROM users WHERE email = ?'
      : 'SELECT * FROM users WHERE wallet_address = ?';
    const param = email || wallet_address;

    db.get(query, [param], (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (existingUser) {
        // User exists, add to org
        db.run(
          'UPDATE users SET org_id = ?, role_title = ? WHERE id = ?',
          [orgId, role_title || 'Member', existingUser.id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to add member' });
            }
            res.json({ 
              member: { 
                id: existingUser.id, 
                name: existingUser.name, 
                email: existingUser.email, 
                wallet_address: existingUser.wallet_address,
                role_title: role_title || 'Member'
              } 
            });
          }
        );
      } else {
        // Create new user
        const userId = uuidv4();
        db.run(
          'INSERT INTO users (id, name, email, wallet_address, org_id, role_title) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, 'New Member', email, wallet_address, orgId, role_title || 'Member'],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to create member' });
            }
            res.json({ 
              member: { 
                id: userId, 
                name: 'New Member', 
                email, 
                wallet_address,
                role_title: role_title || 'Member'
              } 
            });
          }
        );
      }
    });
  });
});

// Get available roles
router.get('/roles', (req, res) => {
  db.all('SELECT * FROM roles ORDER BY default_weight DESC', (err, roles) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ roles });
  });
});

export default router;
