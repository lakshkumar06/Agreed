import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { assert } from 'chai';

const BN: typeof anchor.BN = (anchor as any).BN ?? (anchor as any).default.BN;

// Run with a local validator: anchor test --provider.cluster localnet
// This checks rejected account substitutions and one-time reputation credit.
describe('contract security invariants', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AgreedContracts as Program;
  const creator = provider.wallet.publicKey;
  const recipient = Keypair.generate().publicKey;
  const otherRecipient = Keypair.generate().publicKey;
  const firstId = new BN(Date.now()).add(new BN(1_000_000_000));
  const secondId = firstId.add(new BN(1));
  const milestoneId = new BN(1);
  const [reputation] = PublicKey.findProgramAddressSync(
    [Buffer.from('reputation'), creator.toBuffer()], program.programId);
  const contractPda = (id: anchor.BN) => PublicKey.findProgramAddressSync(
    [Buffer.from('contract'), id.toArrayLike(Buffer, 'le', 8), creator.toBuffer()], program.programId)[0];
  const first = contractPda(firstId);
  const second = contractPda(secondId);
  const [escrow] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), first.toBuffer(), milestoneId.toArrayLike(Buffer, 'le', 8)], program.programId);

  async function rejectsWith(action: () => Promise<unknown>, message: string) {
    try { await action(); assert.fail(`Expected ${message}`); }
    catch (error) { assert.include(String(error), message); }
  }

  before(async () => {
    try { await program.account.userReputation.fetch(reputation); }
    catch {
      await program.methods.initializeReputation().accounts({
        reputation, user: creator, systemProgram: SystemProgram.programId,
      }).rpc();
    }
    await program.methods.initializeContract(firstId, [creator, recipient], 2).accounts({
      contract: first, creatorReputation: reputation, creator, systemProgram: SystemProgram.programId,
    }).rpc();
    await program.methods.initializeContract(secondId, [creator], 1).accounts({
      contract: second, creatorReputation: reputation, creator, systemProgram: SystemProgram.programId,
    }).rpc();
    await program.methods.initializeEscrowMilestone(
      milestoneId, firstId, 'Review work', new BN(1_000_000), recipient,
      new BN(Math.floor(Date.now() / 1000) + 3600),
    ).accounts({
      escrowMilestone: escrow, contract: first, creatorReputation: reputation,
      creator, systemProgram: SystemProgram.programId,
    }).rpc();
  });

  it('rejects another contract when marking an escrow complete', async () => {
    await rejectsWith(() => program.methods.markMilestoneComplete().accounts({
      escrowMilestone: escrow, contract: second, marker: creator,
    }).rpc(), 'InvalidMilestoneContract');
  });

  it('rejects release to an address other than the funded recipient', async () => {
    await rejectsWith(() => program.methods.releaseEscrowFunds().accounts({
      escrowMilestone: escrow, recipient: otherRecipient,
    }).rpc(), 'InvalidEscrowRecipient');
  });

  it('credits contract completion only once to a participating signer', async () => {
    await program.methods.approveContract().accounts({
      contract: second, approverReputation: reputation, approver: creator,
    }).rpc();
    const [completionMarker] = PublicKey.findProgramAddressSync(
      [Buffer.from('completion'), second.toBuffer(), creator.toBuffer()], program.programId);
    const before = await program.account.userReputation.fetch(reputation);
    await program.methods.markContractComplete().accounts({
      contract: second, participantReputation: reputation, completionMarker,
      participant: creator, systemProgram: SystemProgram.programId,
    }).rpc();
    const after = await program.account.userReputation.fetch(reputation);
    assert.equal(after.contractsCompleted, before.contractsCompleted + 1);
    await rejectsWith(() => program.methods.markContractComplete().accounts({
      contract: second, participantReputation: reputation, completionMarker,
      participant: creator, systemProgram: SystemProgram.programId,
    }).rpc(), 'already in use');
  });
});
