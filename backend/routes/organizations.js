import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'node:crypto';
import { db } from '../database/init.js';
import { withTransaction } from '../database/transaction.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Create organization
router.post('/', authenticateToken, async (req, res) => {
  const { name } = req.body;
  
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Organization name required' });
  }

  const orgId = uuidv4();
  
  try {
    await withTransaction(async ({ run }) => {
      await run('INSERT INTO organizations (id, name, created_by) VALUES (?, ?, ?)',
        [orgId, name.trim(), req.user.userId]);
      const { changes } = await run('UPDATE users SET org_id = ? WHERE id = ? AND org_id IS NULL',
        [orgId, req.user.userId]);
      if (changes !== 1) {
        const error = new Error('User already belongs to an organization');
        error.status = 409;
        throw error;
      }
    });
    res.json({ organization: { id: orgId, name: name.trim(), created_by: req.user.userId, created_at: new Date().toISOString() } });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
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

// Invite a person to join. Membership changes only after the invitee accepts.
router.post('/members', authenticateToken, (req, res) => {
  const { email, wallet_address } = req.body;
  if ((!email && !wallet_address) || (email && wallet_address) ||
      (email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
      (wallet_address && (typeof wallet_address !== 'string' || wallet_address.length < 32 || wallet_address.length > 44))) {
    return res.status(400).json({ error: 'Email or wallet address required' });
  }
  db.get('SELECT id FROM organizations WHERE created_by = ? AND id = (SELECT org_id FROM users WHERE id = ?)',
    [req.user.userId, req.user.userId], (err, org) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!org) return res.status(403).json({ error: 'Only the organization creator can invite members' });
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.run(`INSERT INTO organization_invitations (id, org_id, email, wallet_address, invited_by, token, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), org.id, email?.trim().toLowerCase() || null, wallet_address || null, req.user.userId, token, expiresAt], (insertError) => {
        if (insertError) return res.status(500).json({ error: 'Failed to create invitation' });
        res.json({ invitation: { token, expires_at: expiresAt } });
      });
    });
});

router.post('/members/invite/:token/accept', authenticateToken, async (req, res) => {
  try {
    const orgId = await withTransaction(async ({ get, run }) => {
      const invitation = await get(
        `SELECT * FROM organization_invitations WHERE token = ? AND status = 'pending' AND expires_at > ?`,
        [req.params.token, new Date().toISOString()]
      );
      if (!invitation) {
        const error = new Error('Invitation not found or expired');
        error.status = 404;
        throw error;
      }
      if ((invitation.email && invitation.email !== req.user.email) ||
          (invitation.wallet_address && invitation.wallet_address !== req.user.wallet_address)) {
        const error = new Error('Invitation does not match this account');
        error.status = 403;
        throw error;
      }
      const { changes: joined } = await run('UPDATE users SET org_id = ? WHERE id = ? AND org_id IS NULL',
        [invitation.org_id, req.user.userId]);
      if (joined !== 1) {
        const error = new Error('User already belongs to an organization');
        error.status = 409;
        throw error;
      }
      const { changes: accepted } = await run(
        `UPDATE organization_invitations SET status = 'accepted' WHERE id = ? AND status = 'pending'`,
        [invitation.id]
      );
      if (accepted !== 1) throw new Error('Invitation changed during acceptance');
      return invitation.org_id;
    });
    res.json({ message: 'Joined organization', org_id: orgId });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error accepting organization invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
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
