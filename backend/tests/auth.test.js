import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import bs58 from 'bs58';
import sqlite3 from 'sqlite3';

test('authentication rejects unsigned wallets and consumes signed challenges once', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'agreed-auth-'));
  const port = 33000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DB_PATH: join(dir, 'test.db'), PORT: String(port), JWT_SECRET: 'test-secret-that-is-longer-than-32-characters' },
    stdio: 'ignore',
  });
  t.after(async () => { child.kill(); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}/api`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    if (child.exitCode !== null) throw new Error(`server exited: ${child.exitCode}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const post = async (path, body, token) => {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  const register = await post('/auth/register', { name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' });
  assert.equal(register.status, 200);
  assert.equal((await post('/auth/login', { wallet_address: 'someone-elses-wallet' })).status, 400);
  assert.equal((await post('/auth/login', { email: 'ada@example.com', password: 'wrong' })).status, 401);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawKey = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const wallet_address = bs58.encode(rawKey);
  const challenge = await post('/auth/wallet/challenge', { wallet_address });
  assert.equal(challenge.status, 200);
  const message = challenge.data.message;
  const signature = sign(null, Buffer.from(message), privateKey).toString('base64');
  const proof = { wallet_address, message, signature };
  const unsigned = await fetch(`${base}/auth/wallet`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${register.data.token}` }, body: JSON.stringify({ wallet_address }) });
  assert.equal(unsigned.status, 401);
  const link = await fetch(`${base}/auth/wallet`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${register.data.token}` }, body: JSON.stringify(proof) });
  assert.equal(link.status, 200);
  assert.equal((await post('/auth/wallet/login', proof)).status, 401);
  const second = await post('/auth/wallet/challenge', { wallet_address });
  const login = await post('/auth/wallet/login', { wallet_address, message: second.data.message, signature: sign(null, Buffer.from(second.data.message), privateKey).toString('base64') });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.email, 'ada@example.com');

  const outsider = await post('/auth/register', { name: 'Grace', email: 'grace@example.com', password: 'another secure password' });
  assert.equal(outsider.status, 200);
  const database = new sqlite3.Database(join(dir, 'test.db'));
  await new Promise((resolve, reject) => database.run(
    'INSERT INTO contracts (id, title, created_by) VALUES (?, ?, ?)',
    ['private-contract', 'Private agreement', register.data.user.id], err => err ? reject(err) : resolve()
  ));
  await new Promise(resolve => database.close(resolve));
  for (const path of ['/contracts/private-contract/members', '/contracts/private-contract/clauses', '/contracts/private-contract/chat']) {
    const response = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${outsider.data.token}` } });
    assert.equal(response.status, 404, path);
  }
  const own = await fetch(`${base}/contracts/private-contract/members`, { headers: { authorization: `Bearer ${register.data.token}` } });
  assert.equal(own.status, 200);
  const outsiderStatus = await fetch(`${base}/contracts/private-contract/status`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${outsider.data.token}` }, body: JSON.stringify({ status: 'review' }) });
  assert.equal(outsiderStatus.status, 404);
  const ownerStatus = await fetch(`${base}/contracts/private-contract/status`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${register.data.token}` }, body: JSON.stringify({ status: 'review' }) });
  assert.equal(ownerStatus.status, 200);
  const addMember = await post('/contracts/private-contract/members', { user_id: outsider.data.user.id, role_in_contract: 'Reviewer' }, register.data.token);
  assert.equal(addMember.status, 200);
});
