import express from 'express';
import { db } from '../database/init.js';
import { replaceContractAnalysis } from '../database/contractAnalysis.js';
import { authenticateToken } from './auth.js';
import { requireContractAccess, requireMilestoneAccess } from './contractAccess.js';
import { processContractFile, chatWithContract } from '../services/aiService.js';
import { uploadToIPFS, pinToIPFS } from '../services/ipfsService.js';

const router = express.Router();
router.use('/contracts/:id', authenticateToken, requireContractAccess);
router.use('/milestone-suggestions/:id', authenticateToken, requireMilestoneAccess);

// Process contract file with AI
router.post('/contracts/:id/process', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fileContent } = req.body;

  if (typeof fileContent !== 'string' || !fileContent.trim()) {
    return res.status(400).json({ error: 'File content required' });
  }

  try {
    const contract = await new Promise((resolve, reject) =>
      db.get('SELECT content FROM contracts WHERE id = ?', [id],
        (error, row) => error ? reject(error) : resolve(row)));
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const { clauses, deadlines, paymentMilestones } = await processContractFile(fileContent);
    const ipfsHash = await uploadToIPFS(fileContent);
    await pinToIPFS(ipfsHash);
    await replaceContractAnalysis(id, fileContent, { clauses, deadlines, paymentMilestones }, contract.content, req.user.userId, ipfsHash);

    res.json({ 
      success: true,
      clauses: clauses.length,
      deadlines: deadlines.length,
      paymentMilestones: paymentMilestones.length
    });
  } catch (error) {
    if (error.code === 'STALE_CONTRACT') {
      return res.status(409).json({ error: 'Contract changed or is no longer an initial draft' });
    }
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

// Ephemeral chat context. Bound it so abandoned sessions cannot grow forever.
const chatSessions = new Map();
const CHAT_TTL_MS = 60 * 60 * 1000;
const MAX_CHAT_SESSIONS = 1000;

function getChatHistory(key) {
  const session = chatSessions.get(key);
  if (!session) return [];
  if (session.expiresAt <= Date.now()) {
    chatSessions.delete(key);
    return [];
  }
  return session.messages;
}

function saveChatHistory(key, messages) {
  chatSessions.delete(key);
  chatSessions.set(key, { messages: messages.slice(-10), expiresAt: Date.now() + CHAT_TTL_MS });
  while (chatSessions.size > MAX_CHAT_SESSIONS) {
    chatSessions.delete(chatSessions.keys().next().value);
  }
}

// Chat with contract
router.post('/contracts/:id/chat', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { question } = req.body;

  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'Question required' });
  }

  try {
    const contract = await new Promise((resolve, reject) =>
      db.get('SELECT content FROM contracts WHERE id = ?', [id],
        (error, row) => error ? reject(error) : resolve(row)));
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (!contract.content) return res.status(400).json({ error: 'Contract has no content' });
    const sessionKey = `${req.user.userId}:${id}`;
    const chatHistory = getChatHistory(sessionKey);
    const answer = await chatWithContract(question, contract.content, chatHistory);
    saveChatHistory(sessionKey, [
      ...chatHistory,
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    ]);
    res.json({ answer });
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
  const sessionKey = `${req.user.userId}:${id}`;
  const chatHistory = getChatHistory(sessionKey);

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
