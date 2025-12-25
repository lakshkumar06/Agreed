import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from './transaction.js';

function requireEntries(entries, fields) {
  if (!Array.isArray(entries) || entries.length > 200) {
    throw new TypeError('AI analysis must contain an array of at most 200 entries');
  }
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' ||
        fields.some(field => typeof entry[field] !== 'string' || !entry[field].trim())) {
      throw new TypeError('AI analysis contains an invalid entry');
    }
  }
}

export async function replaceContractAnalysis(contractId, fileContent, analysis, expectedContent, userId, ipfsHash) {
  if (typeof fileContent !== 'string' || !fileContent.trim()) {
    throw new TypeError('Contract content is required');
  }
  const { clauses, deadlines, paymentMilestones } = analysis;
  requireEntries(clauses, ['title', 'content']);
  requireEntries(deadlines, ['description']);
  requireEntries(paymentMilestones, ['description']);

  return withTransaction(async ({ run, get }) => {
    let initialVersion;
    if (ipfsHash) {
      initialVersion = await get(`SELECT v.id FROM contract_versions v
        JOIN contracts c ON c.id = v.contract_id
        WHERE c.id = ? AND c.created_by = ? AND c.status = 'draft'
          AND c.current_version = v.id AND v.version_number = 1
          AND v.onchain_tx_hash IS NULL`, [contractId, userId]);
      if (!initialVersion) {
        const error = new Error('Initial draft is no longer editable');
        error.code = 'STALE_CONTRACT';
        throw error;
      }
    }
    const compareContent = expectedContent !== undefined;
    const checkAccess = userId !== undefined;
    const { changes } = await run(
      `UPDATE contracts SET content = ?, ${ipfsHash ? 'ipfs_hash = ?,' : ''} updated_at = CURRENT_TIMESTAMP
       WHERE id = ?${compareContent ? ' AND content IS ?' : ''}
       ${ipfsHash ? 'AND created_by = ?' : checkAccess ? `AND (created_by = ? OR EXISTS (
         SELECT 1 FROM contract_members WHERE contract_id = ? AND user_id = ?
       ))` : ''}`,
      [fileContent, ...(ipfsHash ? [ipfsHash] : []), contractId,
        ...(compareContent ? [expectedContent] : []),
        ...(ipfsHash ? [userId] : checkAccess ? [userId, contractId, userId] : [])]
    );
    if (changes !== 1) {
      const error = new Error('Contract changed during analysis');
      error.code = 'STALE_CONTRACT';
      throw error;
    }
    if (initialVersion) {
      await run('UPDATE contract_versions SET content = ?, ipfs_hash = ? WHERE id = ?',
        [fileContent, ipfsHash, initialVersion.id]);
    }
    await run('DELETE FROM contract_clauses WHERE contract_id = ?', [contractId]);
    await run('DELETE FROM contract_deadlines WHERE contract_id = ?', [contractId]);
    // On-chain suggestions are retained as an audit of what was synchronized.
    await run('DELETE FROM payment_milestone_suggestions WHERE contract_id = ? AND synced_to_chain = 0', [contractId]);
    for (const [index, clause] of clauses.entries()) {
      await run('INSERT INTO contract_clauses (id, contract_id, title, content, category, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), contractId, clause.title, clause.content, clause.category || 'General', index]);
    }
    for (const deadline of deadlines) {
      await run('INSERT INTO contract_deadlines (id, contract_id, description, date, clause_reference) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), contractId, deadline.description, deadline.date || 'TBD', deadline.clause_reference || '']);
    }
    for (const milestone of paymentMilestones) {
      await run('INSERT INTO payment_milestone_suggestions (id, contract_id, description, estimated_amount, deadline, suggested_recipient) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), contractId, milestone.description, milestone.estimated_amount || 'TBD', milestone.deadline || 'TBD', milestone.suggested_recipient || 'TBD']);
    }
  });
}
