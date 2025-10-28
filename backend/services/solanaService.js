import crypto from 'crypto';
import { Connection, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';

const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// Generate SHA256 hash of contract content
export function generateContractHash(contractText) {
  return crypto.createHash('sha256').update(contractText, 'utf8').digest('hex');
}

// Store contract proof on Solana devnet
export async function storeContractProofOnChain(contractHash, userWalletAddress, signerPrivateKey) {
  try {
    // Create connection to Solana devnet
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Create keypair from private key (handle JSON array format from Solana CLI)
    let signer;
    try {
      // First try to decode as base64 JSON array (Solana CLI format)
      const decodedString = Buffer.from(signerPrivateKey, 'base64').toString('utf8');
      const keyArray = JSON.parse(decodedString);
      
      if (Array.isArray(keyArray) && keyArray.length === 64) {
        const privateKeyBytes = Buffer.from(keyArray);
        signer = Keypair.fromSecretKey(privateKeyBytes);
      } else {
        throw new Error('Invalid JSON array format');
      }
    } catch (error) {
      // If JSON parsing fails, try direct base64
      try {
        const privateKeyBytes = Buffer.from(signerPrivateKey, 'base64');
        if (privateKeyBytes.length === 64) {
          signer = Keypair.fromSecretKey(privateKeyBytes);
        } else {
          throw new Error('Invalid base64 length');
        }
      } catch (base64Error) {
        // If base64 fails, try as base58
        try {
          const bs58 = await import('bs58');
          const privateKeyBytes = bs58.default.decode(signerPrivateKey);
          signer = Keypair.fromSecretKey(privateKeyBytes);
        } catch (bs58Error) {
          throw new Error('Invalid private key format. Expected base64-encoded JSON array from Solana CLI.');
        }
      }
    }
    
    // Create memo instruction with contract proof and original author address
    const memoText = `ClausebaseProof:${contractHash}:CreatedBy:${userWalletAddress}`;
    const memoData = Buffer.from(memoText, 'utf8');
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: memoData
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(memoInstruction);
    
    // Get recent blockhash with longer timeout
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signer.publicKey;
    
    // Sign transaction
    transaction.sign(signer);
    
    // Send transaction
    const signature = await connection.sendTransaction(transaction, [signer], {
      skipPreflight: true,
      preflightCommitment: 'confirmed'
    });
    
    // Confirm transaction with longer timeout
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');
    
    console.log(`Contract proof stored on-chain: ${signature}`);
    return signature;
    
  } catch (error) {
    console.error('Error storing contract proof on-chain:', error);
    throw new Error(`Failed to store proof on-chain: ${error.message}`);
  }
}

// Verify contract proof exists on-chain
export async function verifyContractProofOnChain(txHash) {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const transaction = await connection.getTransaction(txHash, {
      commitment: 'confirmed'
    });
    
    if (!transaction) {
      return { exists: false, error: 'Transaction not found' };
    }
    
    // Check if transaction was successful
    if (transaction.meta?.err) {
      return { exists: false, error: 'Transaction failed' };
    }
    
    return { exists: true, transaction };
    
  } catch (error) {
    console.error('Error verifying contract proof:', error);
    return { exists: false, error: error.message };
  }
}
