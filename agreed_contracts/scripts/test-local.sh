#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
source_file="$root/programs/agreed_contracts/src/lib.rs"
anchor_file="$root/Anchor.toml"
idl_file="$root/idl/agreed_contracts.json"
keypair_file="$root/target/deploy/agreed_contracts-keypair.json"
backup_dir=$(mktemp -d)
cp -p "$source_file" "$backup_dir/lib.rs"
cp -p "$anchor_file" "$backup_dir/Anchor.toml"
cp -p "$idl_file" "$backup_dir/agreed_contracts.json"
restore() {
  cp -p "$backup_dir/lib.rs" "$source_file"
  cp -p "$backup_dir/Anchor.toml" "$anchor_file"
  cp -p "$backup_dir/agreed_contracts.json" "$idl_file"
  rm -rf "$backup_dir"
}
trap restore EXIT

mkdir -p "$(dirname "$keypair_file")"
if [[ ! -f "$keypair_file" ]]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$keypair_file"
fi
configured_id=$(sed -n 's/.*declare_id!("\([^"]*\)").*/\1/p' "$source_file")
local_id=$(solana-keygen pubkey "$keypair_file")
if [[ -z "$configured_id" || -z "$local_id" ]]; then
  echo 'Could not determine the configured and local program IDs' >&2
  exit 1
fi
if [[ "$configured_id" != "$local_id" ]]; then
  perl -pi -e "s/$configured_id/$local_id/g" "$source_file" "$anchor_file"
fi
cd "$root"
anchor build --provider.cluster localnet
anchor test --provider.cluster localnet --skip-build
