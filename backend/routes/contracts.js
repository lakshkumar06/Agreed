import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/init.js';
import { withTransaction } from '../database/transaction.js';
import { authenticateToken } from './auth.js';
import { requireContractAccess } from './contractAccess.js';
import { sendInvitationEmailDev } from '../services/emailService.js';
import { uploadToIPFS, pinToIPFS } from '../services/ipfsService.js';
import { initializeContractOnChain, deriveContractPDA } from '../services/solanaService.js';

const router = express.Router();

// Create contract
router.post('/', authenticateToken, async (req, res) => {
  const { title, description } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Contract title required' });
  }

  const contractId = uuidv4();
  const versionId = uuidv4();
  const initialContent = `# ${title}\n\n${description || 'No description provided.'}\n\n---\n\n## Terms and Conditions\n\nThis contract outlines the terms and conditions for the parties involved.\n\n---\n\n## Signatures\n\n`;
  
  try {
    // Upload initial content to IPFS first
    console.log('[CREATE_CONTRACT] Uploading initial contract content to IPFS...');
    const ipfsHash = await uploadToIPFS(initialContent);
    console.log('[CREATE_CONTRACT] Initial content uploaded to IPFS:', ipfsHash);
    
    // Pin the content to ensure it persists
    await pinToIPFS(ipfsHash);
    
    await withTransaction(async ({ run }) => {
      await run(
        'INSERT INTO contracts (id, title, description, current_version, created_by, content, ipfs_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [contractId, title, description, versionId, req.user.userId, initialContent, ipfsHash]
      );
      await run(
        'INSERT INTO contract_members (id, contract_id, user_id, role_in_contract, weight) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), contractId, req.user.userId, 'Creator', 1.0]
      );
      await run(
        `INSERT INTO contract_versions
         (id, contract_id, version_number, parent_version_id, author_id, content, ipfs_hash, diff_summary, commit_message, merged, approval_status, approval_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [versionId, contractId, 1, null, req.user.userId, initialContent, ipfsHash, 'Initial version', 'Initial commit', 1, 'merged', 1]
      );
      await run(
        'INSERT INTO contract_approvals (id, version_id, user_id, vote, comment) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), versionId, req.user.userId, 'approve', 'Auto-approved by creator']
      );
    });

    res.json({ contract: {
      id: contractId, title, description, status: 'draft', current_version: versionId,
      created_by: req.user.userId, created_at: new Date().toISOString(),
      ipfs_hash: ipfsHash, needs_solana_init: true,
    } });
  } catch (err) {
    console.error('Error creating contract:', err);
    return res.status(500).json({ error: 'Failed to create contract' });
  }
});

// Get user contracts
router.get('/', authenticateToken, (req, res) => {
  db.all(
    `SELECT DISTINCT c.*, u.name as creator_name,
     COUNT(cm.id) as member_count
     FROM contracts c
     JOIN users u ON c.created_by = u.id
     LEFT JOIN contract_members cm ON c.id = cm.contract_id
     WHERE c.created_by = ? OR c.id IN (SELECT contract_id FROM contract_members WHERE user_id = ?)
     GROUP BY c.id
     ORDER BY c.updated_at DESC`,
    [req.user.userId, req.user.userId],
    (err, contracts) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ contracts });
    }
  );
});

// Get contract details
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT c.*, u.name as creator_name, u.wallet_address as creator_wallet
     FROM contracts c
     JOIN users u ON c.created_by = u.id
     WHERE c.id = ? AND (c.created_by = ? OR c.id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))`,
    [id, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      res.json({ contract });
    }
  );
});

// Get contract members
router.get('/:id/members', authenticateToken, requireContractAccess, (req, res) => {
  const { id } = req.params;
  
  db.all(
    `SELECT cm.*, u.name, u.email, u.wallet_address, u.role_title
     FROM contract_members cm
     JOIN users u ON cm.user_id = u.id
     WHERE cm.contract_id = ?`,
    [id],
    (err, members) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ members });
    }
  );
});

// Add member to contract
router.post('/:id/members', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { user_id, role_in_contract, weight } = req.body;
  
  if (!user_id || !role_in_contract) {
    return res.status(400).json({ error: 'User ID and role required' });
  }

  // Only the creator can add members to this contract.
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND created_by = ?',
    [id, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      db.get(
        'SELECT * FROM users WHERE id = ?',
        [user_id],
        (err, user) => {
          if (err || !user) {
            return res.status(400).json({ error: 'User not found' });
          }

          const memberId = uuidv4();
          db.run(
            'INSERT INTO contract_members (id, contract_id, user_id, role_in_contract, weight) VALUES (?, ?, ?, ?, ?)',
            [memberId, id, user_id, role_in_contract, weight || 0.5],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to add member' });
              }
              res.json({ 
                member: { 
                  id: memberId, 
                  contract_id: id, 
                  user_id, 
                  role_in_contract, 
                  weight: weight || 0.5 
                } 
              });
            }
          );
        }
      );
    }
  );
});

// Update contract status
router.patch('/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status || !['draft', 'review', 'active', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Valid status required' });
  }

  db.run(
    'UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by = ?',
    [status, id, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      res.json({ message: 'Contract status updated' });
    }
  );
});

// Invite member to contract
router.post('/:id/invite', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { email, wallet_address, role_in_contract, weight } = req.body;
  
  if (!email && !wallet_address) {
    return res.status(400).json({ error: 'Email or wallet address required' });
  }

  // Verify contract exists and user has access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND created_by = ?',
    [id, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(403).json({ error: 'Only the contract creator can invite members' });
      }

      // Check if user is already a member
      const checkQuery = email 
        ? 'SELECT * FROM contract_members cm JOIN users u ON cm.user_id = u.id WHERE cm.contract_id = ? AND u.email = ?'
        : 'SELECT * FROM contract_members cm JOIN users u ON cm.user_id = u.id WHERE cm.contract_id = ? AND u.wallet_address = ?';
      const checkParam = email || wallet_address;

      db.get(checkQuery, [id, checkParam], (err, existingMember) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (existingMember) {
          return res.status(400).json({ error: 'User is already a member of this contract' });
        }

        // Check if invitation already exists
        const inviteQuery = email 
          ? 'SELECT * FROM contract_invitations WHERE contract_id = ? AND email = ? AND status = "pending"'
          : 'SELECT * FROM contract_invitations WHERE contract_id = ? AND wallet_address = ? AND status = "pending"';

        db.get(inviteQuery, [id, checkParam], (err, existingInvite) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (existingInvite) {
            return res.status(400).json({ error: 'Invitation already sent to this user' });
          }

          // Create invitation
          const invitationId = uuidv4();
          const invitationToken = uuidv4();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

          db.run(
            'INSERT INTO contract_invitations (id, contract_id, email, wallet_address, role_in_contract, weight, invitation_token, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [invitationId, id, email, wallet_address, role_in_contract, weight || 0.5, invitationToken, req.user.userId, expiresAt.toISOString()],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to create invitation' });
              }

              // Generate invitation link
              const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${invitationToken}`;

              // Send email if email provided
              if (email) {
                sendInvitationEmailDev(email, invitationLink, contract.title, req.user.name || 'Contract Owner');
              }

              res.json({ 
                invitation: { 
                  id: invitationId, 
                  contract_id: id, 
                  email, 
                  wallet_address,
                  role_in_contract, 
                  weight: weight || 0.5,
                  invitation_link: invitationLink,
                  expires_at: expiresAt.toISOString()
                } 
              });
            }
          );
        });
      });
    }
  );
});

// Get contract invitations
router.get('/:id/invitations', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.all(
    `SELECT ci.id, ci.contract_id, ci.email, ci.wallet_address, ci.role_in_contract,
            ci.weight, ci.status, ci.created_at, ci.expires_at, u.name as invited_by_name
     FROM contract_invitations ci
     JOIN users u ON ci.invited_by = u.id
     JOIN contracts c ON c.id = ci.contract_id
     WHERE ci.contract_id = ? AND c.created_by = ?`,
    [id, req.user.userId],
    (err, invitations) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ invitations });
    }
  );
});

// Get invitation details by token
router.get('/invite/:token', (req, res) => {
  const { token } = req.params;
  
  db.get(
    `SELECT ci.*, c.title as contract_title, c.description as contract_description, 
     u.name as invited_by_name
     FROM contract_invitations ci
     JOIN contracts c ON ci.contract_id = c.id
     JOIN users u ON ci.invited_by = u.id
     WHERE ci.invitation_token = ? AND ci.status = 'pending' AND ci.expires_at > ?`,
    [token, new Date().toISOString()],
    (err, invitation) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!invitation) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }
      res.json({ invitation });
    }
  );
});

// Accept invitation
router.post('/invite/:token/accept', authenticateToken, async (req, res) => {
  const { token } = req.params;
  try {
    await withTransaction(async ({ get, run }) => {
      const invitation = await get(
        'SELECT * FROM contract_invitations WHERE invitation_token = ? AND status = ? AND expires_at > ?',
        [token, 'pending', new Date().toISOString()]
      );
      if (!invitation) {
        const error = new Error('Invalid or expired invitation');
        error.status = 404;
        throw error;
      }
      if ((invitation.email && req.user.email !== invitation.email) ||
          (invitation.wallet_address && req.user.wallet_address !== invitation.wallet_address)) {
        const error = new Error('Invitation recipient does not match');
        error.status = 403;
        throw error;
      }
      const member = await get(
        'SELECT 1 FROM contract_members WHERE contract_id = ? AND user_id = ?',
        [invitation.contract_id, req.user.userId]
      );
      if (member) {
        const error = new Error('Already a contract member');
        error.status = 409;
        throw error;
      }
      await run(
        'INSERT INTO contract_members (id, contract_id, user_id, role_in_contract, weight) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), invitation.contract_id, req.user.userId, invitation.role_in_contract, invitation.weight]
      );
      const { changes } = await run(
        'UPDATE contract_invitations SET status = ? WHERE id = ? AND status = ?',
        ['accepted', invitation.id, 'pending']
      );
      if (changes !== 1) throw new Error('Invitation changed during acceptance');
    });
    res.json({ message: 'Successfully joined the contract' });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Resend invitation
router.post('/invite/:id/resend', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // Get invitation details
  db.get(
    `SELECT ci.*, c.title as contract_title, u.name as inviter_name
     FROM contract_invitations ci
     JOIN contracts c ON ci.contract_id = c.id
     JOIN users u ON ci.invited_by = u.id
     WHERE ci.id = ? AND ci.status = 'pending' AND ci.expires_at > ? AND c.created_by = ?`,
    [id, new Date().toISOString(), req.user.userId],
    (err, invitation) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found or already processed' });
      }

      // Generate new invitation link
      const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${invitation.invitation_token}`;

      // Send email if email provided
      if (invitation.email) {
        sendInvitationEmailDev(invitation.email, invitationLink, invitation.contract_title, invitation.inviter_name);
      }

      res.json({ 
        invitation: { 
          ...invitation,
          invitation_link: invitationLink
        } 
      });
    }
  );
});

// Initialize contract on Solana (called from frontend after contract creation)
router.post('/:id/solana-init', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { 
    ipfs_hash = '',
    solana_contract_id, 
    signature,
    contract_pda 
  } = req.body;

  if (!solana_contract_id || !signature || !contract_pda) {
    return res.status(400).json({ 
      error: 'Solana contract ID, signature, and contract PDA required',
      received: { solana_contract_id, signature, contract_pda }
    });
  }

  try {
    // Get contract details
    const contract = await new Promise((resolve, reject) => {
  db.get(
        'SELECT * FROM contracts WHERE id = ?',
    [id],
        (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error('Contract not found'));
          else resolve(row);
      }
      );
    });

    // Verify user is the contract creator
      if (contract.created_by !== req.user.userId) {
      return res.status(403).json({ 
        error: 'Only contract creator can initialize on Solana' 
      });
      }

    // Update contract with Solana information
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE contracts 
         SET solana_contract_id = ?, 
             solana_contract_pda = ?,
             solana_init_signature = ?,
             ipfs_hash = ?
         WHERE id = ?`,
        [solana_contract_id, contract_pda, signature, ipfs_hash, id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ 
      success: true, 
      solana_contract_id,
      contract_pda,
      signature,
      ipfs_hash
    });
  } catch (error) {
    console.error('Error storing Solana contract info:', error);
    res.status(500).json({ error: 'Failed to update contract with Solana info' });
          }
});

// Get Solana contract PDA for a contract
router.get('/:id/solana-pda', authenticateToken, requireContractAccess, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get contract and creator wallet
    const contract = await new Promise((resolve, reject) => {
      db.get(
        `SELECT c.*, u.wallet_address 
         FROM contracts c 
         JOIN users u ON c.created_by = u.id 
         WHERE c.id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error('Contract not found'));
          else resolve(row);
        }
      );
    });

    // If already initialized, return stored PDA
    if (contract.solana_contract_pda) {
      return res.json({
        contract_pda: contract.solana_contract_pda,
        solana_contract_id: contract.solana_contract_id,
        initialized: true
      });
    }

    // Derive PDA if we have contract ID and creator wallet
    if (contract.solana_contract_id && contract.wallet_address) {
      const pda = deriveContractPDA(
        parseInt(contract.solana_contract_id),
        contract.wallet_address
      );
      return res.json({
        contract_pda: pda,
        solana_contract_id: contract.solana_contract_id,
        initialized: false
      });
        }

    res.json({
      initialized: false,
      error: 'Contract not initialized on Solana yet'
    });
  } catch (error) {
    console.error('Error getting contract PDA:', error);
    res.status(500).json({ error: 'Failed to get contract PDA' });
  }
});

export default router;
