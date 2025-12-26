import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import sqlite3 from 'sqlite3';
import { parseAnalysisArray } from '../services/aiService.js';

test('AI extraction rejects malformed and non-array responses', () => {
  assert.deepEqual(parseAnalysisArray('```json\n[]\n```'), []);
  assert.throws(() => parseAnalysisArray('No clauses found'), SyntaxError);
  assert.throws(() => parseAnalysisArray('{"clauses":[]}'), TypeError);
});

test('invitation acceptance is single-use under concurrent requests', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'agreed-invitations-'));
  const databasePath = join(directory, 'test.db');
  const port = 34000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DB_PATH: databasePath, PORT: String(port), JWT_SECRET: 'test-secret-that-is-longer-than-32-characters' },
    stdio: 'ignore',
  });
  t.after(async () => { child.kill(); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}/api`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) throw new Error(`server exited: ${child.exitCode}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, 'server became ready');
  const post = async (path, body, token) => {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  const owner = await post('/auth/register', { name: 'Owner', email: 'owner@example.com', password: 'secure password 123' });
  const member = await post('/auth/register', { name: 'Member', email: 'member@example.com', password: 'secure password 123' });
  assert.equal(owner.status, 200);
  assert.equal(member.status, 200);
  const org = await post('/orgs', { name: 'Test Org' }, owner.data.token);
  assert.equal(org.status, 200);
  const invite = await post('/orgs/members', { email: 'member@example.com' }, owner.data.token);
  assert.equal(invite.status, 200);
  const orgAccepts = await Promise.all([
    post(`/orgs/members/invite/${invite.data.invitation.token}/accept`, {}, member.data.token),
    post(`/orgs/members/invite/${invite.data.invitation.token}/accept`, {}, member.data.token),
  ]);
  assert.deepEqual(orgAccepts.map(result => result.status).sort(), [200, 404]);

  const database = new sqlite3.Database(databasePath);
  const run = (sql, values = []) => new Promise((resolve, reject) =>
    database.run(sql, values, error => error ? reject(error) : resolve()));
  const get = (sql, values = []) => new Promise((resolve, reject) =>
    database.get(sql, values, (error, row) => error ? reject(error) : resolve(row)));
  try {
    assert.equal((await get('SELECT org_id FROM users WHERE id = ?', [member.data.user.id])).org_id, org.data.organization.id);
    await run('INSERT INTO contracts (id, title, created_by) VALUES (?, ?, ?)', ['contract', 'Terms', owner.data.user.id]);
    await run(`INSERT INTO contract_invitations
      (id, contract_id, email, role_in_contract, invitation_token, invited_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['invite', 'contract', 'member@example.com', 'Reviewer', 'single-use-token', owner.data.user.id, new Date(Date.now() + 60000).toISOString()]);
    const contractAccepts = await Promise.all([
      post('/contracts/invite/single-use-token/accept', {}, member.data.token),
      post('/contracts/invite/single-use-token/accept', {}, member.data.token),
    ]);
    assert.deepEqual(contractAccepts.map(result => result.status).sort(), [200, 404]);
    assert.equal((await get('SELECT COUNT(*) AS count FROM contract_members WHERE contract_id = ? AND user_id = ?', ['contract', member.data.user.id])).count, 1);
    assert.equal((await get('SELECT status FROM contract_invitations WHERE id = ?', ['invite'])).status, 'accepted');
  } finally {
    await new Promise(resolve => database.close(resolve));
  }
});

test('migrations finish before readiness and AI analysis commits atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'agreed-reliability-'));
  process.env.DB_PATH = join(directory, 'test.db');
  const { db, initDatabase, closeDatabase } = await import('../database/init.js');
  const { replaceContractAnalysis } = await import('../database/contractAnalysis.js');
  const run = (sql, values = []) => new Promise((resolve, reject) =>
    db.run(sql, values, error => error ? reject(error) : resolve()));
  const get = (sql, values = []) => new Promise((resolve, reject) =>
    db.get(sql, values, (error, row) => error ? reject(error) : resolve(row)));
  try {
    await initDatabase();
    await initDatabase();
    assert.ok(await get("SELECT name FROM sqlite_master WHERE name = 'payment_milestone_suggestions'"));
    assert.ok((await get("SELECT COUNT(*) AS count FROM pragma_table_info('contracts') WHERE name = 'ipfs_hash'")).count);
    await run("INSERT INTO users (id, name) VALUES ('owner', 'Owner')");
    await run("INSERT INTO contracts (id, title, created_by, content, current_version) VALUES ('contract', 'Terms', 'owner', 'old', 'initial')");
    await run("INSERT INTO contract_versions (id, contract_id, version_number, author_id, content) VALUES ('initial', 'contract', 1, 'owner', 'old')");
    const first = {
      clauses: [{ title: 'Old clause', content: 'Old text' }],
      deadlines: [{ description: 'Old deadline', date: '2025-12-01' }],
      paymentMilestones: [{ description: 'Old payment' }],
    };
    await replaceContractAnalysis('contract', 'first content', first, 'old', 'owner', 'test-ipfs-hash');
    assert.equal((await get("SELECT content FROM contracts WHERE id = 'contract'")).content, 'first content');
    assert.equal((await get("SELECT ipfs_hash FROM contracts WHERE id = 'contract'")).ipfs_hash, 'test-ipfs-hash');
    assert.deepEqual(await get("SELECT content, ipfs_hash FROM contract_versions WHERE id = 'initial'"),
      { content: 'first content', ipfs_hash: 'test-ipfs-hash' });
    await run("UPDATE contracts SET status = 'review' WHERE id = 'contract'");
    await assert.rejects(replaceContractAnalysis('contract', 'rewrite history', first, 'first content', 'owner', 'another-hash'),
      error => error.code === 'STALE_CONTRACT');
    await run("UPDATE contracts SET status = 'draft' WHERE id = 'contract'");
    assert.equal((await get("SELECT COUNT(*) AS count FROM contract_clauses WHERE contract_id = 'contract'")).count, 1);
    await assert.rejects(
      replaceContractAnalysis('contract', 'stale content', first, 'old'),
      error => error.code === 'STALE_CONTRACT'
    );
    assert.equal((await get("SELECT content FROM contracts WHERE id = 'contract'")).content, 'first content');
    await assert.rejects(replaceContractAnalysis('contract', 'bad content', { ...first, clauses: [{ title: 'missing content' }] }), TypeError);
    assert.equal((await get("SELECT content FROM contracts WHERE id = 'contract'")).content, 'first content');

    await run(`CREATE TRIGGER fail_deadline BEFORE INSERT ON contract_deadlines
      BEGIN SELECT RAISE(ABORT, 'forced failure'); END`);
    await assert.rejects(replaceContractAnalysis('contract', 'second content', {
      clauses: [{ title: 'New clause', content: 'New text' }],
      deadlines: [{ description: 'New deadline' }],
      paymentMilestones: [],
    }), /forced failure/);
    assert.equal((await get("SELECT content FROM contracts WHERE id = 'contract'")).content, 'first content');
    assert.equal((await get("SELECT title FROM contract_clauses WHERE contract_id = 'contract'")).title, 'Old clause');
    assert.equal((await get("SELECT description FROM contract_deadlines WHERE contract_id = 'contract'")).description, 'Old deadline');
  } finally {
    await closeDatabase();
    await rm(directory, { recursive: true, force: true });
  }
});
