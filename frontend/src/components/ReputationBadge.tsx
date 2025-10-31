import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchReputation } from '../solana/reputation';

export function ReputationBadge() {
  const wallet = useWallet();
  const [rep, setRep] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wallet.publicKey) {
      fetchReputation(wallet.publicKey)
        .then(setRep)
        .finally(() => setLoading(false));
    }
  }, [wallet.publicKey]);

  if (!wallet.publicKey) return null;
  if (loading) return <div className="reputation-loading">Loading reputation...</div>;
  if (!rep) return <div className="reputation-empty">No on-chain activity yet</div>;

  return (
    <div className="reputation-card">
      <h3>🏆 On-Chain Reputation</h3>
      <div className="reputation-stats">
        <div className="stat">
          <span className="stat-label">Contracts Created:</span>
          <strong className="stat-value">{rep.contractsCreated}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Contracts Completed:</span>
          <strong className="stat-value">{rep.contractsCompleted}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Approvals Given:</span>
          <strong className="stat-value">{rep.contractsApproved}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Member Since:</span>
          <strong className="stat-value">{rep.firstActivity.toLocaleDateString()}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">Last Activity:</span>
          <strong className="stat-value">{rep.lastActivity.toLocaleDateString()}</strong>
        </div>
      </div>
    </div>
  );
}

