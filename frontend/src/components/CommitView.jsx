import { useState, useEffect } from 'react';
import axios from 'axios';
import { ApprovalProgressBar } from './ApprovalProgressBar';
import { CommentThread } from './CommentThread';

const API_BASE = 'http://localhost:3001/api';

export function CommitView({ contractId, version, currentUserId, onRefresh, isCreator = false, totalMembers = 0, onBack }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diff, setDiff] = useState(null);
  const [parentVersion, setParentVersion] = useState(null);
  const [approvalCount, setApprovalCount] = useState(0);
  const [rejectionCount, setRejectionCount] = useState(0);
  const [versionStatus, setVersionStatus] = useState(version.approval_status || 'pending');
  
  // Check if current user is the version author (the person who made the changes)
  const isVersionAuthor = version.author_id === currentUserId;

  useEffect(() => {
    loadApprovals();
    if (version?.parent_version_id) {
      loadParentVersion();
    }
  }, [version?.id]);

  const loadApprovals = async () => {
    if (!version?.id) return;
    
    try {
      const res = await axios.get(`${API_BASE}/contracts/${contractId}/versions/${version.id}/approvals`);
      setApprovals(res.data.approvals);
      setApprovalCount(res.data.approval_count || 0);
      setRejectionCount(res.data.rejection_count || 0);
      setVersionStatus(res.data.status || 'pending');
      
      // Check if current user has voted
      const userApproval = res.data.approvals.find(a => a.user_id === currentUserId);
      if (userApproval) {
        setUserVote(userApproval.vote);
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadParentVersion = async () => {
    try {
      const res = await axios.get(`${API_BASE}/contracts/${contractId}/versions/${version.parent_version_id}`);
      setParentVersion(res.data.version);
    } catch (error) {
      console.error('Error loading parent version:', error);
    }
  };

  const loadDiff = async () => {
    if (!version?.parent_version_id) return;
    
    try {
      const res = await axios.get(`${API_BASE}/contracts/${contractId}/diff`, {
        params: { from: version.parent_version_id, to: version.id }
      });
      setDiff(res.data.diff);
      setShowDiff(true);
    } catch (error) {
      console.error('Error loading diff:', error);
    }
  };

  const submitVote = async (vote) => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/contracts/${contractId}/versions/${version.id}/approve`, {
        vote,
        comment: approvalComment || undefined
      });
      setApprovalComment('');
      await loadApprovals();
      setVersionStatus(res.data.status);
      onRefresh();
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-4">Loading...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Back to Editor
        </button>
      </div>
      
      <div className="border-b border-gray-200 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">v{version.version_number}</h3>
            <p className="text-sm text-gray-600 mt-1">{version.commit_message || 'No commit message'}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            versionStatus === 'approved' ? 'bg-green-100 text-green-800' :
            versionStatus === 'rejected' ? 'bg-red-100 text-red-800' :
            versionStatus === 'merged' ? 'bg-blue-100 text-blue-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {versionStatus || 'pending'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          By {version.author_name} • {new Date(version.created_at).toLocaleString()}
        </p>
      </div>

      {/* Commit Content */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900">Commit Content</h4>
          {version.parent_version_id && (
            <button
              onClick={loadDiff}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showDiff ? 'Hide Changes' : 'Show Changes'}
            </button>
          )}
        </div>
        <div className="bg-gray-50 rounded-md p-3 max-h-64 overflow-y-auto">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
            {version.content || '(empty)'}
          </pre>
        </div>
      </div>

      {/* Diff View */}
      {showDiff && diff && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Changes</h4>
          <div className="bg-gray-50 rounded-md p-3 max-h-64 overflow-y-auto">
            <div className="space-y-1 font-mono text-xs">
              {diff.map((change, idx) => (
                <div
                  key={idx}
                  className={`px-2 py-1 ${
                    change.type === 'add'
                      ? 'bg-green-50 text-green-800'
                      : change.type === 'remove'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-gray-50'
                  }`}
                >
                  <span className="font-bold">
                    {change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' '}
                  </span>
                  {change.line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {versionStatus !== 'merged' && (
        <>
          <ApprovalProgressBar approvalCount={approvalCount} totalMembers={totalMembers} />

          {/* Author Dashboard */}
          {isVersionAuthor ? (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Approval Dashboard</h4>

              <div className="bg-gray-50 rounded-md p-3">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-600">Current Status</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{versionStatus || 'pending'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Approval Count</p>
                    <p className="text-sm font-medium text-gray-900">{approvalCount} / {totalMembers}</p>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-600 mb-2">Votes Summary</p>
                  <div className="space-y-2">
                    {approvals.length === 0 ? (
                      <p className="text-xs text-gray-500">No votes yet</p>
                    ) : (
                      approvals.map(approval => (
                        <div key={approval.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${
                              approval.vote === 'approve' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                            <span className="text-gray-900">{approval.user_name}</span>
                          </div>
                          <span className={`px-2 py-1 rounded ${
                            approval.vote === 'approve' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {approval.vote}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Your Vote</h4>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => submitVote('approve')}
                  disabled={submitting}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
                    userVote === 'approve'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  } disabled:opacity-50`}
                >
                  {userVote === 'approve' ? '✓ Approved' : 'Approve'}
                </button>
                <button
                  onClick={() => submitVote('reject')}
                  disabled={submitting}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
                    userVote === 'reject'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  } disabled:opacity-50`}
                >
                  {userVote === 'reject' ? '✗ Rejected' : 'Reject'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      
      {versionStatus === 'merged' && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-green-900">This version has been merged into the main contract.</p>
          </div>
        </div>
      )}

      {versionStatus != 'merged' && (
        <CommentThread contractId={contractId} versionId={version.id} />
      )}
    </div>
  );
}

