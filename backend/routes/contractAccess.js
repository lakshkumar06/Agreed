import { db } from '../database/init.js';

export function requireContractAccess(req, res, next) {
  db.get(`SELECT 1 FROM contracts c WHERE c.id = ? AND
    (c.created_by = ? OR EXISTS (
      SELECT 1 FROM contract_members cm WHERE cm.contract_id = c.id AND cm.user_id = ?
    ))`, [req.params.id, req.user.userId, req.user.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Contract not found' });
    next();
  });
}

export function requireMilestoneAccess(req, res, next) {
  db.get(`SELECT 1 FROM payment_milestone_suggestions m
    JOIN contracts c ON c.id = m.contract_id
    WHERE m.id = ? AND (c.created_by = ? OR EXISTS (
      SELECT 1 FROM contract_members cm WHERE cm.contract_id = c.id AND cm.user_id = ?
    ))`, [req.params.id, req.user.userId, req.user.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Milestone suggestion not found' });
    next();
  });
}
