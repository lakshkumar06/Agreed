import express from 'express';
import { db } from '../database/init.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Get dashboard data
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  // Get user's organization info
  db.get(
    `SELECT o.*, u.name as creator_name 
     FROM organizations o 
     JOIN users u ON o.created_by = u.id 
     WHERE o.id = (SELECT org_id FROM users WHERE id = ?)`,
    [userId],
    (err, org) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Get active contracts
      db.all(
        `SELECT c.*, u.name as creator_name,
         COUNT(cm.id) as member_count,
         COUNT(CASE WHEN cm.approval_status = 'approved' THEN 1 END) as approved_count
         FROM contracts c
         JOIN users u ON c.created_by = u.id
         LEFT JOIN contract_members cm ON c.id = cm.contract_id
         WHERE c.org_id = (SELECT org_id FROM users WHERE id = ?)
         GROUP BY c.id
         ORDER BY c.updated_at DESC
         LIMIT 10`,
        [userId],
        (err, contracts) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Get organization members count
          db.get(
            'SELECT COUNT(*) as member_count FROM users WHERE org_id = ?',
            [org?.id],
            (err, memberCount) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              // Get user's contract memberships
              db.all(
                `SELECT c.id, c.title, c.status, cm.role_in_contract, cm.weight, cm.approval_status
                 FROM contract_members cm
                 JOIN contracts c ON cm.contract_id = c.id
                 WHERE cm.user_id = ?`,
                [userId],
                (err, userContracts) => {
                  if (err) {
                    return res.status(500).json({ error: 'Database error' });
                  }

                  res.json({
                    organization: org,
                    contracts: contracts || [],
                    memberCount: memberCount?.member_count || 0,
                    userContracts: userContracts || [],
                    stats: {
                      totalContracts: contracts?.length || 0,
                      activeContracts: contracts?.filter(c => c.status === 'active').length || 0,
                      draftContracts: contracts?.filter(c => c.status === 'draft').length || 0,
                      reviewContracts: contracts?.filter(c => c.status === 'review').length || 0
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

// Get recent activity
router.get('/activity', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  db.all(
    `SELECT 
       'contract_created' as type,
       c.title as description,
       c.created_at as timestamp,
       u.name as user_name
     FROM contracts c
     JOIN users u ON c.created_by = u.id
     WHERE c.org_id = (SELECT org_id FROM users WHERE id = ?)
     
     UNION ALL
     
     SELECT 
       'member_added' as type,
       'Added to ' || c.title as description,
       cm.joined_at as timestamp,
       u.name as user_name
     FROM contract_members cm
     JOIN contracts c ON cm.contract_id = c.id
     JOIN users u ON cm.user_id = u.id
     WHERE c.org_id = (SELECT org_id FROM users WHERE id = ?)
     
     ORDER BY timestamp DESC
     LIMIT 20`,
    [userId, userId],
    (err, activities) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ activities: activities || [] });
    }
  );
});

export default router;
