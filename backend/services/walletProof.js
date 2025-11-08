import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import bs58 from 'bs58';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function createChallenge(walletAddress) {
  const nonce = randomBytes(32).toString('hex');
  const message = `Agreed wallet verification\nWallet: ${walletAddress}\nNonce: ${nonce}`;
  return { message, hash: hashChallenge(message), expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() };
}

export function hashChallenge(message) {
  return createHash('sha256').update(message).digest('hex');
}

export function verifyWalletSignature(walletAddress, message, signature) {
  try {
    const rawKey = bs58.decode(walletAddress);
    const rawSignature = Buffer.from(signature, 'base64');
    if (rawKey.length !== 32 || rawSignature.length !== 64) return false;
    // DER prefix for an Ed25519 SubjectPublicKeyInfo followed by the 32-byte public key.
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(rawKey)]), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(message, 'utf8'), key, rawSignature);
  } catch {
    return false;
  }
}
