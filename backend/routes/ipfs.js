import express from 'express';
import { authenticateToken } from './auth.js';
import { uploadToIPFS as uploadContent } from '../services/ipfsService.js';

const router = express.Router();

// Upload content to IPFS
router.post('/ipfs/upload', authenticateToken, async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content required' });
  }

  try {
    const ipfsHash = await uploadContent(content);
    res.json({ ipfs_hash: ipfsHash });
  } catch (error) {
    console.error('[IPFS] Error uploading content:', error);
    res.status(500).json({ error: 'Failed to upload to IPFS' });
  }
});

export default router;

