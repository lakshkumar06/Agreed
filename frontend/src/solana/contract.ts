import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { ensureReputationExists } from "./reputation";
import idl from "../../../agreed_contracts/target/idl/agreed_contracts.json";
import axios from "axios";

const PROGRAM_ID = new PublicKey("2Ye3UPoTi9t7j1vHq6VsqivGxQWgd6ofga5DgLRkJrFb");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

// Wallet adapter wrapper for Anchor
class WalletAdapter {
  constructor(public wallet: any) {}

  get publicKey() {
    return this.wallet.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    return await this.wallet.signTransaction(tx);
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return await this.wallet.signAllTransactions(txs);
  }
}

/**
 * Upload contract content to IPFS via backend API
 */
async function uploadToIPFS(content: string): Promise<string> {
  const token = localStorage.getItem('token');
  const response = await axios.post(
    `${API_BASE}/ipfs/upload`,
    { content },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.ipfs_hash;
}

/**
 * Initialize a contract on Solana blockchain
 * This creates the on-chain contract account with metadata
 */
export async function initializeContractOnChain(
  walletAdapter: any, // Solana wallet adapter from window.solana
  contractId: string,
  content: string,
  participantWallets: string[],
  requiredApprovals: number
): Promise<{ signature: string; contractPDA: string; ipfsHash: string }> {
  try {
    // Upload content to IPFS
    const ipfsHash = await uploadToIPFS(content);
    console.log("Content uploaded to IPFS:", ipfsHash);

    // Generate numeric ID from UUID for on-chain storage
    // Use a hash of the UUID to generate a u64 BN directly from bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(contractId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashBytes = new Uint8Array(hashBuffer).slice(0, 8);
    
    // Create BN directly from bytes (little-endian)
    const numericIdBN = new anchor.BN(hashBytes, 'le');

    console.log("Contract UUID:", contractId);
    console.log("Numeric ID BN:", numericIdBN.toString());
    console.log("Participant wallets:", participantWallets);

    // Convert participant addresses to PublicKeys
    const participants = participantWallets.map(addr => {
      try {
        return new PublicKey(addr);
      } catch (e) {
        console.error("Invalid wallet address:", addr, e);
        throw new Error(`Invalid participant wallet address: ${addr}`);
      }
    });

    // Create wallet adapter wrapper for Anchor
    const wallet = new WalletAdapter(walletAdapter);

    console.log("Wallet publicKey:", wallet.publicKey?.toString());

    // Ensure creator has reputation account
    await ensureReputationExists(wallet as any);

    // Create provider and program
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    const program = new Program(idl as anchor.Idl, provider);

    console.log("Deriving contract PDA...");
    console.log("- Program ID:", PROGRAM_ID.toString());
    
    // Derive contract PDA
    const [contractPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("contract"),
        numericIdBN.toArrayLike(Buffer, "le", 8),
        wallet.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    
    console.log("Contract PDA derived:", contractPDA.toString());

    // Derive reputation PDA
    const [creatorReputationPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Initialize contract on-chain
    const tx = await program.methods
      .initializeContract(
        numericIdBN,
        participants,
        requiredApprovals
      )
      .accounts({
        contract: contractPDA,
        creatorReputation: creatorReputationPDA,
        creator: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Contract initialized on-chain:", tx);

    return {
      signature: tx,
      contractPDA: contractPDA.toString(),
      ipfsHash,
    };
  } catch (error) {
    console.error("Error initializing contract on-chain:", error);
    throw error;
  }
}

/**
 * Store Solana contract information in backend database
 */
export async function storeSolanaContractInfo(
  contractId: string,
  solanaContractId: number,
  contractPDA: string,
  signature: string,
  ipfsHash: string,
  token: string
): Promise<void> {
  try {
    await axios.post(
      `${API_BASE}/contracts/${contractId}/solana-init`,
      {
        solana_contract_id: solanaContractId,
        contract_pda: contractPDA,
        signature,
        ipfs_hash: ipfsHash,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Solana contract info stored in database");
  } catch (error) {
    console.error("Error storing Solana contract info:", error);
    throw error;
  }
}

/**
 * Get contract PDA address
 */
export function getContractPDA(
  contractId: number,
  creatorPubkey: PublicKey
): PublicKey {
  const [contractPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("contract"),
      new anchor.BN(contractId).toArrayLike(Buffer, "le", 8),
      creatorPubkey.toBuffer(),
    ],
    PROGRAM_ID
  );
  return contractPDA;
}

/**
 * Fetch contract data from blockchain
 */
export async function fetchContractFromChain(
  contractPDA: string
): Promise<any> {
  try {
    // Create a read-only provider (no wallet needed for reading)
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    
    const provider = new AnchorProvider(
      connection,
      dummyWallet as any,
      { commitment: "finalized", skipPreflight: false } // Use finalized to avoid RPC cache issues
    );
    const program = new Program(idl as anchor.Idl, provider);

    console.log("Checking PDA on Solana:", contractPDA);
    
    const contractData = await program.account.contract.fetch(
      new PublicKey(contractPDA)
    );
    
    console.log("✅ Contract FOUND on-chain:", contractPDA);
    return contractData;
  } catch (error: any) {
    // If account doesn't exist, that's expected - return null
    if (error.message?.includes('Account does not exist') || 
        error.message?.includes('AccountNotInitialized') ||
        error.message?.includes('could not find account')) {
      console.log("✓ Contract does NOT exist on-chain (fresh PDA)");
      return null;
    }
    console.error("⚠️ Unexpected error fetching contract from chain:", error.message);
    return null;
  }
}

