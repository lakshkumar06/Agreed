import test from 'node:test';
import assert from 'node:assert/strict';
import bs58 from 'bs58';
import { transactionContainsProof } from '../services/solanaService.js';

const memoProgram = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgd6ofga5DgLRkJrFb';
const hash = 'a'.repeat(64);
const wallet = 'ExampleWallet';
const data = bs58.encode(Buffer.from(`ClausebaseProof:${hash}:CreatedBy:${wallet}`));

test('proof verification checks the memo, hash, wallet, and transaction result', () => {
  const transaction = {
    meta: { err: null },
    transaction: { message: {
      accountKeys: [memoProgram],
      instructions: [{ programIdIndex: 0, data }],
    } },
  };
  assert.equal(transactionContainsProof(transaction, hash, wallet), true);
  assert.equal(transactionContainsProof(transaction, 'b'.repeat(64), wallet), false);
  assert.equal(transactionContainsProof(transaction, hash, 'AnotherWallet'), false);
  assert.equal(transactionContainsProof({ ...transaction, meta: { err: 'failed' } }, hash, wallet), false);
  assert.equal(transactionContainsProof({ ...transaction, transaction: { message: { accountKeys: ['OtherProgram'], instructions: [{ programIdIndex: 0, data }] } } }, hash, wallet), false);
});
