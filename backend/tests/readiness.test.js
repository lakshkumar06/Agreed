import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sqlite3 from 'sqlite3';
import { createReadinessHandler } from '../readiness.js';

function responseFor(database, isShuttingDown) {
  return new Promise(resolve => {
    const response = {
      code: 200,
      status(code) { this.code = code; return this; },
      json(body) { resolve({ code: this.code, body }); },
    };
    createReadinessHandler(database, isShuttingDown)({}, response);
  });
}

test('readiness requires a working database and rejects draining requests', async () => {
  const healthy = { get: (_sql, callback) => callback(null, { ok: 1 }) };
  const failed = { get: (_sql, callback) => callback(new Error('closed')) };
  assert.deepEqual(await responseFor(healthy, () => false), { code: 200, body: { status: 'ready' } });
  assert.deepEqual(await responseFor(failed, () => false), { code: 503, body: { status: 'unavailable' } });
  assert.deepEqual(await responseFor({ get: () => assert.fail('database should not be queried') }, () => true),
    { code: 503, body: { status: 'unavailable' } });
});

test('server closes cleanly on SIGTERM after becoming ready', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'agreed-ready-'));
  const databasePath = join(directory, 'test.db');
  const port = 35000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DB_PATH: databasePath, PORT: String(port),
      JWT_SECRET: 'test-secret-that-is-longer-than-32-characters', SHUTDOWN_TIMEOUT_MS: '2000' },
    stdio: 'ignore',
  });
  t.after(async () => { if (child.exitCode === null) child.kill('SIGKILL'); await rm(directory, { recursive: true, force: true }); });

  let response;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/ready`);
      if (response.ok) break;
    } catch {}
    if (child.exitCode !== null) throw new Error(`server exited: ${child.exitCode}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(response?.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });

  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  let timeout;
  const [code, signal] = await Promise.race([
    exited,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('shutdown timed out')), 3000);
    }),
  ]).finally(() => clearTimeout(timeout));
  assert.equal(signal, null);
  assert.equal(code, 0);
  const database = new sqlite3.Database(databasePath);
  try {
    const result = await new Promise((resolve, reject) =>
      database.get('PRAGMA integrity_check', (error, row) => error ? reject(error) : resolve(row)));
    assert.equal(result.integrity_check, 'ok');
  } finally {
    await new Promise(resolve => database.close(resolve));
  }
});
