import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/init.js';
import { authenticateToken } from './auth.js';
import { processContractFile, chatWithContract } from '../services/aiService.js';

const router = express.Router();

// Process contract file with AI
router.post('/contracts/:id/process', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fileContent } = req.body;

  if (!fileContent) {
    return res.status(400).json({ error: 'File content required' });
  }

  try {
    // Update contract content with uploaded file content
    db.run(
      'UPDATE contracts SET content = ? WHERE id = ?',
      [fileContent, id],
      async function(err) {
        if (err) {
          console.error('Error updating contract content:', err);
          return res.status(500).json({ error: 'Failed to update contract content' });
        }

        // Also update the initial version content
        db.run(
          'UPDATE contract_versions SET content = ? WHERE contract_id = ? AND version_number = 1',
          [fileContent, id]
        );
      }
    );

    // Process with AI
    const { clauses, deadlines, paymentMilestones } = await processContractFile(fileContent);

    // Save clauses to database
    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const clauseId = uuidv4();
      db.run(
        'INSERT INTO contract_clauses (id, contract_id, title, content, category, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [clauseId, id, clause.title, clause.content, clause.category || 'General', i]
      );
    }

    // Save deadlines to database
    for (const deadline of deadlines) {
      const deadlineId = uuidv4();
      db.run(
        'INSERT INTO contract_deadlines (id, contract_id, description, date, clause_reference) VALUES (?, ?, ?, ?, ?)',
        [deadlineId, id, deadline.description, deadline.date || 'TBD', deadline.clause_reference || '']
      );
    }

    // Save payment milestone suggestions to database
    for (const milestone of paymentMilestones) {
      const milestoneId = uuidv4();
      db.run(
        'INSERT INTO payment_milestone_suggestions (id, contract_id, description, estimated_amount, deadline, suggested_recipient) VALUES (?, ?, ?, ?, ?, ?)',
        [milestoneId, id, milestone.description, milestone.estimated_amount || 'TBD', milestone.deadline || 'TBD', milestone.suggested_recipient || 'TBD']
      );
    }

    res.json({ 
      success: true,
      clauses: clauses.length,
      deadlines: deadlines.length,
      paymentMilestones: paymentMilestones.length
    });
  } catch (error) {
    console.error('Error processing contract:', error);
    res.status(500).json({ error: 'Failed to process contract' });
  }
});

// Get contract clauses
router.get('/contracts/:id/clauses', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(
    'SELECT * FROM contract_clauses WHERE contract_id = ? ORDER BY display_order',
    [id],
    (err, clauses) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ clauses });
    }
  );
});

// Get contract deadlines
router.get('/contracts/:id/deadlines', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(
    'SELECT * FROM contract_deadlines WHERE contract_id = ? ORDER BY date ASC',
    [id],
    (err, deadlines) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ deadlines });
    }
  );
});

// Store chat history in memory (per user, per contract)
const chatSessions = new Map();

// Chat with contract
router.post('/contracts/:id/chat', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question required' });
  }

  try {
    // Get contract content
    db.get(
      'SELECT content FROM contracts WHERE id = ?',
      [id],
      async (err, contract) => {
        if (err || !contract) {
          return res.status(404).json({ error: 'Contract not found' });
        }

        // Get chat history from session
        const sessionKey = `${req.user.userId}_${id}`;
        let chatHistory = chatSessions.get(sessionKey) || [];

        // Get AI response
        const answer = await chatWithContract(question, contract.content, chatHistory);

        // Save to session memory (keep last 5 messages)
        chatHistory.push(
          { role: 'user', content: question },
          { role: 'assistant', content: answer }
        );
        if (chatHistory.length > 10) {
          chatHistory = chatHistory.slice(-10);
        }
        chatSessions.set(sessionKey, chatHistory);

        res.json({ answer });
      }
    );
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

// Get payment milestone suggestions
router.get('/contracts/:id/milestone-suggestions', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(
    'SELECT * FROM payment_milestone_suggestions WHERE contract_id = ? ORDER BY created_at ASC',
    [id],
    (err, milestones) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ milestones });
    }
  );
});

// Update milestone suggestion (e.g., after syncing to chain)
router.put('/milestone-suggestions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { synced_to_chain, escrow_pda, milestone_id } = req.body;

  db.run(
    'UPDATE payment_milestone_suggestions SET synced_to_chain = ?, escrow_pda = ?, milestone_id = ? WHERE id = ?',
    [synced_to_chain ? 1 : 0, escrow_pda || null, milestone_id || null, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Milestone suggestion not found' });
      }
      res.json({ success: true });
    }
  );
});

// Delete milestone suggestion
router.delete('/milestone-suggestions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run(
    'DELETE FROM payment_milestone_suggestions WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Milestone suggestion not found' });
      }
      res.json({ success: true });
    }
  );
});

// Get chat history
router.get('/contracts/:id/chat', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Get from session memory
  const sessionKey = `${req.user.userId}_${id}`;
  const chatHistory = chatSessions.get(sessionKey) || [];

  // Convert to format expected by frontend
  const history = [];
  for (let i = 0; i < chatHistory.length; i += 2) {
    if (chatHistory[i] && chatHistory[i + 1]) {
      history.push({
        question: chatHistory[i].content,
        answer: chatHistory[i + 1].content
      });
    }
  }

  res.json({ history: history.reverse() });
});

export default router;

