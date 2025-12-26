import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/init.js';
import { withTransaction } from '../database/transaction.js';
import { authenticateToken } from './auth.js';
import { updateContractIpfsOnChain } from '../services/solanaService.js';
import { uploadToIPFS, pinToIPFS, retrieveFromIPFS } from '../services/ipfsService.js';

const router = express.Router();

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Simple diff function
function computeDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = [];
  let added = 0, removed = 0;

  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    if (i >= oldLines.length) {
      diff.push({ type: 'add', line: newLines[i], lineNum: i + 1 });
      added++;
    } else if (i >= newLines.length) {
      diff.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
      removed++;
    } else if (oldLines[i] !== newLines[i]) {
      diff.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
      diff.push({ type: 'add', line: newLines[i], lineNum: i + 1 });
      removed++;
      added++;
    }
  }

  return {
    full: diff,
    summary: `${added} additions, ${removed} deletions`
  };
}

// Store contract proof on-chain (content already on IPFS, just update on-chain)
async function storeContractProof(versionId, contractId) {
  console.log('[storeContractProof] START - versionId:', versionId, 'contractId:', contractId);
  return new Promise((resolve, reject) => {
  try {
      // Get version with IPFS hash
      db.get(
        'SELECT ipfs_hash FROM contract_versions WHERE id = ? AND contract_id = ?',
        [versionId, contractId],
        async (err, version) => {
          if (err || !version) {
            console.error('[storeContractProof] Error fetching version:', err);
            return resolve({ ipfsHash: null, txHash: null, error: 'Version not found' });
          }

          if (!version.ipfs_hash) {
            console.warn('[storeContractProof] No IPFS hash for version, cannot update on-chain');
            return resolve({ ipfsHash: null, txHash: null, error: 'No IPFS hash' });
          }

          // Get contract details to find Solana info
          db.get(
            `SELECT c.*, u.wallet_address as creator_wallet
             FROM contracts c
             JOIN users u ON c.created_by = u.id
             WHERE c.id = ?`,
            [contractId],
            async (err, contract) => {
              if (err || !contract) {
                console.error('[storeContractProof] Error fetching contract:', err);
                return resolve({ ipfsHash: null, txHash: null, error: 'Contract not found' });
              }

              console.log('[storeContractProof] Contract fetched - solana_contract_id:', contract.solana_contract_id, 'creator_wallet:', contract.creator_wallet);

              try {
                // Get signer private key from environment
    const signerPrivateKey = process.env.SOLANA_SIGNER_PRIVATE_KEY;
    
    if (!signerPrivateKey) {
                  console.warn('[storeContractProof] SOLANA_SIGNER_PRIVATE_KEY not set, skipping on-chain update');
                  return resolve({ ipfsHash: version.ipfs_hash, txHash: null });
                }

                // Check if contract is initialized on Solana
                if (!contract.solana_contract_id || !contract.creator_wallet) {
                  console.warn('[storeContractProof] Contract not initialized on Solana, skipping on-chain update');
                  return resolve({ ipfsHash: version.ipfs_hash, txHash: null, warning: 'Contract not on-chain' });
    }
    
                // Update IPFS hash on-chain
                console.log('[storeContractProof] Updating IPFS hash on Solana...');
                const result = await updateContractIpfsOnChain(
                  contract.solana_contract_id,
                  version.ipfs_hash,
                  contract.creator_wallet,
                  signerPrivateKey
                );
                console.log('[storeContractProof] On-chain update successful, signature:', result.signature);
    
                // Update database with transaction hash
    db.run(
                  'UPDATE contract_versions SET onchain_tx_hash = ? WHERE id = ?',
                  [result.signature, versionId],
                  (err) => {
                    if (err) console.error('[storeContractProof] Error updating DB with tx hash:', err);
                    else console.log('[storeContractProof] Transaction hash stored in DB');
                  }
    );
    
                return resolve({ ipfsHash: version.ipfs_hash, txHash: result.signature });
    
  } catch (error) {
                console.error('[storeContractProof] Error storing contract proof:', error);
                return resolve({ ipfsHash: version.ipfs_hash, txHash: null, error: error.message });
              }
            }
          );
        }
      );
    } catch (error) {
      console.error('[storeContractProof] Error in storeContractProof:', error);
      return resolve({ ipfsHash: null, txHash: null, error: error.message });
  }
  });
}

// The latest parent is checked again under the write lock. A concurrent editor
// receives a conflict instead of creating two versions with the same number.
export async function commitVersion({ contractId, userId, content, commitMessage, ipfsHash, expectedParentId, oldContent }) {
  return withTransaction(async sql => {
    const contract = await sql.get(`SELECT id, current_version FROM contracts WHERE id = ? AND
      (created_by = ? OR EXISTS (SELECT 1 FROM contract_members WHERE contract_id = ? AND user_id = ?))`,
    [contractId, userId, contractId, userId]);
    if (!contract) throw httpError(404, 'Contract not found');
    const latest = await sql.get('SELECT id, version_number FROM contract_versions WHERE contract_id = ? ORDER BY version_number DESC LIMIT 1', [contractId]);
    if ((latest?.id ?? null) !== expectedParentId) throw httpError(409, 'Contract changed; refresh before editing');
    const versionId = uuidv4();
    const diff = computeDiff(oldContent, content);
    const memberCount = await sql.get('SELECT COUNT(DISTINCT user_id) AS count FROM contract_members WHERE contract_id = ?', [contractId]);
    const approvalStatus = memberCount.count === 1 ? 'approved' : 'pending';
    await sql.run(`INSERT INTO contract_versions
      (id, contract_id, version_number, parent_version_id, author_id, content, ipfs_hash,
       diff_summary, commit_message, merged, approval_status, approval_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1)`,
    [versionId, contractId, (latest?.version_number ?? 0) + 1, latest?.id ?? null,
      userId, content, ipfsHash, diff.summary, commitMessage, approvalStatus]);
    if (latest) await sql.run('INSERT INTO contract_diffs (id, version_from_id, version_to_id, diff_json) VALUES (?, ?, ?, ?)',
      [uuidv4(), latest.id, versionId, JSON.stringify(diff.full)]);
    await sql.run(`INSERT INTO contract_approvals (id, version_id, user_id, vote, comment)
      VALUES (?, ?, ?, 'approve', 'Auto-approved by author')`, [uuidv4(), versionId, userId]);
    return sql.get(`SELECT v.*, u.name AS author_name FROM contract_versions v
      JOIN users u ON u.id = v.author_id WHERE v.id = ?`, [versionId]);
  });
}

router.post('/contracts/:contractId/versions', authenticateToken, async (req, res) => {
  const { contractId } = req.params;
  const { content, commit_message } = req.body;
  if (typeof content !== 'string' || !content.trim() ||
      (commit_message !== undefined && typeof commit_message !== 'string')) {
    return res.status(400).json({ error: 'Content and a valid commit message required' });
  }
  try {
    const contract = await new Promise((resolve, reject) => db.get(`SELECT id FROM contracts WHERE id = ? AND
      (created_by = ? OR EXISTS (SELECT 1 FROM contract_members WHERE contract_id = ? AND user_id = ?))`,
    [contractId, req.user.userId, contractId, req.user.userId], (error, row) => error ? reject(error) : resolve(row)));
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const latest = await new Promise((resolve, reject) => db.get(
      'SELECT id, content, ipfs_hash FROM contract_versions WHERE contract_id = ? ORDER BY version_number DESC LIMIT 1',
      [contractId], (error, row) => error ? reject(error) : resolve(row)));
    let oldContent = latest?.content ?? '';
    if (latest && !latest.content && latest.ipfs_hash) oldContent = await retrieveFromIPFS(latest.ipfs_hash);
    const ipfsHash = await uploadToIPFS(content);
    await pinToIPFS(ipfsHash);
    const version = await commitVersion({ contractId, userId: req.user.userId, content,
      commitMessage: commit_message || '', ipfsHash, expectedParentId: latest?.id ?? null, oldContent });
    res.json({ version });
  } catch (error) {
    if (!error.status) console.error('[CREATE_VERSION] Failed:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to create version' });
  }
});

// Get all versions for a contract
router.get('/contracts/:contractId/versions', authenticateToken, (req, res) => {
  const { contractId } = req.params;

  // Verify contract access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND (created_by = ? OR id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))',
    [contractId, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      db.all(
        `SELECT v.*, u.name as author_name
         FROM contract_versions v
         JOIN users u ON v.author_id = u.id
         WHERE v.contract_id = ?
         ORDER BY v.version_number DESC`,
        [contractId],
        (err, versions) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          // Add default values for approval fields if they don't exist
          const versionsWithDefaults = versions.map(v => ({
            ...v,
            approval_status: v.approval_status || 'pending',
            approval_score: v.approval_score || 0
          }));
          res.json({ versions: versionsWithDefaults });
        }
      );
    }
  );
});

// Get IPFS content for a version
router.get('/contracts/:contractId/versions/:versionId/ipfs', authenticateToken, async (req, res) => {
  const { contractId, versionId } = req.params;

  // Verify contract access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND (created_by = ? OR id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))',
    [contractId, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Get version with IPFS hash
      db.get(
        'SELECT ipfs_hash, content FROM contract_versions WHERE id = ? AND contract_id = ?',
        [versionId, contractId],
        async (err, version) => {
          if (err || !version) {
            return res.status(404).json({ error: 'Version not found' });
          }

          if (!version.ipfs_hash) {
            return res.status(404).json({ 
              error: 'No IPFS hash available for this version',
              message: 'This version was not uploaded to IPFS'
            });
          }

          // Retrieve from IPFS - FAIL if not available (true Web3)
          try {
            const ipfsContent = await retrieveFromIPFS(version.ipfs_hash);
            res.json({ 
              ipfs_hash: version.ipfs_hash,
              content: ipfsContent,
              source: 'ipfs'
            });
          } catch (error) {
            console.error('[IPFS] Failed to retrieve from IPFS:', error.message);
            return res.status(503).json({ 
              error: 'IPFS content unavailable',
              message: 'Failed to retrieve content from IPFS',
              ipfs_hash: version.ipfs_hash
            });
          }
        }
      );
    }
  );
});

// Get specific version
router.get('/contracts/:contractId/versions/:versionId', authenticateToken, (req, res) => {
  const { contractId, versionId } = req.params;

  // Verify contract access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND (created_by = ? OR id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))',
    [contractId, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      db.get(
        `SELECT v.*, u.name as author_name
         FROM contract_versions v
         JOIN users u ON v.author_id = u.id
         WHERE v.id = ? AND v.contract_id = ?`,
        [versionId, contractId],
        (err, version) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          if (!version) {
            return res.status(404).json({ error: 'Version not found' });
          }
          // Add default values for approval fields if they don't exist
          const versionWithDefaults = {
            ...version,
            approval_status: version.approval_status || 'pending',
            approval_score: version.approval_score || 0
          };
          res.json({ version: versionWithDefaults });
        }
      );
    }
  );
});

// Get diff between two versions
router.get('/contracts/:contractId/diff', authenticateToken, (req, res) => {
  const { contractId } = req.params;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Both from and to version IDs required' });
  }

  // Verify contract access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND (created_by = ? OR id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))',
    [contractId, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Get the two versions
      db.all(
        'SELECT * FROM contract_versions WHERE id IN (?, ?) AND contract_id = ? ORDER BY version_number',
        [from, to, contractId],
        (err, versions) => {
          if (err || versions.length !== 2) {
            return res.status(404).json({ error: 'Versions not found' });
          }

          const [v1, v2] = versions;
          const diff = computeDiff(v1.content, v2.content);

          res.json({
            from: v1,
            to: v2,
            diff: diff.full,
            summary: diff.summary
          });
        }
      );
    }
  );
});

// Get contract history
router.get('/contracts/:contractId/history', authenticateToken, (req, res) => {
  const { contractId } = req.params;

  // Verify contract access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND (created_by = ? OR id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))',
    [contractId, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      db.all(
        `SELECT v.id, v.version_number, v.commit_message, v.diff_summary, v.created_at, v.merged, v.content, v.approval_status,
         v.contract_hash, v.onchain_tx_hash, v.ipfs_hash,
         u.name as author_name, u.email as author_email
         FROM contract_versions v
         JOIN users u ON v.author_id = u.id
         WHERE v.contract_id = ? AND v.merged = 1
         ORDER BY v.version_number DESC`,
        [contractId],
        (err, history) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ history });
        }
      );
    }
  );
});

export async function recordVersionVote({ contractId, versionId, userId, vote, comment }) {
  return withTransaction(async sql => {
    const contract = await sql.get(`SELECT id, current_version FROM contracts WHERE id = ? AND
      (created_by = ? OR EXISTS (SELECT 1 FROM contract_members WHERE contract_id = ? AND user_id = ?))`,
    [contractId, userId, contractId, userId]);
    if (!contract) throw httpError(404, 'Contract not found');
    const member = await sql.get('SELECT 1 FROM contract_members WHERE contract_id = ? AND user_id = ?', [contractId, userId]);
    if (!member) throw httpError(403, 'Not a member of this contract');
    const version = await sql.get('SELECT author_id, parent_version_id, merged FROM contract_versions WHERE id = ? AND contract_id = ?', [versionId, contractId]);
    if (!version) throw httpError(404, 'Version not found');
    if (version.merged) throw httpError(409, 'Version is already merged');
    if (version.author_id === userId) throw httpError(403, 'You cannot vote on your own version');
    const approvalId = uuidv4();
    await sql.run(`INSERT INTO contract_approvals (id, version_id, user_id, vote, comment)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(version_id, user_id) DO UPDATE SET
      vote = excluded.vote, comment = excluded.comment, created_at = CURRENT_TIMESTAMP`,
    [approvalId, versionId, userId, vote, comment || null]);
    const members = await sql.all('SELECT DISTINCT user_id FROM contract_members WHERE contract_id = ?', [contractId]);
    const approvals = await sql.all(`SELECT ca.user_id, ca.vote FROM contract_approvals ca
      WHERE ca.version_id = ?`, [versionId]);
    const votes = new Map(approvals.map(row => [row.user_id, row.vote]));
    const approvalCount = members.filter(row => votes.get(row.user_id) === 'approve').length;
    const rejectionCount = members.filter(row => votes.get(row.user_id) === 'reject').length;
    const allApproved = members.length > 0 && approvalCount === members.length;
    const autoMerge = allApproved && (version.parent_version_id ?? null) === (contract.current_version ?? null);
    const status = autoMerge ? 'merged' : allApproved ? 'approved' : rejectionCount > 0 ? 'rejected' : 'pending';
    await sql.run('UPDATE contract_versions SET approval_status = ?, approval_score = ?, merged = ? WHERE id = ?',
      [status, approvalCount, Number(autoMerge), versionId]);
    if (autoMerge) await sql.run('UPDATE contracts SET current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [versionId, contractId]);
    return { approval: { id: approvalId, version_id: versionId, user_id: userId, vote, comment },
      approval_count: approvalCount, rejection_count: rejectionCount, status, auto_merged: autoMerge };
  });
}

router.post('/contracts/:contractId/versions/:versionId/approve', authenticateToken, async (req, res) => {
  const { vote, comment } = req.body;
  if (!['approve', 'reject'].includes(vote) || (comment !== undefined && typeof comment !== 'string')) {
    return res.status(400).json({ error: 'Valid vote and comment required' });
  }
  try {
    const result = await recordVersionVote({ contractId: req.params.contractId, versionId: req.params.versionId,
      userId: req.user.userId, vote, comment });
    if (result.auto_merged) {
      const proof = await storeContractProof(req.params.versionId, req.params.contractId);
      result.onchain_proof = { ipfs_hash: proof.ipfsHash, tx_hash: proof.txHash, error: proof.error, warning: proof.warning };
    }
    res.json(result);
  } catch (error) {
    if (!error.status) console.error('[APPROVE] Failed:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to submit approval' });
  }
});

// Get all approvals for a version
router.get('/contracts/:contractId/versions/:versionId/approvals', authenticateToken, (req, res) => {
  const { contractId, versionId } = req.params;

  // Verify contract access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND (created_by = ? OR id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))',
    [contractId, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      db.all(
        `SELECT ca.*, u.name as user_name, u.email as user_email
         FROM contract_approvals ca
         JOIN contract_versions v ON v.id = ca.version_id AND v.contract_id = ?
         JOIN users u ON ca.user_id = u.id
         WHERE ca.version_id = ?
         ORDER BY ca.created_at DESC`,
        [contractId, versionId],
        (err, approvals) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Get version info
          db.get(
            'SELECT approval_status, approval_score FROM contract_versions WHERE id = ? AND contract_id = ?',
            [versionId, contractId],
            (err, version) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              if (!version) return res.status(404).json({ error: 'Version not found' });

              res.json({
                approvals,
                status: version.approval_status,
                approval_count: approvals.filter(a => a.vote === 'approve').length,
                rejection_count: approvals.filter(a => a.vote === 'reject').length
              });
            }
          );
        }
      );
    }
  );
});

export async function mergeVersion({ contractId, versionId, userId }) {
  return withTransaction(async sql => {
    const contract = await sql.get(`SELECT id, current_version FROM contracts WHERE id = ? AND
      (created_by = ? OR EXISTS (SELECT 1 FROM contract_members WHERE contract_id = ? AND user_id = ?))`,
    [contractId, userId, contractId, userId]);
    if (!contract) throw httpError(404, 'Contract not found');
    const version = await sql.get('SELECT approval_status, parent_version_id, merged FROM contract_versions WHERE id = ? AND contract_id = ?', [versionId, contractId]);
    if (!version) throw httpError(404, 'Version not found');
    if (version.merged) throw httpError(409, 'Version is already merged');
    if (version.approval_status !== 'approved') throw httpError(409, 'Version requires approval');
    if ((version.parent_version_id ?? null) !== (contract.current_version ?? null)) {
      throw httpError(409, 'Parent version must be merged first');
    }
    const members = await sql.all('SELECT DISTINCT user_id FROM contract_members WHERE contract_id = ?', [contractId]);
    const approvals = await sql.all('SELECT user_id, vote FROM contract_approvals WHERE version_id = ?', [versionId]);
    const votes = new Map(approvals.map(row => [row.user_id, row.vote]));
    if (!members.length || !members.every(row => votes.get(row.user_id) === 'approve')) {
      throw httpError(409, 'All current members must approve before merging');
    }
    await sql.run('UPDATE contract_versions SET approval_status = ?, merged = 1 WHERE id = ?', ['merged', versionId]);
    await sql.run('UPDATE contracts SET current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [versionId, contractId]);
  });
}

router.post('/contracts/:contractId/versions/:versionId/merge', authenticateToken, async (req, res) => {
  const { contractId, versionId } = req.params;
  try {
    await mergeVersion({ contractId, versionId, userId: req.user.userId });
    const proof = await storeContractProof(versionId, contractId);
    res.json({ message: 'Version merged successfully', onchain_proof: {
      ipfs_hash: proof.ipfsHash, tx_hash: proof.txHash, error: proof.error, warning: proof.warning } });
  } catch (error) {
    if (!error.status) console.error('[MERGE] Failed:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to merge version' });
  }
});

// Add comment to a version
router.post('/contracts/:contractId/versions/:versionId/comments', authenticateToken, (req, res) => {
  const { contractId, versionId } = req.params;
  const { comment, parent_comment_id } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Comment required' });
  }

  // Verify contract access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND (created_by = ? OR id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))',
    [contractId, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      db.get('SELECT id FROM contract_versions WHERE id = ? AND contract_id = ?', [versionId, contractId], (versionError, version) => {
        if (versionError) return res.status(500).json({ error: 'Database error' });
        if (!version) return res.status(404).json({ error: 'Version not found' });
        if (parent_comment_id) {
          return db.get('SELECT id FROM contract_comments WHERE id = ? AND version_id = ?', [parent_comment_id, versionId], (parentError, parent) => {
            if (parentError) return res.status(500).json({ error: 'Database error' });
            if (!parent) return res.status(404).json({ error: 'Parent comment not found' });
            insertComment();
          });
        }
        insertComment();
      });
      function insertComment() {
        const commentId = uuidv4();
        db.run(
          'INSERT INTO contract_comments (id, version_id, user_id, comment, parent_comment_id) VALUES (?, ?, ?, ?, ?)',
          [commentId, versionId, req.user.userId, comment, parent_comment_id || null],
          function(err) {
            if (err) {
              console.error('Error creating comment:', err);
              return res.status(500).json({ error: 'Failed to add comment' });
            }
            db.get(
              `SELECT c.*, u.name as user_name, u.email as user_email
               FROM contract_comments c
               JOIN users u ON c.user_id = u.id
               WHERE c.id = ?`,
              [commentId],
              (readError, commentData) => {
                if (readError) return res.status(500).json({ error: 'Database error' });
                res.json({ comment: commentData });
              }
            );
          }
        );
      }
    }
  );
});

// Get comments for a version
router.get('/contracts/:contractId/versions/:versionId/comments', authenticateToken, (req, res) => {
  const { contractId, versionId } = req.params;

  // Verify contract access
  db.get(
    'SELECT * FROM contracts WHERE id = ? AND (created_by = ? OR id IN (SELECT contract_id FROM contract_members WHERE user_id = ?))',
    [contractId, req.user.userId, req.user.userId],
    (err, contract) => {
      if (err || !contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      db.get('SELECT id FROM contract_versions WHERE id = ? AND contract_id = ?', [versionId, contractId], (versionError, version) => {
        if (versionError) return res.status(500).json({ error: 'Database error' });
        if (!version) return res.status(404).json({ error: 'Version not found' });
      db.all(
        `SELECT c.*, u.name as user_name, u.email as user_email
         FROM contract_comments c
         JOIN contract_versions v ON v.id = c.version_id AND v.contract_id = ?
         JOIN users u ON c.user_id = u.id
         WHERE c.version_id = ?
         ORDER BY c.created_at ASC`,
        [contractId, versionId],
        (err, comments) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ comments });
        }
      );
      });
    }
  );
});

export default router;
