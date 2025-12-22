import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/init.js';
import { requireJwtSecret } from '../config.js';
import { createChallenge, hashChallenge, verifyWalletSignature } from '../services/walletProof.js';

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, wallet_address, role_title } = req.body;
    
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== 'string' || password.length < 8 || wallet_address) {
      return res.status(400).json({ error: 'Name, email and a password of at least 8 characters required; link wallets after registration' });
    }

    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (id, name, email, password, wallet_address, role_title) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, name.trim(), email.trim().toLowerCase(), hashedPassword, null, role_title || 'Member'],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email or wallet address already exists' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }

        const token = jwt.sign({ userId }, requireJwtSecret(), { expiresIn: '7d' });
        
        // Create session
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        db.run(
          'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
          [sessionId, userId, token, expiresAt.toISOString()]
        );

        res.json({ 
          token, 
          user: { id: userId, name: name.trim(), email: email.trim().toLowerCase(), wallet_address: null, role_title: role_title || 'Member' }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password, wallet_address } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || wallet_address) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      let validPassword;
      try { validPassword = await bcrypt.compare(password, user.password); }
      catch { return res.status(500).json({ error: 'Server error' }); }
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id }, requireJwtSecret(), { expiresIn: '7d' });
      
      // Update last login
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      
      res.json({ 
        token, 
        user: { id: user.id, name: user.name, email: user.email, wallet_address: user.wallet_address, role_title: user.role_title } 
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify token middleware
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const match = typeof authHeader === 'string' && /^Bearer ([^\s]+)$/i.exec(authHeader);
  const token = match && match[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, requireJwtSecret(), (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (!user || typeof user.userId !== 'string') return res.status(403).json({ error: 'Invalid token' });
    db.get('SELECT id, email, name, wallet_address FROM users WHERE id = ?', [user.userId], (dbError, row) => {
      if (dbError) return res.status(500).json({ error: 'Database error' });
      if (!row) return res.status(403).json({ error: 'Invalid token' });
      req.user = { userId: row.id, email: row.email, name: row.name, wallet_address: row.wallet_address };
      next();
    });
  });
};

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: { id: user.id, name: user.name, email: user.email, wallet_address: user.wallet_address, role_title: user.role_title } });
  });
});

// Update user wallet address
router.post('/wallet/challenge', (req, res) => {
  const { wallet_address } = req.body;
  if (typeof wallet_address !== 'string' || wallet_address.length < 32 || wallet_address.length > 44) {
    return res.status(400).json({ error: 'Valid wallet address required' });
  }
  const challenge = createChallenge(wallet_address);
  db.run('INSERT INTO wallet_challenges (hash, wallet_address, expires_at) VALUES (?, ?, ?)',
    [challenge.hash, wallet_address, challenge.expiresAt], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to create challenge' });
      res.json({ message: challenge.message });
    });
});

function consumeWalletProof(req, res, next) {
  const { wallet_address, message, signature } = req.body;
  if (typeof wallet_address !== 'string' || typeof message !== 'string' || typeof signature !== 'string' ||
      message.length > 300 || !verifyWalletSignature(wallet_address, message, signature)) {
    return res.status(401).json({ error: 'Invalid wallet proof' });
  }
  db.run('DELETE FROM wallet_challenges WHERE hash = ? AND wallet_address = ? AND expires_at > ?',
    [hashChallenge(message), wallet_address, new Date().toISOString()], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes !== 1) return res.status(401).json({ error: 'Wallet challenge expired or already used' });
      next();
    });
}

router.post('/wallet/login', consumeWalletProof, (req, res) => {
  db.get('SELECT * FROM users WHERE wallet_address = ?', [req.body.wallet_address], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'Wallet is not linked to an account' });
    const token = jwt.sign({ userId: user.id }, requireJwtSecret(), { expiresIn: '7d' });
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, wallet_address: user.wallet_address, role_title: user.role_title } });
  });
});

router.patch('/wallet', authenticateToken, consumeWalletProof, (req, res) => {
  db.run('UPDATE users SET wallet_address = ? WHERE id = ?', [req.body.wallet_address, req.user.userId], function(err) {
    if (err) return res.status(err.message.includes('UNIQUE') ? 409 : 500).json({ error: 'Failed to link wallet' });
    res.json({ message: 'Wallet linked successfully' });
  });
});

export default router;
