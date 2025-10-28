import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

export function ApprovalProgressBar({ approvalCount, totalMembers }) {
  const total = totalMembers || 1;
  const percentage = Math.min((approvalCount / total) * 100, 100);
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">Approval Progress</span>
        <span className="text-gray-900 font-medium">{approvalCount} / {total}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            percentage >= 100 ? 'bg-green-600' : 'bg-blue-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function CommentThread({ contractId, versionId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    loadComments();
  }, [versionId]);

  const loadComments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/contracts/${contractId}/versions/${versionId}/comments`);
      setComments(res.data.comments);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const addComment = async (parentId = null) => {
    if (!newComment.trim()) return;

    try {
      await axios.post(`${API_BASE}/contracts/${contractId}/versions/${versionId}/comments`, {
        comment: newComment,
        parent_comment_id: parentId
      });
      setNewComment('');
      setReplyingTo(null);
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    }
  };

  const addReply = async (parentId) => {
    if (!replyText.trim()) return;

    try {
      await axios.post(`${API_BASE}/contracts/${contractId}/versions/${versionId}/comments`, {
        comment: replyText,
        parent_comment_id: parentId
      });
      setReplyText('');
      setReplyingTo(null);
      loadComments();
    } catch (error) {
      console.error('Error adding reply:', error);
      alert('Failed to add reply');
    }
  };

  const rootComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_comment_id === parentId);

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Comments</h4>
      
      <div className="space-y-4 mb-4">
        {rootComments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={getReplies(comment.id)}
            onReply={() => setReplyingTo(comment.id)}
            showReplyForm={replyingTo === comment.id}
            replyText={replyText}
            onReplyTextChange={setReplyText}
            onAddReply={() => addReply(comment.id)}
            onCancelReply={() => {
              setReplyingTo(null);
              setReplyText('');
            }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          rows={3}
        />
        <button
          onClick={() => addComment()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Post Comment
        </button>
      </div>
    </div>
  );
}

function CommentItem({ comment, replies, onReply, showReplyForm, replyText, onReplyTextChange, onAddReply, onCancelReply }) {
  return (
    <div className="border-l-2 border-gray-200 pl-3">
      <div className="flex items-start space-x-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900">{comment.user_name}</span>
            <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1 text-left">{comment.comment}</p>
          <button
            onClick={onReply}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1  "
          >
            Reply
          </button>
        </div>
      </div>

      {showReplyForm && (
        <div className="mt-2 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder="Write a reply..."
            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
            rows={2}
          />
          <div className="flex space-x-2">
            <button
              onClick={onAddReply}
              className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-blue-700"
            >
              Post Reply
            </button>
            <button
              onClick={onCancelReply}
              className="bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-xs font-medium hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="mt-3 ml-4 space-y-2">
          {replies.map(reply => (
            <div key={reply.id} className="border-l-2 border-gray-100 pl-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{reply.user_name}</span>
                <span className="text-xs text-gray-500">{new Date(reply.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1 text-left">{reply.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

export function VersionSidebar({ contractId, versions, onSelectVersion, currentVersionId, compareMode, onCompareClick, selectedVersions }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Version History</h3>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No versions yet</p>
        ) : (
          <div className="space-y-2">
            {versions.map(version => {
              const isSelected = selectedVersions?.some(v => v.id === version.id);
              return (
                <div
                  key={version.id}
                  onClick={() => compareMode ? onCompareClick(version) : onSelectVersion(version)}
                  className={`p-3 border rounded-lg cursor-pointer transition ${
                    version.id === currentVersionId
                      ? 'border-blue-500 bg-blue-50'
                      : isSelected && compareMode
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          v{version.version_number}
                        </span>
                        {isSelected && compareMode && (
                          <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full">
                            selected
                          </span>
                        )}
                        {version.merged && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                            merged
                          </span>
                        )}
                        {version.approval_status === 'approved' && !version.merged && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                            approved
                          </span>
                        )}
                        {version.approval_status === 'rejected' && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-full">
                            rejected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {version.commit_message || 'No commit message'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {version.author_name} • {new Date(version.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ContractEditor({ contractId, initialContent, onSave, currentUser }) {
  const [content, setContent] = useState(initialContent || '');
  const [commitMessage, setCommitMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCommitForm, setShowCommitForm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setContent(initialContent || '');
    setHasChanges(false);
  }, [initialContent]);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasChanges(newContent !== (initialContent || ''));
  };

  const handleSave = async () => {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message');
      return;
    }
    setSaving(true);
    try {
      await onSave(content, commitMessage);
      setCommitMessage('');
      setShowCommitForm(false);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving version:', error);
      alert('Failed to save version');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white  rounded-lg">

      <div className="">
        <textarea
          value={content}
          onChange={handleContentChange}
          className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
          placeholder="Enter contract content here..."
        />
        <div className="flex justify-end space-x-3 mt-4">
          {showCommitForm ? (
            <>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Commit Changes'}
              </button>
              <button
                onClick={() => {
                  setShowCommitForm(false);
                  setCommitMessage('');
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowCommitForm(true)}
              disabled={!hasChanges}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiffViewer({ diff, fromVersion, toVersion }) {
  if (!diff || diff.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center py-4">No changes detected</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Diff: v{fromVersion.version_number} → v{toVersion.version_number}
        </h3>
      </div>
      <div className="p-6">
        <div className="space-y-1 font-mono text-sm">
          {diff.map((change, idx) => (
            <div
              key={idx}
              className={`px-3 py-1 ${
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
  );
}

export function ApprovalRequestsSidebar({ contractId, versions, onSelectVersion, currentUserId, isCreator }) {
  const [isOpen, setIsOpen] = useState(true);
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
    <div className="bg-white shadow rounded-lg">
      <div 
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-sm font-medium text-gray-900">Approval Requests</h3>
        <span className="text-xs text-gray-500">{versions.length}</span>
      </div>
      {isOpen && (
        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-gray-500 text-center py-2">Loading...</p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">No pending requests</p>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => {
                const versionApprovals = approvals[version.id];
                const approvalCount = versionApprovals?.approval_count || 0;
                const rejectionCount = versionApprovals?.rejection_count || 0;
                const status = version.approval_status || 'pending';

                return (
                  <div 
                    key={version.id} 
                    className="border border-gray-200 rounded-md p-2 hover:border-blue-300 cursor-pointer transition text-xs"
                    onClick={() => onSelectVersion(version)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">v{version.version_number}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        status === 'approved' ? 'bg-green-100 text-green-800' :
                        status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {status}
                      </span>
                    </div>
                    <p className="text-gray-700 truncate mb-1">{version.commit_message || 'No message'}</p>
                    <div className="flex items-center space-x-2 text-gray-500">
                      <span className="text-green-600">✓ {approvalCount}</span>
                      <span className="text-red-600">✗ {rejectionCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function VersionHistorySidebar({ contractId, history, onSelectVersion }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white shadow rounded-lg">
      <div 
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-sm font-medium text-gray-900">Version History</h3>
        <span className="text-xs text-gray-500">{history.length}</span>
      </div>
      {isOpen && (
        <div className="p-4 max-h-96 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">No history yet</p>
          ) : (
            <div className="space-y-2">
              {history.map((commit) => (
                <div 
                  key={commit.id} 
                  className="border-l-2 border-green-500 pl-3 cursor-pointer hover:bg-gray-50 py-1"
                  onClick={() => onSelectVersion(commit)}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-900">v{commit.version_number}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 rounded">
                      merged
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 mt-0.5 truncate">{commit.commit_message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(commit.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ApprovalRequestsPage({ contractId, versions, onSelectVersion, currentUserId, isCreator }) {
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

  if (loading) return <div className="text-center py-4">Loading...</div>;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Approval Requests</h3>
        <p className="text-sm text-gray-600 mt-1">Review and approve pending versions</p>
      </div>
      <div className="p-6">
        {versions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No pending approval requests</p>
        ) : (
          <div className="space-y-4">
            {versions.map((version) => {
              const versionApprovals = approvals[version.id];
              const approvalCount = versionApprovals?.approval_count || 0;
              const rejectionCount = versionApprovals?.rejection_count || 0;
              const status = version.approval_status || 'pending';

              return (
                <div 
                  key={version.id} 
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition"
                  onClick={() => onSelectVersion(version)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          v{version.version_number}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          status === 'approved' ? 'bg-green-100 text-green-800' :
                          status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mt-1">{version.commit_message || 'No commit message'}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {version.author_name} • {new Date(version.created_at).toLocaleString()}
                      </p>
                      {version.diff_summary && (
                        <p className="text-xs text-gray-500 mt-1">{version.diff_summary}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-xs text-gray-600">
                        <div className="flex items-center space-x-2">
                          <span className="text-green-600">✓ {approvalCount}</span>
                          <span className="text-red-600">✗ {rejectionCount}</span>
                        </div>
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
  );
}

export function HistoryPage({ contractId, history }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Commit History</h3>
        <p className="text-sm text-gray-600 mt-1">Merged and finalized versions</p>
      </div>
      <div className="p-6">
        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No history yet</p>
        ) : (
          <div className="space-y-4">
            {history.map((commit, idx) => (
              <div key={commit.id} className="border-l-4 border-green-500 pl-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    v{commit.version_number}
                  </span>
                  {commit.merged && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                      merged
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-900 mt-1">{commit.commit_message}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {commit.author_name} • {new Date(commit.created_at).toLocaleString()}
                </p>
                {commit.diff_summary && (
                  <p className="text-xs text-gray-500 mt-1">{commit.diff_summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function VersionCompareModal({ contractId, version1, version2, onClose }) {
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiff = async () => {
      try {
        const res = await axios.get(`${API_BASE}/contracts/${contractId}/diff`, {
          params: { from: version1.id, to: version2.id }
        });
        setDiff(res.data.diff);
      } catch (error) {
        console.error('Error fetching diff:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDiff();
  }, [contractId, version1.id, version2.id]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Compare Versions</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <p className="text-gray-500 text-center py-4">Loading diff...</p>
          ) : (
            <DiffViewer diff={diff} fromVersion={version1} toVersion={version2} />
          )}
        </div>
      </div>
    </div>
  );
}

