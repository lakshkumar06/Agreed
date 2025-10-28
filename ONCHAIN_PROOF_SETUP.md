# On-Chain Proof Storage Setup

This system stores cryptographic proofs of finalized contract versions on Solana devnet.

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Generate Solana Keypair

```bash
# Install Solana CLI if not already installed
# https://docs.solana.com/cli/install-solana-cli-tools

# Generate a new keypair for devnet
solana-keygen new --outfile ~/.config/solana/devnet-keypair.json

# Get the private key (base64 format)
cat ~/.config/solana/devnet-keypair.json
```

The keypair file contains a JSON array with 64 numbers representing the private key. Copy this array and convert it to base64 format for the environment variable.

### 3. Configure Environment

Copy `.env.example` to `.env` and add your Solana private key:

```bash
cp .env.example .env
# Edit .env and add your SOLANA_SIGNER_PRIVATE_KEY
```

### 4. Run Database Migration

```bash
node database/migrate_onchain_proof.js
```

### 5. Start the Backend

```bash
npm run dev
```

## How It Works

1. **Contract Merging**: When a contract version is merged (either auto-merge at 100% approval or manual merge), the system:
   - Generates a SHA256 hash of the contract content
   - Stores the hash as a memo instruction on Solana devnet
   - Saves both the hash and transaction hash to the database

2. **Frontend Display**: The version history shows:
   - ✅ **Green dot + "Verified on-chain"** - Contract proof stored on Solana
   - 🟡 **Yellow dot + "Hash generated"** - Hash created but on-chain storage pending/failed
   - ⚪ **Gray dot + "Not yet verified"** - No hash generated yet

3. **Verification**: Users can click "View Proof" to see the transaction on Solana Explorer

## API Response

When a contract is merged, the API returns:

```json
{
  "message": "Version merged successfully",
  "onchain_proof": {
    "contract_hash": "sha256_hash_here",
    "tx_hash": "solana_transaction_hash_here",
    "error": null
  }
}
```

## Troubleshooting

- **"SOLANA_SIGNER_PRIVATE_KEY not set"**: Add your private key to `.env`
- **"Transaction failed"**: Check your Solana balance and network connectivity
- **"Hash generated, on-chain storage pending"**: On-chain storage failed but hash is saved for retry
