import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('version writes are atomic and concurrent edits cannot reuse a parent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'agreed-versions-'));
  process.env.DB_PATH = join(directory, 'test.db');
  const { db, initDatabase, closeDatabase } = await import('../database/init.js');
  const { commitVersion, recordVersionVote, mergeVersion } = await import('../routes/versions.js');
  const run = (sql, values = []) => new Promise((resolve, reject) => db.run(sql, values, error => error ? reject(error) : resolve()));
  const get = (sql, values = []) => new Promise((resolve, reject) => db.get(sql, values, (error, row) => error ? reject(error) : resolve(row)));
  try {
    await initDatabase();
    await run("INSERT INTO users (id, name) VALUES ('owner', 'Owner'), ('reviewer', 'Reviewer')");
    await run("INSERT INTO contracts (id, title, created_by) VALUES ('contract', 'Terms', 'owner')");
    await run(`INSERT INTO contract_members (id, contract_id, user_id, role_in_contract)
      VALUES ('cm1', 'contract', 'owner', 'Creator'), ('cm2', 'contract', 'reviewer', 'Reviewer')`);
    const base = { contractId: 'contract', userId: 'owner', commitMessage: 'Change terms', ipfsHash: 'fake-ipfs-hash' };
    const first = await commitVersion({ ...base, content: 'First terms', expectedParentId: null, oldContent: '' });
    assert.equal(first.version_number, 1);
    assert.equal(first.content, 'First terms');
    assert.equal(first.approval_status, 'pending');
    assert.equal((await get("SELECT current_version FROM contracts WHERE id = 'contract'")).current_version, null);

    const next = await Promise.allSettled([
      commitVersion({ ...base, content: 'Second terms', expectedParentId: first.id, oldContent: first.content }),
      commitVersion({ ...base, content: 'Competing terms', expectedParentId: first.id, oldContent: first.content }),
    ]);
    assert.equal(next.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(next.find(result => result.status === 'rejected').reason.status, 409);
    assert.equal((await get("SELECT COUNT(*) AS count FROM contract_versions WHERE contract_id = 'contract'")).count, 2);
    assert.equal((await get('SELECT COUNT(*) AS count FROM contract_diffs')).count, 1);

    await run(`CREATE TRIGGER fail_approval BEFORE INSERT ON contract_approvals
      BEGIN SELECT RAISE(ABORT, 'forced approval failure'); END`);
    const newest = next.find(result => result.status === 'fulfilled').value;
    await assert.rejects(commitVersion({ ...base, content: 'Should roll back', expectedParentId: newest.id, oldContent: newest.content }), /forced approval failure/);
    assert.equal((await get("SELECT COUNT(*) AS count FROM contract_versions WHERE contract_id = 'contract'")).count, 2);
    assert.equal((await get('SELECT COUNT(*) AS count FROM contract_diffs')).count, 1);
    await run('DROP TRIGGER fail_approval');

    const vote = await recordVersionVote({ contractId: 'contract', versionId: first.id, userId: 'reviewer', vote: 'approve' });
    assert.equal(vote.status, 'merged');
    assert.equal((await get("SELECT current_version FROM contracts WHERE id = 'contract'")).current_version, first.id);
    await assert.rejects(recordVersionVote({ contractId: 'contract', versionId: first.id, userId: 'reviewer', vote: 'reject' }), error => error.status === 409);

    const secondVote = await recordVersionVote({ contractId: 'contract', versionId: newest.id, userId: 'reviewer', vote: 'approve' });
    assert.equal(secondVote.status, 'merged');

    await run("DELETE FROM contract_members WHERE id = 'cm2'");
    const solo = await commitVersion({ ...base, content: 'Solo change', expectedParentId: newest.id, oldContent: newest.content });
    assert.equal(solo.approval_status, 'approved');
    await mergeVersion({ contractId: 'contract', versionId: solo.id, userId: 'owner' });
    assert.equal((await get('SELECT current_version FROM contracts WHERE id = ?', ['contract'])).current_version, solo.id);
    await assert.rejects(mergeVersion({ contractId: 'contract', versionId: solo.id, userId: 'owner' }), error => error.status === 409);
  } finally {
    await closeDatabase();
    await rm(directory, { recursive: true, force: true });
  }
});
