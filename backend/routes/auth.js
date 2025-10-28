import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/init.js';
import { JWT_SECRET } from '../server.js';

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, wallet_address, role_title } = req.body;
    
    if (!name || (!email && !wallet_address)) {
      return res.status(400).json({ error: 'Name and either email or wallet address required' });
    }

    const userId = uuidv4();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    db.run(
      `INSERT INTO users (id, name, email, password, wallet_address, role_title) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, name, email, hashedPassword, wallet_address, role_title || 'Member'],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email or wallet address already exists' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }

        const token = jwt.sign({ userId, email, wallet_address }, JWT_SECRET, { expiresIn: '7d' });
        
        // Create session
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        db.run(
          'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
          [sessionId, userId, token, expiresAt.toISOString()]
        );

        res.json({ 
          token, 
          user: { id: userId, name, email, wallet_address, role_title: role_title || 'Member' } 
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

    if (!email && !wallet_address) {
      return res.status(400).json({ error: 'Email or wallet address required' });
    }

    const query = email 
      ? 'SELECT * FROM users WHERE email = ?'
      : 'SELECT * FROM users WHERE wallet_address = ?';
    const param = email || wallet_address;

    db.get(query, [param], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // For wallet login, skip password check
      if (wallet_address) {
        const token = jwt.sign({ userId: user.id, email: user.email, wallet_address: user.wallet_address }, JWT_SECRET, { expiresIn: '7d' });
        
        // Update last login
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        res.json({ 
          token, 
          user: { id: user.id, name: user.name, email: user.email, wallet_address: user.wallet_address, role_title: user.role_title } 
        });
        return;
      }

      // Email/password login
      if (!password) {
        return res.status(400).json({ error: 'Password required for email login' });
      }

      // If user doesn't have a password (wallet-only registration), create one
      if (!user.password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        // Continue with login after setting password
      } else {
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      
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
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
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
router.patch('/wallet', authenticateToken, (req, res) => {
  const { wallet_address } = req.body;
  
  if (!wallet_address) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  db.run(
    'UPDATE users SET wallet_address = ? WHERE id = ?',
    [wallet_address, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update wallet address' });
      }
      res.json({ message: 'Wallet address updated successfully' });
    }
  );
});

export default router;
