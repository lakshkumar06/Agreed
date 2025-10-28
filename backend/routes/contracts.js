import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/init.js';
import { authenticateToken } from './auth.js';
import { sendInvitationEmailDev } from '../services/emailService.js';

const router = express.Router();

// Create contract
router.post('/', authenticateToken, (req, res) => {
  const { title, description } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Contract title required' });
  }

  const contractId = uuidv4();
  const versionId = uuidv4();
  const initialContent = `# ${title}\n\n${description || 'No description provided.'}\n\n---\n\n## Terms and Conditions\n\nThis contract outlines the terms and conditions for the parties involved.\n\n---\n\n## Signatures\n\n`;
  
  db.run(
    'INSERT INTO contracts (id, title, description, current_version, created_by, content) VALUES (?, ?, ?, ?, ?, ?)',
    [contractId, title, description, versionId, req.user.userId, initialContent],
    function(err) {
      if (err) {
        console.error('Error creating contract:', err);
        return res.status(500).json({ error: 'Failed to create contract' });
      }

      // Add creator as contract member
      const memberId = uuidv4();
      db.run(
        'INSERT INTO contract_members (id, contract_id, user_id, role_in_contract, weight) VALUES (?, ?, ?, ?, ?)',
        [memberId, contractId, req.user.userId, 'Creator', 1.0],
        function(err) {
          if (err) {
            console.error('Error adding creator as member:', err);
            return res.status(500).json({ error: 'Failed to add creator as member' });
          }

          // Create initial version (merged by default)
          db.run(
            `INSERT INTO contract_versions 
             (id, contract_id, version_number, parent_version_id, author_id, content, diff_summary, commit_message, merged, approval_status, approval_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [versionId, contractId, 1, null, req.user.userId, initialContent, 'Initial version', 'Initial commit', 1, 'merged', 1],
            function(err) {
              if (err) {
                console.error('Error creating initial version:', err);
                return res.status(500).json({ error: 'Failed to create initial version' });
              }

              // Add automatic approval from creator
              const approvalId = uuidv4();
              db.run(
                'INSERT INTO contract_approvals (id, version_id, user_id, vote, comment) VALUES (?, ?, ?, ?, ?)',
                [approvalId, versionId, req.user.userId, 'approve', 'Auto-approved by creator'],
                function(err) {
                  if (err) {
                    console.error('Error creating auto-approval:', err);
                    // Continue anyway
                  }

                  res.json({ 
                    contract: { 
                      id: contractId, 
                      title, 
                      description, 
                      status: 'draft',
                      current_version: versionId,
                      created_by: req.user.userId,
                      created_at: new Date().toISOString()
                    } 
                  });
                }
              );
            }
          );
        }
      );
    }
  );
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
    `SELECT c.*, u.name as creator_name
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
router.get('/:id/members', authenticateToken, (req, res) => {
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

  // Verify contract exists and user has access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND org_id = (SELECT org_id FROM users WHERE id = ?)',
    [id, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Check if user is in same org
      db.get(
        'SELECT * FROM users WHERE id = ? AND org_id = ?',
        [user_id, contract.org_id],
        (err, user) => {
          if (err || !user) {
            return res.status(400).json({ error: 'User not in organization' });
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
    'UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND org_id = (SELECT org_id FROM users WHERE id = ?)',
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
    `SELECT ci.*, u.name as invited_by_name
     FROM contract_invitations ci
     JOIN users u ON ci.invited_by = u.id
     WHERE ci.contract_id = ?`,
    [id],
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
     WHERE ci.invitation_token = ? AND ci.status = 'pending' AND ci.expires_at > datetime('now')`,
    [token],
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
router.post('/invite/:token/accept', authenticateToken, (req, res) => {
  const { token } = req.params;
  
  // Get invitation details
  db.get(
    'SELECT * FROM contract_invitations WHERE invitation_token = ? AND status = "pending" AND expires_at > datetime("now")',
    [token],
    (err, invitation) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!invitation) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }

      // Check if user email matches invitation email
      if (invitation.email && req.user.email !== invitation.email) {
        return res.status(403).json({ error: 'Email address does not match invitation' });
      }

      // Add user to contract
      const memberId = uuidv4();
      db.run(
        'INSERT INTO contract_members (id, contract_id, user_id, role_in_contract, weight) VALUES (?, ?, ?, ?, ?)',
        [memberId, invitation.contract_id, req.user.userId, invitation.role_in_contract, invitation.weight],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to join contract' });
          }

          // Update invitation status
          db.run(
            'UPDATE contract_invitations SET status = "accepted" WHERE id = ?',
            [invitation.id]
          );

          res.json({ message: 'Successfully joined the contract' });
        }
      );
    }
  );
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
     WHERE ci.id = ? AND ci.status = 'pending'`,
    [id],
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

export default router;
