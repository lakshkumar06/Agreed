import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { ensureReputationExists } from "./reputation";
import idl from "../../../agreed_contracts/target/idl/agreed_contracts.json";

const PROGRAM_ID = new PublicKey("2Ye3UPoTi9t7j1vHq6VsqivGxQWgd6ofga5DgLRkJrFb");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

export interface ContractData {
  contractId: anchor.BN;
  creator: PublicKey;
  participants: PublicKey[];
  status: { active?: {}; completed?: {}; cancelled?: {} };
  requiredApprovals: number;
  currentApprovals: number;
  approvers: PublicKey[];
  ipfsHash: string;
  createdAt: anchor.BN;
  bump: number;
}

export async function initializeContract(
  wallet: anchor.Wallet,
  contractId: number,
  participants: PublicKey[],
  requiredApprovals: number
): Promise<{ signature: string; contractPDA: PublicKey }> {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  
  const program = new Program(idl as anchor.Idl, provider);
  
  // Ensure creator has reputation account
  const [creatorRepPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("reputation"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );

  try {
    await program.account.userReputation.fetch(creatorRepPDA);
  } catch (e) {
    console.log("Creating reputation account first...");
    await ensureReputationExists(wallet);
  }
  
  const [contractPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("contract"),
      new anchor.BN(contractId).toArrayLike(Buffer, "le", 8),
      wallet.publicKey.toBuffer(),
    ],
    PROGRAM_ID
  );

  const tx = await program.methods
    .initializeContract(
      new anchor.BN(contractId),
      participants,
      requiredApprovals
    )
    .accounts({
      contract: contractPDA,
      creatorReputation: creatorRepPDA,
      creator: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  return { signature: tx, contractPDA };
}

export async function approveContract(
  wallet: anchor.Wallet,
  contractId: number,
  creatorPubkey: PublicKey
): Promise<string> {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  
  const program = new Program(idl as anchor.Idl, provider);
  
  // Ensure approver has reputation account
  const [approverRepPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("reputation"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );

  try {
    await program.account.userReputation.fetch(approverRepPDA);
  } catch (e) {
    console.log("Creating reputation account first...");
    await ensureReputationExists(wallet);
  }
  
  const [contractPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("contract"),
      new anchor.BN(contractId).toArrayLike(Buffer, "le", 8),
      creatorPubkey.toBuffer(),
    ],
    PROGRAM_ID
  );

  const tx = await program.methods
    .approveContract()
    .accounts({
      contract: contractPDA,
      approverReputation: approverRepPDA,
      approver: wallet.publicKey,
    })
    .rpc();

  return tx;
}

export async function cancelContract(
  wallet: anchor.Wallet,
  contractId: number
): Promise<string> {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  
  const program = new Program(idl as anchor.Idl, provider);
  
  const [contractPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("contract"),
      new anchor.BN(contractId).toArrayLike(Buffer, "le", 8),
      wallet.publicKey.toBuffer(),
    ],
    PROGRAM_ID
  );

  const tx = await program.methods
    .cancelContract()
    .accounts({
      contract: contractPDA,
      creator: wallet.publicKey,
    })
    .rpc();

  return tx;
}

export async function fetchContract(
  contractPDA: PublicKey
): Promise<ContractData | null> {
  const provider = new anchor.AnchorProvider(connection, {} as any, {});
  
  const program = new Program(idl as anchor.Idl, provider);
  
  const contract = await program.account.contract.fetch(contractPDA);
  return contract as ContractData;
}

// Fetch by PDA (string) with finalized commitment to avoid RPC cache
export async function fetchContractByPDA(
  contractPDA: string
): Promise<ContractData | null> {
  try {
    const provider = new anchor.AnchorProvider(
      connection,
      {} as any,
      { commitment: "finalized" }
    );
    const program = new Program(idl as anchor.Idl, provider);
    const data = await program.account.contract.fetch(new PublicKey(contractPDA));
    return data as ContractData;
  } catch (e) {
    return null;
  }
}

export function getContractPDA(
  contractId: number | string,
  creatorPubkey: PublicKey
): PublicKey {
  // Handle both number and string, create BN properly from BigInt
  const contractIdBigInt = typeof contractId === 'string' 
    ? BigInt(contractId)
    : BigInt(contractId);
  
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(contractIdBigInt);
  const contractIdBN = new anchor.BN(buffer, 'le');
    
  const [contractPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("contract"),
      contractIdBN.toArrayLike(Buffer, "le", 8),
      creatorPubkey.toBuffer(),
    ],
    PROGRAM_ID
  );
  
  return contractPDA;
}

// Fetch contract data from blockchain
export async function fetchContractData(
  contractId: string
): Promise<ContractData | null> {
  // We need to find the contract creator first to derive the PDA
  // Since we don't know the creator yet, we'll need to search all contracts
  // For hackathon purposes, let's try to fetch it using a common pattern
  
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    {} as anchor.Wallet,
    { commitment: "confirmed" }
  );
  const program = new Program(idl as anchor.Idl, provider);

  try {
    // Convert contractId string to BN properly
    const contractIdBigInt = BigInt(contractId);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(contractIdBigInt);
    const contractIdBN = new anchor.BN(buffer, 'le');

    // Get all contract accounts and filter by contract_id
    const contracts = await program.account.contract.all();
    const contract = contracts.find((c: any) => c.account.contractId.eq(contractIdBN));
    
    if (!contract) {
      console.error("Contract not found on-chain");
      return null;
    }
    
    return contract.account as ContractData;
  } catch (error) {
    console.error("Error fetching contract data:", error);
    return null;
  }
}

