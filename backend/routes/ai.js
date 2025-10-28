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
    const { clauses, deadlines } = await processContractFile(fileContent);

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

    res.json({ 
      success: true,
      clauses: clauses.length,
      deadlines: deadlines.length 
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

