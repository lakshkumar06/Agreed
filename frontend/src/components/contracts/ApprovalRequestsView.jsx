import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:3001/api'

export function ApprovalRequestsView({ contractId, versions, onSelectVersion, currentUserId, isCreator }) {
  const [approvals, setApprovals] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApprovals();
  }, [versions]);

  const loadApprovals = async () => {
    const approvalsMap = {};
    for (const version of versions) {
      try {
        const res = await axios.get(`${API_BASE}/contracts/${contractId}/versions/${version.id}/approvals`);
        approvalsMap[version.id] = res.data;
      } catch (error) {
        console.error('Error loading approvals:', error);
      }
    }
    setApprovals(approvalsMap);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-medium text-gray-900 mb-4">Approval Requests</h2>
        {loading ? (
          <p className="text-gray-500 text-center py-4">Loading...</p>
        ) : versions.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-500 text-lg">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((version) => {
              const versionApprovals = approvals[version.id];
              const approvalCount = versionApprovals?.approval_count || 0;
              const rejectionCount = versionApprovals?.rejection_count || 0;
              const status = version.approval_status || 'pending';

              return (
                <div 
                  key={version.id} 
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => onSelectVersion(version)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-base font-semibold text-gray-900">v{version.version_number}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          status === 'approved' ? 'bg-green-100 text-green-800' :
                          status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium mb-1">{version.commit_message || 'No commit message'}</p>
                      <p className="text-sm text-gray-500">{version.author_name} • {new Date(version.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-3 text-sm">
                        <span className="text-green-600 font-medium">✓ {approvalCount}</span>
                        <span className="text-red-600 font-medium">✗ {rejectionCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}

