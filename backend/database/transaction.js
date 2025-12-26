import sqlite3 from 'sqlite3';
import { dbPath } from './init.js';

export async function withTransaction(work) {
  const connection = new sqlite3.Database(dbPath);
  const run = (sql, values = []) => new Promise((resolve, reject) =>
    connection.run(sql, values, function(error) {
      error ? reject(error) : resolve({ changes: this.changes, lastID: this.lastID });
    }));
  const get = (sql, values = []) => new Promise((resolve, reject) =>
    connection.get(sql, values, (error, row) => error ? reject(error) : resolve(row)));
  const all = (sql, values = []) => new Promise((resolve, reject) =>
    connection.all(sql, values, (error, rows) => error ? reject(error) : resolve(rows)));
  const close = () => new Promise((resolve, reject) =>
    connection.close(error => error ? reject(error) : resolve()));
  let begun = false;
  try {
    await run('PRAGMA busy_timeout = 5000');
    await run('PRAGMA foreign_keys = ON');
    await run('BEGIN IMMEDIATE');
    begun = true;
    const result = await work({ run, get, all });
    await run('COMMIT');
    begun = false;
    return result;
  } catch (error) {
    if (begun) await run('ROLLBACK').catch(rollbackError => { error.cause = rollbackError; });
    throw error;
  } finally {
    await close();
  }
}
